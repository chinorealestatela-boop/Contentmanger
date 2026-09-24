"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireScope } from "@/lib/queries/scope";
import { logActivity } from "@/lib/activity";
import { runAutomation } from "@/lib/automation/engine";
import { notifyAdmin } from "@/lib/notify/adminAlert";
import { notifyAppointmentEvent } from "@/lib/messaging/notify";
import { recomputeLeadScore } from "@/lib/scoring-engine";
import { recordFollowUpAction } from "@/lib/followup";
import { revalidatePath } from "next/cache";
import type { SimpleActionState } from "@/lib/actions/communications";

export type AppointmentActionState = (SimpleActionState & { conflict?: boolean }) | null;

async function baseUrl() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

const schema = z.object({
  customerId: z.string().min(1),
  leadId: z.string().optional(),
  vehicleId: z.string().optional(),
  date: z.string().min(1, "Date is required."),
  time: z.string().min(1, "Time is required."),
  endTime: z.string().optional(),
  location: z.string().optional(),
  type: z.string().default("SALES_APPOINTMENT"),
  notes: z.string().optional(),
  salespersonId: z.string().optional(),
});

function parseReminderField(raw: FormDataEntryValue | null): number | null {
  if (!raw || raw === "NONE") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Minutes since midnight for an "HH:mm" string. */
function minutesOf(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Whether [aStart,aEnd) overlaps [bStart,bEnd), all in minutes-since-midnight.
 * A missing end time is treated as a 30-minute placeholder slot. */
function rangesOverlap(aStart: number, aEnd: number | null, bStart: number, bEnd: number | null) {
  const aE = aEnd ?? aStart + 30;
  const bE = bEnd ?? bStart + 30;
  return aStart < bE && bStart < aE;
}

/** Finds another appointment for the same salesperson, on the same day, whose
 * time range overlaps the requested slot. Cancelled appointments never
 * conflict — a freed-up slot is bookable again. `excludeId` skips the
 * appointment being edited so it doesn't collide with itself.
 *
 * This is a separate, looser check than the public booking site's
 * `isSlotAvailable` (src/lib/availability.ts), which is deliberately: admin
 * scheduling in the CRM has never been constrained to the customer-facing
 * booking-hours grid (createAppointment above never called it either), and
 * this preserves that flexibility while still catching a real double-book. */
async function findConflict(params: {
  salespersonId: string;
  date: Date;
  time: string;
  endTime?: string | null;
  excludeId?: string;
}) {
  const dayStart = new Date(params.date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const candidates = await prisma.appointment.findMany({
    where: {
      salespersonId: params.salespersonId,
      date: { gte: dayStart, lt: dayEnd },
      status: { not: "CANCELLED" },
      ...(params.excludeId ? { id: { not: params.excludeId } } : {}),
    },
    include: { customer: { select: { firstName: true, lastName: true } } },
  });

  const start = minutesOf(params.time);
  const end = params.endTime ? minutesOf(params.endTime) : null;

  return candidates.find((c) => rangesOverlap(start, end, minutesOf(c.time), c.endTime ? minutesOf(c.endTime) : null)) ?? null;
}

function conflictMessage(conflict: { time: string; endTime: string | null; customer: { firstName: string; lastName: string } }) {
  return `CONFLICT: This salesperson already has an appointment with ${conflict.customer.firstName} ${conflict.customer.lastName} at ${conflict.time}${conflict.endTime ? `–${conflict.endTime}` : ""} that day. Choose a different time, or confirm to schedule anyway.`;
}

/** Clears any reminder already sent for this appointment so the 24h/2h
 * sweep (src/lib/actions/reminders.ts) re-arms against its new time —
 * reminders here are tracked by the presence of an SmsMessage/EmailMessage
 * row, not a boolean, so "resetting" means deleting those rows. */
async function clearSentReminders(appointmentId: string) {
  await Promise.all([
    prisma.smsMessage.deleteMany({ where: { appointmentId, type: { in: ["REMINDER_24H", "REMINDER_2H"] } } }),
    prisma.emailMessage.deleteMany({ where: { appointmentId, type: "REMINDER" } }),
  ]);
}

export async function createAppointment(_prev: AppointmentActionState, formData: FormData): Promise<AppointmentActionState> {
  const scope = await requireScope();
  const parsed = schema.safeParse({
    customerId: formData.get("customerId"),
    leadId: formData.get("leadId") || undefined,
    vehicleId: formData.get("vehicleId") || undefined,
    date: formData.get("date"),
    time: formData.get("time"),
    endTime: formData.get("endTime") || undefined,
    location: formData.get("location") || undefined,
    type: formData.get("type") || "SALES_APPOINTMENT",
    notes: formData.get("notes") || undefined,
    salespersonId: formData.get("salespersonId") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const salespersonId = parsed.data.salespersonId || scope.userId;
  const reminderOffsetMinutes = parseReminderField(formData.get("reminderOffsetMinutes"));
  const date = new Date(parsed.data.date);

  if (formData.get("confirmOverride") !== "true") {
    const conflict = await findConflict({ salespersonId, date, time: parsed.data.time, endTime: parsed.data.endTime });
    if (conflict) return { error: conflictMessage(conflict), conflict: true };
  }

  await prisma.appointment.create({
    data: {
      customerId: parsed.data.customerId,
      leadId: parsed.data.leadId,
      vehicleId: parsed.data.vehicleId,
      date,
      time: parsed.data.time,
      endTime: parsed.data.endTime,
      location: parsed.data.location,
      type: parsed.data.type,
      notes: parsed.data.notes,
      salespersonId,
      reminderOffsetMinutes,
    },
  });

  await logActivity({
    customerId: parsed.data.customerId,
    leadId: parsed.data.leadId,
    type: "APPOINTMENT",
    description: `${parsed.data.type.replace(/_/g, " ").toLowerCase()} appointment scheduled for ${parsed.data.date} at ${parsed.data.time}.`,
    actorId: scope.userId,
  });

  await runAutomation("APPOINTMENT_CREATED", { customerId: parsed.data.customerId, leadId: parsed.data.leadId, actorId: scope.userId });
  await recordFollowUpAction({
    customerId: parsed.data.customerId,
    leadId: parsed.data.leadId,
    actorId: scope.userId,
    taskTypes: ["APPOINTMENT", "FOLLOW_UP", "OTHER"],
    source: "Appointment scheduled",
  });

  const activeLead = await prisma.lead.findFirst({ where: { customerId: parsed.data.customerId, status: "ACTIVE" } });
  if (activeLead) await recomputeLeadScore(activeLead.id, scope.userId);

  revalidatePath("/appointments");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath(`/customers/${parsed.data.customerId}`);
  return { success: "Appointment scheduled." };
}

export async function updateAppointmentStatus(appointmentId: string, status: string) {
  const scope = await requireScope();
  const appt = await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status },
    include: { customer: true },
  });

  const lead = await prisma.lead.findFirst({ where: { customerId: appt.customerId, status: "ACTIVE" }, orderBy: { createdAt: "desc" } });

  await logActivity({
    customerId: appt.customerId,
    leadId: lead?.id,
    type: "APPOINTMENT",
    description: `Appointment marked ${status.replace(/_/g, " ").toLowerCase()}.`,
    actorId: scope.userId,
  });

  if (status === "NO_SHOW") {
    await runAutomation("APPOINTMENT_NO_SHOW", { customerId: appt.customerId, leadId: lead?.id, actorId: scope.userId });
    // Deliberately NOT a qualifying follow-up action — a no-show means
    // more follow-up is needed, not less.
  } else if (status === "COMPLETED") {
    await runAutomation("APPOINTMENT_COMPLETED", { customerId: appt.customerId, leadId: lead?.id, actorId: scope.userId });
  } else if (status === "CANCELLED") {
    await notifyAdmin({
      userId: appt.salespersonId,
      type: "APPOINTMENT_CANCELLED",
      title: "Appointment cancelled",
      body: `${appt.customer.firstName} ${appt.customer.lastName}'s appointment was marked cancelled.`,
      link: `/customers/${appt.customerId}`,
    });
  }

  if (lead) await recomputeLeadScore(lead.id, scope.userId);

  // CONFIRMED/SHOWED/COMPLETED are genuine follow-up touches; NO_SHOW and
  // CANCELLED are deliberately excluded above.
  if (["CONFIRMED", "SHOWED", "COMPLETED"].includes(status)) {
    await recordFollowUpAction({
      customerId: appt.customerId,
      leadId: lead?.id,
      actorId: scope.userId,
      taskTypes: ["APPOINTMENT", "FOLLOW_UP", "OTHER"],
      source: `Appointment marked ${status.replace(/_/g, " ").toLowerCase()}`,
    });
  }

  revalidatePath("/appointments");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath(`/customers/${appt.customerId}`);
}

const editSchema = schema.extend({
  appointmentId: z.string().min(1),
});

/** Full edit: every field on the appointment is editable in place. There is
 * exactly one row per appointment before and after this call — nothing is
 * duplicated — so the calendar, the customer profile, and the reminder/
 * message system all see the same updated record on their next read. When
 * the date/time actually changes, this behaves like a reschedule: pending
 * SMS/email reminders are cleared so they re-fire for the new time, and — if
 * the appointment came from the public booking site (has a manageToken) —
 * the customer gets the same "Appointment Rescheduled" SMS/email a
 * self-service reschedule would send. */
export async function updateAppointment(_prev: AppointmentActionState, formData: FormData): Promise<AppointmentActionState> {
  const scope = await requireScope();
  const parsed = editSchema.safeParse({
    appointmentId: formData.get("appointmentId"),
    customerId: formData.get("customerId"),
    leadId: formData.get("leadId") || undefined,
    vehicleId: formData.get("vehicleId") || undefined,
    date: formData.get("date"),
    time: formData.get("time"),
    endTime: formData.get("endTime") || undefined,
    location: formData.get("location") || undefined,
    type: formData.get("type") || "SALES_APPOINTMENT",
    notes: formData.get("notes") || undefined,
    salespersonId: formData.get("salespersonId") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const original = await prisma.appointment.findUnique({ where: { id: parsed.data.appointmentId } });
  if (!original) return { error: "Appointment not found." };

  const salespersonId = parsed.data.salespersonId || original.salespersonId;
  const reminderOffsetMinutes = parseReminderField(formData.get("reminderOffsetMinutes"));
  const date = new Date(parsed.data.date);

  const dateChanged = date.toDateString() !== new Date(original.date).toDateString();
  const timeChanged = parsed.data.time !== original.time || (parsed.data.endTime ?? null) !== original.endTime;
  const isReschedule = dateChanged || timeChanged;

  if (isReschedule && formData.get("confirmOverride") !== "true") {
    const conflict = await findConflict({
      salespersonId,
      date,
      time: parsed.data.time,
      endTime: parsed.data.endTime,
      excludeId: original.id,
    });
    if (conflict) return { error: conflictMessage(conflict), conflict: true };
  }

  // Bringing a cancelled/no-show/completed appointment back to a new date or
  // time means it's active again; otherwise leave the current status alone
  // (e.g. a CONFIRMED appointment whose location changes stays CONFIRMED —
  // editing details never silently marks something completed/cancelled).
  const status = isReschedule && ["CANCELLED", "NO_SHOW", "COMPLETED"].includes(original.status) ? "SCHEDULED" : original.status;

  const updated = await prisma.appointment.update({
    where: { id: original.id },
    data: {
      customerId: parsed.data.customerId,
      leadId: parsed.data.leadId ?? null,
      vehicleId: parsed.data.vehicleId ?? null,
      date,
      time: parsed.data.time,
      endTime: parsed.data.endTime ?? null,
      location: parsed.data.location ?? null,
      type: parsed.data.type,
      notes: parsed.data.notes ?? null,
      salespersonId,
      reminderOffsetMinutes,
      status,
    },
  });

  const actorName = scope.userName;
  if (isReschedule) {
    await clearSentReminders(original.id);
    await notifyAppointmentEvent(updated.id, "RESCHEDULED", await baseUrl());
    await logActivity({
      customerId: original.customerId,
      leadId: updated.leadId,
      type: "APPOINTMENT_RESCHEDULED",
      description: `Appointment rescheduled from ${formatShort(original.date, original.time)} to ${formatShort(updated.date, updated.time)} by ${actorName}.`,
      actorId: scope.userId,
      metadata: { appointmentId: updated.id, from: { date: original.date, time: original.time }, to: { date: updated.date, time: updated.time } },
    });
    await recordFollowUpAction({
      customerId: updated.customerId,
      leadId: updated.leadId,
      actorId: scope.userId,
      taskTypes: ["APPOINTMENT", "FOLLOW_UP", "OTHER"],
      source: "Appointment rescheduled",
    });
  } else {
    await logActivity({
      customerId: original.customerId,
      leadId: updated.leadId,
      type: "APPOINTMENT_UPDATED",
      description: `Appointment details updated by ${actorName}.`,
      actorId: scope.userId,
      metadata: { appointmentId: updated.id },
    });
  }

  const lead = await prisma.lead.findFirst({ where: { customerId: updated.customerId, status: "ACTIVE" } });
  if (lead) await recomputeLeadScore(lead.id, scope.userId);

  // If the appointment moved to a different customer, both profiles need
  // their calendar/timeline refreshed, not just the new one.
  if (original.customerId !== updated.customerId) {
    revalidatePath(`/customers/${original.customerId}`);
  }

  revalidatePath("/appointments");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath(`/customers/${updated.customerId}`);
  return { success: isReschedule ? "Appointment successfully rescheduled." : "Appointment updated." };
}

const rescheduleSchema = z.object({
  appointmentId: z.string().min(1),
  date: z.string().min(1, "New date is required."),
  time: z.string().min(1, "New time is required."),
  endTime: z.string().optional(),
});

/** Lightweight date/time-only reschedule, for the quick "Reschedule" action
 * on a calendar row or customer profile — same in-place-update semantics as
 * updateAppointment, without requiring the full edit form. */
export async function rescheduleAppointment(_prev: AppointmentActionState, formData: FormData): Promise<AppointmentActionState> {
  const scope = await requireScope();
  const parsed = rescheduleSchema.safeParse({
    appointmentId: formData.get("appointmentId"),
    date: formData.get("date"),
    time: formData.get("time"),
    endTime: formData.get("endTime") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const original = await prisma.appointment.findUnique({ where: { id: parsed.data.appointmentId } });
  if (!original) return { error: "Appointment not found." };

  const date = new Date(parsed.data.date);
  const endTime = parsed.data.endTime ?? original.endTime ?? undefined;

  if (formData.get("confirmOverride") !== "true") {
    const conflict = await findConflict({
      salespersonId: original.salespersonId,
      date,
      time: parsed.data.time,
      endTime,
      excludeId: original.id,
    });
    if (conflict) return { error: conflictMessage(conflict), conflict: true };
  }

  const status = ["CANCELLED", "NO_SHOW", "COMPLETED"].includes(original.status) ? "SCHEDULED" : original.status;

  const updated = await prisma.appointment.update({
    where: { id: original.id },
    data: { date, time: parsed.data.time, endTime: endTime ?? null, status },
  });

  await clearSentReminders(original.id);
  await notifyAppointmentEvent(updated.id, "RESCHEDULED", await baseUrl());

  await logActivity({
    customerId: original.customerId,
    leadId: original.leadId,
    type: "APPOINTMENT_RESCHEDULED",
    description: `Appointment rescheduled from ${formatShort(original.date, original.time)} to ${formatShort(updated.date, updated.time)} by ${scope.userName}.`,
    actorId: scope.userId,
    metadata: { appointmentId: updated.id, from: { date: original.date, time: original.time }, to: { date: updated.date, time: updated.time } },
  });

  const lead = await prisma.lead.findFirst({ where: { customerId: original.customerId, status: "ACTIVE" } });
  if (lead) await recomputeLeadScore(lead.id, scope.userId);
  await recordFollowUpAction({
    customerId: original.customerId,
    leadId: lead?.id,
    actorId: scope.userId,
    taskTypes: ["APPOINTMENT", "FOLLOW_UP", "OTHER"],
    source: "Appointment rescheduled",
  });

  revalidatePath("/appointments");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath(`/customers/${original.customerId}`);
  return { success: "Appointment successfully rescheduled." };
}

function formatShort(date: Date, time: string) {
  const d = new Date(date);
  const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${dateStr} at ${hour12}:${String(m).padStart(2, "0")} ${period}`;
}
