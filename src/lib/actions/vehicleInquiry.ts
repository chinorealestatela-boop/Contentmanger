"use server";

// Public, unauthenticated server action behind the "Available Vehicles"
// pages (src/app/(site)/inventory/**) — same trust model as
// src/lib/actions/booking.ts: no requireScope(), every input validated
// here, writes scoped narrowly. Named separately from
// src/lib/actions/inventory.ts (the admin CRM's inventory-sync/CSV-upload
// actions) so the two don't collide — that file is authenticated-only and
// unrelated to this one. Reads for the public inventory pages live in
// src/lib/queries/publicInventory.ts.

import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity";
import { runAutomation } from "@/lib/automation/engine";
import { recomputeLeadScore } from "@/lib/scoring-engine";
import { normalizePhone, isValidPhone } from "@/lib/phone";
import { getPrimarySalespersonId, resolveSourceId } from "@/lib/actions/booking";

const INQUIRY_TYPE_LABEL: Record<string, string> = {
  INFO: "Requested more information",
  AVAILABILITY: "Asked to confirm availability",
  FINANCING: "Asked about financing",
};

const inquirySchema = z.object({
  vehicleId: z.string().min(1),
  inquiryType: z.enum(["INFO", "AVAILABILITY", "FINANCING"]).default("INFO"),
  firstName: z.string().trim().min(1, "First name is required."),
  lastName: z.string().trim().min(1, "Last name is required."),
  phone: z.string().trim().min(1, "Phone number is required."),
  email: z.string().trim().email("Enter a valid email address.").optional().or(z.literal("")),
  message: z.string().trim().max(2000).optional(),
  commConsent: z.string().refine((v) => v === "on" || v === "true", { message: "Please agree to be contacted to continue." }),
});

export type InquiryActionState = { error: string } | { success: true } | null;

export async function submitVehicleInquiry(_prev: InquiryActionState, formData: FormData): Promise<InquiryActionState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = inquirySchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
  const d = parsed.data;

  if (!isValidPhone(d.phone)) return { error: "Enter a valid 10-digit phone number." };
  const phone = normalizePhone(d.phone)!;
  const consented = d.commConsent === "on" || d.commConsent === "true";
  const consentIp = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || null;

  const vehicle = await prisma.vehicle.findFirst({ where: { id: d.vehicleId, status: "AVAILABLE" } });
  if (!vehicle) return { error: "This vehicle is no longer available. Please browse our current inventory." };

  const salespersonId = await getPrimarySalespersonId();
  if (!salespersonId) return { error: "This form is temporarily unavailable. Please call the dealership directly." };

  const sourceId = await resolveSourceId("inventory");

  const newLeadStage = await prisma.pipelineStage.findFirst({ where: { name: "New Lead" } });
  const fallbackStage = newLeadStage ?? (await prisma.pipelineStage.findFirst({ orderBy: { order: "asc" } }));
  if (!fallbackStage) return { error: "This form is temporarily unavailable. Please call the dealership directly." };

  let customer = await prisma.customer.findFirst({ where: { phone, ownerId: salespersonId } });
  if (customer) {
    customer = await prisma.customer.update({
      where: { id: customer.id },
      data: {
        firstName: d.firstName,
        lastName: d.lastName,
        email: d.email || customer.email,
        smsConsent: consented || customer.smsConsent,
        smsConsentAt: consented && !customer.smsConsent ? new Date() : customer.smsConsentAt,
        emailConsent: consented || customer.emailConsent,
        emailConsentAt: consented && !customer.emailConsent ? new Date() : customer.emailConsentAt,
        consentIp: consented ? consentIp : customer.consentIp,
      },
    });
  } else {
    customer = await prisma.customer.create({
      data: {
        firstName: d.firstName,
        lastName: d.lastName,
        phone,
        email: d.email || undefined,
        ownerId: salespersonId,
        smsConsent: consented,
        smsConsentAt: consented ? new Date() : undefined,
        emailConsent: consented,
        emailConsentAt: consented ? new Date() : undefined,
        consentIp: consented ? consentIp : undefined,
      },
    });
  }

  const noteLines = [`${INQUIRY_TYPE_LABEL[d.inquiryType]} for the ${vehicle.year} ${vehicle.make} ${vehicle.model} (stock #${vehicle.stockNumber}) from the website's vehicle inventory page.`];
  if (d.message) noteLines.push(`Message: ${d.message}`);

  const lead = await prisma.lead.create({
    data: {
      customerId: customer.id,
      sourceId,
      assigneeId: salespersonId,
      stageId: fallbackStage.id,
      temperature: d.inquiryType === "FINANCING" ? "HOT" : "WARM",
      score: 40,
      financeType: d.inquiryType === "FINANCING" ? "FINANCE" : undefined,
      customerNeeds: noteLines.join("\n"),
      lastContactedAt: new Date(),
    },
  });

  await prisma.customerVehicle.create({
    data: {
      customerId: customer.id,
      leadId: lead.id,
      vehicleId: vehicle.id,
      isPrimary: true,
      interestLevel: "STRONG",
    },
  });

  await logActivity({
    customerId: customer.id,
    leadId: lead.id,
    type: "NOTE_ADDED",
    description: `${INQUIRY_TYPE_LABEL[d.inquiryType]} for the ${vehicle.year} ${vehicle.make} ${vehicle.model} via the website.`,
  });

  await runAutomation("NEW_LEAD", { customerId: customer.id, leadId: lead.id });
  await recomputeLeadScore(lead.id, salespersonId);

  revalidatePath("/leads");
  revalidatePath("/dashboard");
  revalidatePath(`/vehicles/${vehicle.id}`);

  return { success: true };
}
