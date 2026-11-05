"use server";

// One-time (or occasional) cleanup for customer records saved before the
// phone-mask fix (see src/lib/phone.ts's formatPhoneInput). Deliberately
// split into three buckets instead of one blind "normalize everything"
// pass:
//
// 1. Safe to fix automatically — the stored value is just inconsistently
//    formatted (missing +1, stray punctuation, etc.) but still contains
//    the real 10 digits. Reformatting it loses no information.
// 2. The actual bug's signature ("+1" followed by a 10-digit string that
//    itself starts with 1) — no real NANP area code starts with 1, so
//    this is unambiguously wrong, but the true last digit was dropped by
//    the old mask and isn't recoverable from what's stored. Flagged for
//    a human to re-contact the customer, never guessed at.
// 3. Doesn't parse as a US number at all — could be a foreign number, an
//    extension, or unrelated bad data. Left untouched and flagged.

import { prisma } from "@/lib/prisma";
import { requireScope } from "@/lib/queries/scope";
import { normalizePhone } from "@/lib/phone";
import { logActivity } from "@/lib/activity";
import { revalidatePath } from "next/cache";

const VALID_NANP = /^\+1[2-9]\d{9}$/;
// The exact signature of the dropped-digit bug: "+1" followed by a
// 10-digit string that itself starts with 1. No real NANP area code
// starts with 1, so this is unambiguous — but it's also the *only* shape
// normalizePhone can produce besides a valid NANP number, since it never
// invents a different country code from a bare (no "+") input.
const MASK_BUG_SHAPE = /^\+11\d{9}$/;
// A non-US number entered with its own "+<country code>" is legitimate
// and needs no fixing — normalizePhone passes it through unchanged, so
// check the ORIGINAL value (not just the NANP-shaped output) to tell it
// apart from the bug shape above.
const OTHER_INTERNATIONAL = /^\+(?!1)\d{10,15}$/;

export type PhoneAuditEntry = { id: string; name: string; before: string; after?: string };

export type PhoneAuditResult =
  | { error: string }
  | {
      scanned: number;
      fixed: PhoneAuditEntry[];
      corrupted: PhoneAuditEntry[];
      unparseable: PhoneAuditEntry[];
    };

export async function runPhoneAudit(): Promise<PhoneAuditResult> {
  const scope = await requireScope();
  if (scope.role !== "ADMIN") return { error: "Only admins can run this." };

  const customers = await prisma.customer.findMany({
    where: { phone: { not: null } },
    select: { id: true, firstName: true, lastName: true, phone: true },
  });

  const fixed: PhoneAuditEntry[] = [];
  const corrupted: PhoneAuditEntry[] = [];
  const unparseable: PhoneAuditEntry[] = [];

  for (const c of customers) {
    const phone = c.phone!;
    if (VALID_NANP.test(phone)) continue; // already correct
    if (OTHER_INTERNATIONAL.test(phone)) continue; // a legitimate non-US number — nothing to fix

    const name = `${c.firstName} ${c.lastName}`;
    const normalized = normalizePhone(phone);

    if (normalized && VALID_NANP.test(normalized)) {
      if (normalized !== phone) {
        await prisma.customer.update({ where: { id: c.id }, data: { phone: normalized } });
        await logActivity({
          customerId: c.id,
          type: "CUSTOMER_UPDATED",
          description: `Phone number reformatted during phone-audit cleanup: "${phone}" → "${normalized}".`,
          actorId: scope.userId,
        });
      }
      fixed.push({ id: c.id, name, before: phone, after: normalized });
    } else if (normalized && MASK_BUG_SHAPE.test(normalized)) {
      // The classic mask-bug shape — not safe to auto-correct, the true
      // last digit is already gone.
      corrupted.push({ id: c.id, name, before: phone });
    } else {
      unparseable.push({ id: c.id, name, before: phone });
    }
  }

  revalidatePath("/settings/phone-audit");
  revalidatePath("/customers");
  revalidatePath("/leads");
  return { scanned: customers.length, fixed, corrupted, unparseable };
}
