"use server";

// Public, unauthenticated server actions behind the customer-facing
// booking site (src/app/(site)/**). Nothing here calls requireScope() —
// by design, anyone can call these without logging in — so every input is
// validated server-side and every write is scoped as narrowly as possible
// (e.g. reschedule/cancel only ever touch the one appointment matching the
// unguessable manageToken in the URL, never an id the client just supplies).

import crypto from "crypto";
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity";
import { runAutomation } from "@/lib/automation/engine";
import { recomputeLeadScore } from "@/lib/scoring-engine";
import { getBookingSettings, isSlotAvailable, getAvailableSlots as getAvailableSlotsForDate } from "@/lib/availability";
import { verifyVehicleStillListed } from "@/lib/inventory/sync";
import { normalizePhone, isValidPhone } from "@/lib/phone";
import { notifyAppointmentEvent } from "@/lib/messaging/notify";
import { notifyAdmin } from "@/lib/notify/adminAlert";
import { formatDate } from "@/lib/format";
import { BOOKING_SOURCE_MAP, DEFAULT_BOOKING_SOURCE } from "@/lib/constants";

// ── Shared helpers ─────────────────────────────────────────────────────

async function baseUrl() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function generateConfirmationCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous 0/O/1/I
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[crypto.randomInt(chars.length)];
  return `AMX-${code}`;
}

function generateManageToken() {
  return crypto.randomBytes(24).toString("base64url");
}

/** The single salesperson every booking-site appointment is assigned to.
 * Reads Setting("primarySalesperson"); falls back to the earliest-created
 * ADMIN, then the earliest-created active user of any role. */
async function getPrimarySalespersonId(): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key: "primarySalesperson" } });
  if (row) {
    try {
      const parsed = JSON.parse(row.value) as { userId?: string };
      if (parsed.userId) {
        const user = await prisma.user.findUnique({ where: { id: parsed.userId } });
        if (user?.isActive) return user.id;
      }
    } catch {
      // fall through to default resolution below
    }
  }
  const admin = await prisma.user.findFirst({
    where: { isActive: true, role: { name: "ADMIN" } },
    orderBy: { createdAt: "asc" },
  });
  if (admin) return admin.id;
  const anyUser = await prisma.user.findFirst({ where: { isActive: true }, orderBy: { createdAt: "asc" } });
  return anyUser?.id ?? null;
}

async function resolveSourceId(ref: string | undefined | null) {
  const name = (ref && BOOKING_SOURCE_MAP[ref.toLowerCase().trim()]) || DEFAULT_BOOKING_SOURCE;
  const source = await prisma.leadSource.upsert({
    where: { name },
    update: {},
    create: { name, order: 999 },
  });
  return source.id;
}

// ── Vehicles for Step 1 ──────────────────────────────────────────────────

