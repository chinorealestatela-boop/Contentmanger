"use server";

import { prisma } from "@/lib/prisma";
import { requireScope } from "@/lib/queries/scope";
import { normalizePhone } from "@/lib/phone";
import type { Prisma } from "@prisma/client";

export type DuplicateMatch = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  ownerName: string;
  matchedOn: "phone" | "email" | "name";
};

/** Looks for an existing customer that could be the same person as a
 * just-scanned license or lead form. Deliberately NOT restricted to the
 * current salesperson's own book the way customerScopeWhere() restricts
 * everything else in the app — the entire point of this check is
 * catching a record a *different* salesperson already created, same
 * reasoning as why vehicle search in globalSearch() is unscoped. Returns
 * only enough to tell two people apart (name/phone/email/city/owner), not
 * the full customer record.
 *
 * Phone is the primary identifier (per the AI Lead Scanner spec — the one
 * piece of contact info least likely to collide between two different
 * people, and most likely to be entered consistently): a phone match is
 * returned on its own, without also running the broader name search,
 * since a phone hit is already a strong signal and piling on fuzzy name
 * matches would just bury it under noise. Only when there's no phone to
 * check (or it doesn't match anyone) do email and name come into play —
 * email as another exact identifier, name as the last, fuzziest resort
 * (the only one the original license-scan flow used, since a license
 * barcode has no phone or email on it at all). */
export async function findPossibleDuplicates(params: { firstName?: string; lastName?: string; phone?: string; email?: string }): Promise<DuplicateMatch[]> {
  await requireScope();
  const firstName = params.firstName?.trim();
  const lastName = params.lastName?.trim();
  const phone = params.phone ? normalizePhone(params.phone) : null;
  const email = params.email?.trim();

  function toMatches(rows: Awaited<ReturnType<typeof queryWith>>, matchedOn: DuplicateMatch["matchedOn"]): DuplicateMatch[] {
    return rows.map((c) => ({
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      phone: c.phone,
      email: c.email,
      city: c.city,
      ownerName: `${c.owner.firstName} ${c.owner.lastName}`,
      matchedOn,
    }));
  }

  function queryWith(where: Prisma.CustomerWhereInput) {
    return prisma.customer.findMany({ where, include: { owner: true }, take: 5 });
  }

  if (phone) {
    const byPhone = await queryWith({ phone });
    if (byPhone.length > 0) return toMatches(byPhone, "phone");
  }

  if (email) {
    const byEmail = await queryWith({ email });
    if (byEmail.length > 0) return toMatches(byEmail, "email");
  }

  if (firstName && lastName) {
    const byName = await queryWith({ firstName: { contains: firstName }, lastName: { contains: lastName } });
    if (byName.length > 0) return toMatches(byName, "name");
  }

  return [];
}
