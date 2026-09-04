"use server";

// Reminder sweep. Same "no background job runner" constraint as the
// automation engine's time-based checks (see src/lib/automation/engine.ts)
// — appointments have no discrete "24 hours before" event to hook, so this
// scans for appointments that are due a reminder right now and sends it.
//
// Wire this to run automatically in production via ONE of:
//   1. An external scheduler hitting GET /api/cron/reminders every ~15min
//      (Vercel Cron, cron-job.org, GitHub Actions schedule, etc.) with
//      header `x-cron-secret: <CRON_SECRET>` — see src/app/api/cron/reminders/route.ts.
//   2. Manually, via "Run Reminder Checks Now" on Settings → Booking.
// Idempotent either way: a reminder is only ever sent once per appointment
// per type, tracked by the presence of a matching SmsMessage/EmailMessage row.

import { prisma } from "@/lib/prisma";
import { notifyAppointmentEvent } from "@/lib/messaging/notify";
import { notifyAdmin } from "@/lib/notify/adminAlert";
import { formatDate, formatTime12h } from "@/lib/format";

const ACTIVE_STATUSES = ["SCHEDULED", "CONFIRMED"];

export async function sendPendingReminders(baseUrl: string): Promise<{ sent24h: number; sent2h: number; checked: number }> {
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 3600000);
  const in2h = new Date(now.getTime() + 2 * 3600000);

  // Pull every upcoming appointment in the next ~25 hours once, then bucket
  // it in memory — cheaper than two overlapping date-range queries and
  // keeps the "already sent?" check trivial.
  const windowEnd = new Date(now.getTime() + 25 * 3600000);
  const candidates = await prisma.appointment.findMany({
    where: {
      status: { in: ACTIVE_STATUSES },
      date: { gte: new Date(now.toDateString()), lte: windowEnd },
    },
    include: {
      smsMessages: { select: { type: true } },
      emailMessages: { select: { type: true } },
      customer: { select: { firstName: true, lastName: true } },
    },
  });

  let sent24h = 0;
  let sent2h = 0;

  for (const appt of candidates) {
    const startsAt = appointmentDateTime(appt.date, appt.time);
    if (startsAt < now) continue;

    const already24h = appt.smsMessages.some((m) => m.type === "REMINDER_24H") || appt.emailMessages.some((m) => m.type === "REMINDER");
    const already2h = appt.smsMessages.some((m) => m.type === "REMINDER_2H");

    if (!already24h && startsAt <= in24h) {
      await notifyAppointmentEvent(appt.id, "REMINDER_24H", baseUrl);
      await notifyStaffOfReminder(appt, "tomorrow");
      sent24h++;
    }
    if (!already2h && startsAt <= in2h) {
      await notifyAppointmentEvent(appt.id, "REMINDER_2H", baseUrl);
      await notifyStaffOfReminder(appt, "in about 2 hours");
      sent2h++;
    }
  }

  return { sent24h, sent2h, checked: candidates.length };
}

function appointmentDateTime(date: Date, time: string): Date {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
}

type ReminderCandidate = { id: string; salespersonId: string; date: Date; time: string; customer: { firstName: string; lastName: string } };

/** Reminds the assigned salesperson too, not just the customer — the same
 * "Appointment Reminder" category shown in Settings → Notifications, with
 * its own independent Push/SMS/Email toggles. */
async function notifyStaffOfReminder(appt: ReminderCandidate, when: string) {
  await notifyAdmin({
    userId: appt.salespersonId,
    type: "APPOINTMENT_REMINDER",
    title: `Upcoming test drive ${when}`,
    body: `${appt.customer.firstName} ${appt.customer.lastName} — ${formatDate(appt.date, "EEE, MMM d")} at ${formatTime12h(appt.time)}`,
    link: `/appointments`,
  });
}