export async function getBookingVehicles(q?: string) {
  return prisma.vehicle.findMany({
    where: {
      status: "AVAILABLE",
      ...(q
        ? {
            OR: [
              { make: { contains: q } },
              { model: { contains: q } },
              { trim: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: [{ year: "desc" }, { make: "asc" }],
    select: { id: true, year: true, make: true, model: true, trim: true, condition: true, exteriorColor: true, photos: true, internetPrice: true, sellingPrice: true, mileage: true },
    take: 60,
  });
}

// ── Step 4: availability ─────────────────────────────────────────────────

export async function fetchAvailableSlots(dateStr: string) {
  return getAvailableSlotsForDate(dateStr);
}

export async function fetchBookingWindow() {
  const [settings, dealershipRow] = await Promise.all([getBookingSettings(), prisma.setting.findUnique({ where: { key: "dealership" } })]);
  const dealership = dealershipRow ? JSON.parse(dealershipRow.value) : {};
  return {
    maxBookingWindowDays: settings.maxBookingWindowDays,
    timezone: settings.timezone,
    hours: settings.hours,
    blackoutDates: settings.blackoutDates,
    agentName: settings.agentName,
    location: settings.location,
    dealershipName: dealership.name || "AutoMax LV",
    dealershipPhone: dealership.phone || "702-325-3898",
  };
}

// ── Step 5: submit ────────────────────────────────────────────────────────

const bookingSchema = z.object({
  // Vehicle
  vehicleId: z.string().optional(),
  vehicleYear: z.coerce.number().optional(),
  vehicleMake: z.string().optional(),
  vehicleModel: z.string().optional(),
  vehicleTrim: z.string().optional(),

  // Customer
  firstName: z.string().trim().min(1, "First name is required."),
  lastName: z.string().trim().min(1, "Last name is required."),
  phone: z.string().trim().min(1, "Phone number is required."),
  email: z.string().trim().email("Enter a valid email address.").optional().or(z.literal("")),
  preferredContactMethod: z.enum(["PHONE", "TEXT", "EMAIL"]).default("PHONE"),

  // Buying questions
  downPaymentRange: z.string().optional(),
  monthlyPaymentRange: z.string().optional(),
  creditRange: z.string().optional(),
  currentlyDriving: z.enum(["YES", "NO"]).optional(),
  tradeYear: z.coerce.number().optional(),
  tradeMake: z.string().optional(),
  tradeModel: z.string().optional(),
  tradeMileage: z.coerce.number().optional(),
  tradeOwesMoney: z.enum(["YES", "NO"]).optional(),

  // Schedule
  date: z.string().min(1, "Select a date."),
  time: z.string().min(1, "Select a time."),

  // Consent
  smsConsent: z.string().optional(),
  privacyConsent: z.string().refine((v) => v === "on" || v === "true", { message: "Please agree to be contacted to continue." }),

  // Attribution / anti-duplicate
  ref: z.string().optional(),
});

export type BookingActionState =
  | { error: string }
  | { success: true; confirmationCode: string; manageToken: string }
  | null;

export async function submitBooking(_prev: BookingActionState, formData: FormData): Promise<BookingActionState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = bookingSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
  const d = parsed.data;

  if (!d.vehicleId && !d.vehicleMake) return { error: "Select a vehicle or tell us what you're interested in." };
  if (!isValidPhone(d.phone)) return { error: "Enter a valid 10-digit phone number." };
  const phone = normalizePhone(d.phone)!;
  const smsConsent = d.smsConsent === "on" || d.smsConsent === "true";

  const settings = await getBookingSettings();

  // Re-validate the slot server-side — the client's list can be stale by
  // the time they hit submit.
  const stillOpen = await isSlotAvailable(d.date, d.time, settings);
  if (!stillOpen) return { error: "That time was just taken. Please pick another." };

  // Live availability check — re-confirm against automaxlv.com right
  // before booking so a customer can never schedule a test drive for a
  // vehicle that's already sold or been pulled from the site.
  if (d.vehicleId) {
    const check = await verifyVehicleStillListed(d.vehicleId);
    if (!check.available) {
      return { error: check.reason ?? "This vehicle is no longer available. Please select another vehicle from our current inventory." };
    }
  }

  // Duplicate-submission guard: a resubmit (double-click, back button, retry
  // after a flaky connection) within a couple minutes for the same phone +
  // slot returns the existing booking instead of creating a second one.
  const recentDuplicate = await prisma.appointment.findFirst({
    where: {
      date: new Date(`${d.date}T00:00:00`),
      time: d.time,
      source: "BOOKING",
      status: { not: "CANCELLED" },
      customer: { phone },
      createdAt: { gte: new Date(Date.now() - 3 * 60 * 1000) },
    },
    select: { confirmationCode: true, manageToken: true },
  });
  if (recentDuplicate?.confirmationCode && recentDuplicate.manageToken) {
    return { success: true, confirmationCode: recentDuplicate.confirmationCode, manageToken: recentDuplicate.manageToken };
  }

  const salespersonId = await getPrimarySalespersonId();
  if (!salespersonId) return { error: "Booking is temporarily unavailable. Please call the dealership directly." };

  const sourceId = await resolveSourceId(d.ref);

  const bookedStage = await prisma.pipelineStage.findFirst({ where: { name: "Appointment Set" } });
  const fallbackStage = bookedStage ?? (await prisma.pipelineStage.findFirst({ orderBy: { order: "asc" } }));
  if (!fallbackStage) return { error: "Booking is temporarily unavailable. Please call the dealership directly." };

  const endTime = addMinutes(d.time, settings.appointmentDurationMinutes);
  const confirmationCode = generateConfirmationCode();
  const manageToken = generateManageToken();

  // Find-or-create the customer by phone so a returning visitor doesn't
  // fork into a duplicate customer record every time they book.
  let customer = await prisma.customer.findFirst({ where: { phone, ownerId: salespersonId } });
  if (customer) {
    customer = await prisma.customer.update({
      where: { id: customer.id },
      data: {
        firstName: d.firstName,
        lastName: d.lastName,
        email: d.email || customer.email,
        preferredContactMethod: d.preferredContactMethod,
        smsConsent: smsConsent || customer.smsConsent,
        smsConsentAt: smsConsent && !customer.smsConsent ? new Date() : customer.smsConsentAt,
      },
    });
  } else {
    customer = await prisma.customer.create({
      data: {
        firstName: d.firstName,
        lastName: d.lastName,
        phone,
        email: d.email || undefined,
        preferredContactMethod: d.preferredContactMethod,
        ownerId: salespersonId,
        smsConsent,
        smsConsentAt: smsConsent ? new Date() : undefined,
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
      score: 55,
      downPaymentRange: d.downPaymentRange,
      monthlyPaymentRange: d.monthlyPaymentRange,
      creditRange: d.creditRange,
      lastContactedAt: new Date(),
      nextFollowUpAt: new Date(d.date),
    },
  });

  await prisma.customerVehicle.create({
    data: {
      customerId: customer.id,
      leadId: lead.id,
      vehicleId: d.vehicleId || undefined,
      year: d.vehicleId ? undefined : d.vehicleYear,
      make: d.vehicleId ? undefined : d.vehicleMake,
      model: d.vehicleId ? undefined : d.vehicleModel,
      trim: d.vehicleId ? undefined : d.vehicleTrim,
      isPrimary: true,
      interestLevel: "STRONG",
    },
  });

  if (d.currentlyDriving === "YES") {
    await prisma.tradeIn.create({
      data: {
        customerId: customer.id,
        year: d.tradeYear,
        make: d.tradeMake,
        model: d.tradeModel,
        mileage: d.tradeMileage,
        owesMoney: d.tradeOwesMoney === "YES",
      },
    });
  }

  const appointment = await prisma.appointment.create({
    data: {
      customerId: customer.id,
      leadId: lead.id,
      vehicleId: d.vehicleId || undefined,
      salespersonId,
      date: new Date(`${d.date}T00:00:00`),
      time: d.time,
      endTime,
      location: settings.location,
      type: "TEST_DRIVE",
      status: "SCHEDULED",
      source: "BOOKING",
      confirmationCode,
      manageToken,
      reminderOffsetMinutes: 1440,
      notes: buildBookingNotes(d),
    },
  });

  await logActivity({
    customerId: customer.id,
    leadId: lead.id,
    type: "APPOINTMENT_SET",
    description: `Booked a test drive online for ${d.date} at ${d.time} (confirmation ${confirmationCode}).`,
  });

  await runAutomation("NEW_LEAD", { customerId: customer.id, leadId: lead.id });
  await runAutomation("APPOINTMENT_CREATED", { customerId: customer.id, leadId: lead.id });
  await recomputeLeadScore(lead.id, salespersonId);

  const url = await baseUrl();
  await notifyAppointmentEvent(appointment.id, "BOOKING_CONFIRMATION", url);

  revalidatePath("/leads");
  revalidatePath("/appointments");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");

  return { success: true, confirmationCode, manageToken };
}

function addMinutes(time: string, minutes: number) {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function buildBookingNotes(d: z.infer<typeof bookingSchema>) {
  const lines: string[] = ["Booked from the public test-drive site."];
  if (d.downPaymentRange) lines.push(`Down payment: ${d.downPaymentRange.replace(/_/g, " ")}`);
  if (d.monthlyPaymentRange) lines.push(`Target monthly payment: ${d.monthlyPaymentRange.replace(/_/g, " ")}`);
  if (d.creditRange) lines.push(`Self-reported credit: ${d.creditRange.replace(/_/g, " ")}`);
  if (d.currentlyDriving) lines.push(`Currently driving a vehicle: ${d.currentlyDriving}`);
  return lines.join("\n");
}

// ── Manage (reschedule / cancel) ─────────────────────────────────────────

export async function getAppointmentByToken(token: string) {
  return prisma.appointment.findUnique({
    where: { manageToken: token },
    include: {
      customer: true,
      vehicle: true,
      salesperson: { select: { firstName: true, lastName: true, phone: true, email: true } },
    },
  });
}

export type ManageActionState = { error?: string; success?: string } | null;

const rescheduleSchema = z.object({ token: z.string().min(1), date: z.string().min(1), time: z.string().min(1) });

export async function rescheduleBookingAppointment(_prev: ManageActionState, formData: FormData): Promise<ManageActionState> {
  const parsed = rescheduleSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: "Please pick a date and time." };
  const { token, date, time } = parsed.data;

  const appt = await prisma.appointment.findUnique({ where: { manageToken: token } });
  if (!appt) return { error: "Appointment not found." };
  if (appt.status === "CANCELLED") return { error: "This appointment was cancelled. Please book a new one." };

  const settings = await getBookingSettings();
  const available = await isSlotAvailable(date, time, settings, appt.id);
  if (!available) return { error: "That time isn't available. Please pick another." };

  const endTime = addMinutes(time, settings.appointmentDurationMinutes);

  await prisma.appointment.update({
    where: { id: appt.id },
    data: { date: new Date(`${date}T00:00:00`), time, endTime, status: "SCHEDULED" },
  });

  // Let the reminder sweep re-fire for the new time.
  await prisma.smsMessage.deleteMany({ where: { appointmentId: appt.id, type: { in: ["REMINDER_24H", "REMINDER_2H"] } } });

  await logActivity({ customerId: appt.customerId, leadId: appt.leadId, type: "APPOINTMENT_RESCHEDULED", description: `Rescheduled online to ${date} at ${time}.` });

  const url = await baseUrl();
  await notifyAppointmentEvent(appt.id, "RESCHEDULED", url);

  revalidatePath("/appointments");
  revalidatePath("/calendar");
  return { success: "Appointment rescheduled." };
}

const cancelSchema = z.object({ token: z.string().min(1) });

export async function cancelBookingAppointment(_prev: ManageActionState, formData: FormData): Promise<ManageActionState> {
  const parsed = cancelSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: "Appointment not found." };

  const appt = await prisma.appointment.findUnique({ where: { manageToken: parsed.data.token }, include: { customer: true } });
  if (!appt) return { error: "Appointment not found." };

  await prisma.appointment.update({ where: { id: appt.id }, data: { status: "CANCELLED" } });
  await logActivity({ customerId: appt.customerId, leadId: appt.leadId, type: "APPOINTMENT_CANCELLED", description: "Cancelled online by the customer." });

  const url = await baseUrl();
  await notifyAppointmentEvent(appt.id, "CANCELLED", url);
  await notifyAdmin({
    userId: appt.salespersonId,
    type: "APPOINTMENT_CANCELLED",
    title: "Appointment cancelled",
    body: `${appt.customer.firstName} ${appt.customer.lastName} cancelled their ${formatDate(appt.date, "EEE, MMM d")} test drive.`,
    link: "/appointments",
    baseUrl: url,
  });

  revalidatePath("/appointments");
  revalidatePath("/calendar");
  return { success: "Appointment cancelled." };
}
