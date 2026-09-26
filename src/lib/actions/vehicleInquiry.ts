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
import { getPrimarySalespersonId, resolveSourceId, findActiveLeadForCustomer } from "@/lib/actions/booking";
import { notifyAdmin, type AdminAlertType } from "@/lib/notify/adminAlert";

const INQUIRY_TYPE_LABEL: Record<string, string> = {
  INFO: "Requested more information",
  AVAILABILITY: "Asked to confirm availability",
  FINANCING: "Asked about financing",
};

// Per-inquiry-type task/notification wiring — the calendar/task-list color
// coding (🔵🟡🟠) and the "🔔 New ___" bell copy the user asked for.
const INQUIRY_TASK_TYPE: Record<string, string> = {
  INFO: "VEHICLE_INFO",
  AVAILABILITY: "VEHICLE_AVAILABILITY",
  FINANCING: "FINANCING_REQUEST",
};
const INQUIRY_TASK_PRIORITY: Record<string, string> = {
  INFO: "NORMAL",
  AVAILABILITY: "HIGH",
  FINANCING: "HIGH",
};
const INQUIRY_NOTIF_TYPE: Record<string, AdminAlertType> = {
  INFO: "VEHICLE_INQUIRY",
  AVAILABILITY: "AVAILABILITY_REQUEST",
  FINANCING: "FINANCING_REQUEST",
};
const INQUIRY_NOTIF_TITLE: Record<string, string> = {
  INFO: "New Vehicle Inquiry",
  AVAILABILITY: "New Availability Request",
  FINANCING: "New Financing Request",
};

function inquiryNotifBody(inquiryType: string, customerName: string, vehicleLabel: string) {
  switch (inquiryType) {
    case "AVAILABILITY":
      return `${customerName} wants to know if the ${vehicleLabel} is still available.`;
    case "FINANCING":
      return `${customerName} is asking about financing options for the ${vehicleLabel}.`;
    default:
      return `${customerName} wants more information on a ${vehicleLabel}.`;
  }
}

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

  const vehicleLabel = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  const noteLines = [`${INQUIRY_TYPE_LABEL[d.inquiryType]} for the ${vehicleLabel} (stock #${vehicle.stockNumber}) from the website's vehicle inventory page.`];
  if (d.message) noteLines.push(`Message: ${d.message}`);
  const newNote = noteLines.join("\n");

  // Attach to the customer's existing active lead (a second inquiry, or an
  // inquiry after they already booked) instead of forking a duplicate lead.
  const existingLead = await findActiveLeadForCustomer(customer.id);
  const isNewLead = !existingLead;
  const lead = existingLead
    ? await prisma.lead.update({
        where: { id: existingLead.id },
        data: {
          // Never downgrade an already-hotter lead; a financing ask always
          // promotes to HOT regardless of what it was. recomputeLeadScore()
          // below re-derives this from financingRequestedAt right after, so
          // this is just the immediate value until that runs.
          temperature: d.inquiryType === "FINANCING" || existingLead.temperature === "HOT" ? "HOT" : "WARM",
          financeType: d.inquiryType === "FINANCING" ? "FINANCE" : existingLead.financeType,
          financingRequestedAt: d.inquiryType === "FINANCING" ? new Date() : existingLead.financingRequestedAt,
          // Most-recent note first — matches the Leads list, which shows
          // customerNeeds' first line as the "what they wanted" preview.
          customerNeeds: [newNote, existingLead.customerNeeds].filter(Boolean).join("\n\n"),
          lastContactedAt: new Date(),
        },
      })
    : await prisma.lead.create({
        data: {
          customerId: customer.id,
          sourceId,
          assigneeId: salespersonId,
          stageId: fallbackStage.id,
          temperature: d.inquiryType === "FINANCING" ? "HOT" : "WARM",
          score: 40,
          financeType: d.inquiryType === "FINANCING" ? "FINANCE" : undefined,
          financingRequestedAt: d.inquiryType === "FINANCING" ? new Date() : undefined,
          customerNeeds: newNote,
          lastContactedAt: new Date(),
        },
      });

  const existingInterest = await prisma.customerVehicle.findFirst({ where: { leadId: lead.id, vehicleId: vehicle.id } });
  if (existingInterest) {
    await prisma.customerVehicle.update({ where: { id: existingInterest.id }, data: { interestLevel: "STRONG" } });
  } else {
    const hasAnyInterest = (await prisma.customerVehicle.count({ where: { leadId: lead.id } })) > 0;
    await prisma.customerVehicle.create({
      data: { customerId: customer.id, leadId: lead.id, vehicleId: vehicle.id, isPrimary: !hasAnyInterest, interestLevel: "STRONG" },
    });
  }

  await logActivity({
    customerId: customer.id,
    leadId: lead.id,
    type: "NOTE_ADDED",
    description: `${INQUIRY_TYPE_LABEL[d.inquiryType]} for the ${vehicleLabel} via the website.`,
  });

  const customerName = `${customer.firstName} ${customer.lastName}`;

  // A calendar/task-list task for this specific request, distinct from the
  // Day 0/1/2… follow-up sequence tasks — every submission gets its own,
  // even on a lead that already exists, so nothing the customer asked for
  // gets lost in a shared sequence task.
  await prisma.task.create({
    data: {
      customerId: customer.id,
      leadId: lead.id,
      title: `${INQUIRY_NOTIF_TITLE[d.inquiryType]} — ${vehicleLabel}`,
      type: INQUIRY_TASK_TYPE[d.inquiryType],
      priority: INQUIRY_TASK_PRIORITY[d.inquiryType],
      dueDate: new Date(Date.now() + 60 * 60 * 1000),
      notes: newNote,
      assigneeId: salespersonId,
      source: "AUTOMATION",
    },
  });

  await notifyAdmin({
    userId: salespersonId,
    type: INQUIRY_NOTIF_TYPE[d.inquiryType],
    title: INQUIRY_NOTIF_TITLE[d.inquiryType],
    body: inquiryNotifBody(d.inquiryType, customerName, vehicleLabel),
    link: `/customers/${customer.id}`,
  });

  // The lead-lifecycle automation (Day 0/1/2… sequence + generic "new lead"
  // bell) only fires once, when the lead is actually new — a repeat
  // inquiry on an existing lead already got its own tailored notify above.
  if (isNewLead) await runAutomation("NEW_LEAD", { customerId: customer.id, leadId: lead.id });
  await recomputeLeadScore(lead.id, salespersonId);

  revalidatePath("/leads");
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  revalidatePath(`/vehicles/${vehicle.id}`);
  revalidatePath(`/customers/${customer.id}`);

  return { success: true };
}
