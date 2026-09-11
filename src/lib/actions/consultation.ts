"use server";

// Public, unauthenticated server action behind the "15-Minute Consultation"
// page (src/app/(site)/consultation) — same trust model as booking.ts and
// vehicleInquiry.ts: no requireScope(), every input validated here.
//
// Deliberately reuses the exact same slot-availability engine as test-drive
// booking (getAvailableSlots/isSlotAvailable in src/lib/availability.ts) —
// no separate scheduling grid. A consultation still occupies one full
// standard appointment slot on the calendar (whatever appointmentDurationMinutes
// is set to); "15-Min Consultation" describes the call itself, not a second,
// narrower slot grid the app would have to keep in sync with the main one.

import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity";
import { runAutomation } from "@/lib/automation/engine";
import { recomputeLeadScore } from "@/lib/scoring-engine";
import { getBookingSettings, isSlotAvailable, getAvailableSlots } from "@/lib/availability";
import { normalizePhone, isValidPhone } from "@/lib/phone";
import { getPrimarySalespersonId, resolveSourceId } from "@/lib/actions/booking";

export async function fetchConsultationSlots(dateStr: string) {
  return getAvailableSlots(dateStr);
}

const consultationSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required."),
  lastName: z.string().trim().min(1, "Last name is required."),
  phone: z.string().trim().min(1, "Phone number is required."),
  email: z.string().trim().email("Enter a valid email address.").optional().or(z.literal("")),
  topic: z.string().trim().max(2000).optional(),
  date: z.string().min(1, "Select a date."),
  time: z.string().min(1, "Select a time."),
  commConsent: z.string().refine((v) => v === "on" || v === "true", { message: "Please agree to be contacted to continue." }),
});

export type ConsultationActionState = { error: string } | { success: true } | null;

export async function submitConsultationBooking(_prev: ConsultationActionState, formData: FormData): Promise<ConsultationActionState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = consultationSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
  const d = parsed.data;

  if (!isValidPhone(d.phone)) return { error: "Enter a valid 10-digit phone number." };
  const phone = normalizePhone(d.phone)!;
  const consented = d.commConsent === "on" || d.commConsent === "true";
  const consentIp = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || null;

  const settings = await getBookingSettings();
  const stillOpen = await isSlotAvailable(d.date, d.time, settings);
  if (!stillOpen) return { error: "That time was just taken. Please pick another." };

  const salespersonId = await getPrimarySalespersonId();
  if (!salespersonId) return { error: "Booking is temporarily unavailable. Please call the dealership directly." };

  const sourceId = await resolveSourceId("consultation");

  const newLeadStage = await prisma.pipelineStage.findFirst({ where: { name: "New Lead" } });
  const fallbackStage = newLeadStage ?? (await prisma.pipelineStage.findFirst({ orderBy: { order: "asc" } }));
  if (!fallbackStage) return { error: "Booking is temporarily unavailable. Please call the dealership directly." };

  const endTime = addMinutes(d.time, Math.min(15, settings.appointmentDurationMinutes));

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

  const lead = await prisma.lead.create({
    data: {
      customerId: customer.id,
      sourceId,
      assigneeId: salespersonId,
      stageId: fallbackStage.id,
      temperature: "WARM",
      score: 45,
      customerNeeds: d.topic ? `15-minute consultation request. What they'd like to discuss: ${d.topic}` : "15-minute consultation request from the website.",
      lastContactedAt: new Date(),
      nextFollowUpAt: new Date(d.date),
    },
  });

  await prisma.appointment.create({
    data: {
      customerId: customer.id,
      leadId: lead.id,
      salespersonId,
      date: new Date(`${d.date}T00:00:00`),
      time: d.time,
      endTime,
      location: settings.location,
      type: "CONSULTATION",
      status: "SCHEDULED",
      source: "BOOKING",
      notes: d.topic ? `15-minute consultation booked from the website.\nWhat they'd like to discuss: ${d.topic}` : "15-minute consultation booked from the website.",
    },
  });

  await logActivity({
    customerId: customer.id,
    leadId: lead.id,
    type: "APPOINTMENT_SET",
    description: `Booked a 15-minute consultation for ${d.date} at ${d.time}.`,
  });

  await runAutomation("NEW_LEAD", { customerId: customer.id, leadId: lead.id });
  await runAutomation("APPOINTMENT_CREATED", { customerId: customer.id, leadId: lead.id });
  await recomputeLeadScore(lead.id, salespersonId);

  revalidatePath("/leads");
  revalidatePath("/appointments");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");

  return { success: true };
}

function addMinutes(time: string, minutes: number) {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
