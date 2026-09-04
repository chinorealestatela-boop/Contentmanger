// Ties an appointment lifecycle event to the actual SMS + email sends.
// Single entry point used by the booking action, the reschedule/cancel
// actions, and the reminder sweep (src/lib/actions/reminders.ts) so the
// "who gets notified, with what copy" decision lives in one place.

import { prisma } from "@/lib/prisma";
import { getBookingSettings } from "@/lib/availability";
import { sendSms, type SmsType } from "@/lib/sms/provider";
import { sendEmail, type EmailType } from "@/lib/email/provider";
import * as tpl from "@/lib/messaging/templates";
import type { MessageContext } from "@/lib/messaging/templates";

export type AppointmentEvent = "BOOKING_CONFIRMATION" | "REMINDER_24H" | "REMINDER_2H" | "RESCHEDULED" | "CANCELLED";

async function getDealershipInfo() {
  const row = await prisma.setting.findUnique({ where: { key: "dealership" } });
  const parsed = row ? JSON.parse(row.value) : {};
  return {
    name: parsed.name || "AutoMax LV",
    phone: parsed.phone || "702-325-3898",
  };
}

export async function vehicleLabelForAppointment(appointmentId: string): Promise<string> {
  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { vehicle: true, customer: { include: { vehicleInterests: { where: { isPrimary: true }, take: 1 } } } },
  });
  if (!appt) return "the vehicle";
  if (appt.vehicle) return `${appt.vehicle.year} ${appt.vehicle.make} ${appt.vehicle.model}${appt.vehicle.trim ? ` ${appt.vehicle.trim}` : ""}`;
  const interest = appt.customer.vehicleInterests[0];
  if (interest) {
    const parts = [interest.year, interest.make, interest.model, interest.trim].filter(Boolean);
    if (parts.length) return parts.join(" ");
  }
  return "the vehicle";
}

export async function notifyAppointmentEvent(appointmentId: string, event: AppointmentEvent, baseUrl: string) {
  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { customer: true },
  });
  if (!appt || !appt.manageToken || !appt.confirmationCode) return { smsResult: null, emailResult: null };

  const [settings, dealership, vehicleLabel] = await Promise.all([
    getBookingSettings(),
    getDealershipInfo(),
    vehicleLabelForAppointment(appointmentId),
  ]);

  const ctx: MessageContext = {
    customerFirstName: appt.customer.firstName,
    vehicleLabel,
    date: appt.date,
    time: appt.time,
    confirmationCode: appt.confirmationCode,
    manageUrl: `${baseUrl}/manage/${appt.manageToken}`,
    settings,
    dealershipName: dealership.name,
    dealershipPhone: dealership.phone,
  };

  const smsMap: Record<AppointmentEvent, { type: SmsType; body: string } | null> = {
    BOOKING_CONFIRMATION: settings.reminders.sendImmediateConfirmation
      ? { type: "BOOKING_CONFIRMATION", body: tpl.smsBookingConfirmation(ctx) }
      : null,
    REMINDER_24H: settings.reminders.send24HourReminder ? { type: "REMINDER_24H", body: tpl.smsReminder24h(ctx) } : null,
    REMINDER_2H: settings.reminders.send2HourReminder ? { type: "REMINDER_2H", body: tpl.smsReminder2h(ctx) } : null,
    RESCHEDULED: { type: "RESCHEDULED", body: tpl.smsRescheduled(ctx) },
    CANCELLED: { type: "CANCELLED", body: tpl.smsCancelled(ctx) },
  };

  const emailMap: Record<AppointmentEvent, { type: EmailType; subject: string; html: string } | null> = {
    BOOKING_CONFIRMATION: { type: "BOOKING_CONFIRMATION", ...tpl.emailBookingConfirmation(ctx) },
    REMINDER_24H: { type: "REMINDER", ...tpl.emailReminder(ctx) },
    REMINDER_2H: null, // email reminder only once, at 24h — SMS carries the 2h nudge
    RESCHEDULED: { type: "RESCHEDULED", ...tpl.emailRescheduled(ctx) },
    CANCELLED: { type: "CANCELLED", ...tpl.emailCancelled(ctx) },
  };

  let smsResult = null;
  const smsPlan = smsMap[event];
  if (smsPlan && appt.customer.smsConsent && appt.customer.phone) {
    smsResult = await sendSms({
      customerId: appt.customerId,
      appointmentId: appt.id,
      toPhone: appt.customer.phone,
      type: smsPlan.type,
      body: smsPlan.body,
      statusCallbackUrl: `${baseUrl}/api/webhooks/twilio`,
    });
  }

  let emailResult = null;
  const emailPlan = emailMap[event];
  if (emailPlan && appt.customer.email) {
    emailResult = await sendEmail({
      customerId: appt.customerId,
      appointmentId: appt.id,
      toEmail: appt.customer.email,
      type: emailPlan.type,
      subject: emailPlan.subject,
      html: emailPlan.html,
    });
  }

  return { smsResult, emailResult };
}
