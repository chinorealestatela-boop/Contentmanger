"use server";

// Public, unauthenticated server action behind the "new inventory" capture
// banner on /inventory (src/components/inventory/InventoryAlertBanner.tsx).
// Same trust model as booking.ts/vehicleInquiry.ts/consultation.ts: no
// requireScope(), every input validated here. This only captures a real
// lead so staff can follow up (manually, or via the existing Follow-Up
// Sequences feature) — it does NOT set up an automated "text me when a
// new vehicle arrives" send; nothing here sends any message on its own.

import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity";
import { runAutomation } from "@/lib/automation/engine";
import { normalizePhone, isValidPhone } from "@/lib/phone";
import { getPrimarySalespersonId, resolveSourceId } from "@/lib/actions/booking";

const alertSchema = z.object({
  phone: z.string().trim().min(1, "Phone number is required."),
  email: z.string().trim().email("Enter a valid email address.").optional().or(z.literal("")),
  commConsent: z.string().refine((v) => v === "on" || v === "true", { message: "Please agree to be contacted to continue." }),
});

export type InventoryAlertActionState = { error: string } | { success: true } | null;

export async function submitInventoryAlertSignup(_prev: InventoryAlertActionState, formData: FormData): Promise<InventoryAlertActionState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = alertSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
  const d = parsed.data;

  if (!isValidPhone(d.phone)) return { error: "Enter a valid 10-digit phone number." };
  const phone = normalizePhone(d.phone)!;
  const consentIp = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || null;

  const salespersonId = await getPrimarySalespersonId();
  if (!salespersonId) return { error: "This isn't available right now. Please call the dealership directly." };

  const sourceId = await resolveSourceId("inventory-alert");

  const newLeadStage = await prisma.pipelineStage.findFirst({ where: { name: "New Lead" } });
  const fallbackStage = newLeadStage ?? (await prisma.pipelineStage.findFirst({ orderBy: { order: "asc" } }));
  if (!fallbackStage) return { error: "This isn't available right now. Please call the dealership directly." };

  let customer = await prisma.customer.findFirst({ where: { phone, ownerId: salespersonId } });
  if (customer) {
    customer = await prisma.customer.update({
      where: { id: customer.id },
      data: {
        email: d.email || customer.email,
        smsConsent: true,
        smsConsentAt: customer.smsConsent ? customer.smsConsentAt : new Date(),
        emailConsent: d.email ? true : customer.emailConsent,
        emailConsentAt: d.email && !customer.emailConsent ? new Date() : customer.emailConsentAt,
        consentIp,
      },
    });
  } else {
    customer = await prisma.customer.create({
      data: {
        firstName: "Inventory Alert",
        lastName: "Signup",
        phone,
        email: d.email || undefined,
        ownerId: salespersonId,
        smsConsent: true,
        smsConsentAt: new Date(),
        emailConsent: !!d.email,
        emailConsentAt: d.email ? new Date() : undefined,
        consentIp,
      },
    });
  }

  // Don't create a duplicate lead every time the same phone number submits
  // this banner more than once (e.g. they dismissed and it resurfaced on a
  // different device) — just refresh the existing one's follow-up date.
  const existingAlertLead = await prisma.lead.findFirst({
    where: { customerId: customer.id, sourceId, status: "ACTIVE" },
  });

  if (existingAlertLead) {
    await prisma.lead.update({
      where: { id: existingAlertLead.id },
      data: { lastContactedAt: new Date(), nextFollowUpAt: new Date() },
    });
  } else {
    const lead = await prisma.lead.create({
      data: {
        customerId: customer.id,
        sourceId,
        assigneeId: salespersonId,
        stageId: fallbackStage.id,
        temperature: "COLD",
        score: 20,
        customerNeeds: "Signed up on the website to be notified about new inventory — not an active buyer yet, just wants to be kept in the loop.",
        lastContactedAt: new Date(),
      },
    });

    await logActivity({
      customerId: customer.id,
      leadId: lead.id,
      type: "NOTE_ADDED",
      description: "Signed up for new-inventory alerts via the website.",
    });

    await runAutomation("NEW_LEAD", { customerId: customer.id, leadId: lead.id });
  }

  revalidatePath("/leads");
  revalidatePath("/dashboard");

  return { success: true };
}
