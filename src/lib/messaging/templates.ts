// Message copy for every automated SMS/email the booking site sends.
// Pure string-building — no I/O — so it's easy to preview/test and so the
// actual send functions (src/lib/sms/provider.ts, src/lib/email/provider.ts)
// stay focused on transport.

import { formatDate, formatTime12h } from "@/lib/format";
import type { BookingSettings } from "@/lib/availability";

export type MessageContext = {
  customerFirstName: string;
  vehicleLabel: string;
  date: Date;
  time: string; // "HH:mm"
  confirmationCode: string;
  manageUrl: string; // absolute URL to the reschedule/cancel page
  settings: Pick<BookingSettings, "agentName" | "location">;
  dealershipName: string;
  dealershipPhone: string;
};

function when(ctx: MessageContext) {
  return `${formatDate(ctx.date, "EEEE, MMM d")} at ${formatTime12h(ctx.time)}`;
}

// ── SMS ──────────────────────────────────────────────────────────────────
// Every text ends with the compliance footer once, in the confirmation
// message; follow-ups stay short since it's an ongoing conversation thread
// (carriers/A2P guidance: include opt-out info periodically, not on every
// single message in a thread).

const SMS_FOOTER = "Reply STOP to opt out, HELP for help. Msg & data rates may apply.";

export function smsBookingConfirmation(ctx: MessageContext): string {
  return (
    `Hey ${ctx.customerFirstName}, this is ${ctx.settings.agentName} at ${ctx.dealershipName}. ` +
    `Your test drive for the ${ctx.vehicleLabel} is confirmed for ${when(ctx)} at ${ctx.settings.location}. ` +
    `Confirmation #${ctx.confirmationCode}. Reply here if you need to make changes, or manage it at ${ctx.manageUrl}. Looking forward to seeing you! ${SMS_FOOTER}`
  );
}

export function smsReminder24h(ctx: MessageContext): string {
  return (
    `Hi ${ctx.customerFirstName}, it's ${ctx.settings.agentName} at ${ctx.dealershipName} — just confirming your test drive tomorrow for the ${ctx.vehicleLabel} ` +
    `at ${formatTime12h(ctx.time)}. See you then! Need to reschedule? ${ctx.manageUrl}`
  );
}

export function smsReminder2h(ctx: MessageContext): string {
  return (
    `${ctx.customerFirstName}, see you soon! Your test drive for the ${ctx.vehicleLabel} is in about 2 hours (${formatTime12h(ctx.time)}) at ${ctx.settings.location}. ` +
    `Text me if anything comes up — ${ctx.settings.agentName}.`
  );
}

export function smsRescheduled(ctx: MessageContext): string {
  return (
    `${ctx.customerFirstName}, your test drive for the ${ctx.vehicleLabel} has been moved to ${when(ctx)} at ${ctx.settings.location}. ` +
    `Confirmation #${ctx.confirmationCode}. Manage it anytime at ${ctx.manageUrl} — ${ctx.settings.agentName}.`
  );
}

export function smsCancelled(ctx: MessageContext): string {
  return (
    `${ctx.customerFirstName}, your test drive for the ${ctx.vehicleLabel} on ${when(ctx)} has been cancelled. ` +
    `Whenever you're ready to reschedule, just book again or text me — ${ctx.settings.agentName} at ${ctx.dealershipName}.`
  );
}

// ── Email ────────────────────────────────────────────────────────────────

function emailShell(ctx: MessageContext, heading: string, body: string) {
  return `
<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;color:#0f172a">
  <div style="background:#0b1220;padding:20px 24px;border-radius:12px 12px 0 0">
    <p style="margin:0;color:#fff;font-size:18px;font-weight:700">${ctx.dealershipName}</p>
  </div>
  <div style="border:1px solid #e2e6ee;border-top:none;padding:24px;border-radius:0 0 12px 12px">
    <h1 style="font-size:20px;margin:0 0 12px">${heading}</h1>
    ${body}
    <hr style="border:none;border-top:1px solid #e2e6ee;margin:24px 0" />
    <p style="font-size:12.5px;color:#5b6478;margin:0">
      ${ctx.settings.agentName} · ${ctx.dealershipName} · ${ctx.dealershipPhone}<br />
      Manage this appointment: <a href="${ctx.manageUrl}" style="color:#2455e6">${ctx.manageUrl}</a>
    </p>
  </div>
</div>`.trim();
}

function detailsTable(ctx: MessageContext) {
  return `
<table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0">
  <tr><td style="padding:6px 0;color:#5b6478;width:120px">Vehicle</td><td style="padding:6px 0;font-weight:600">${ctx.vehicleLabel}</td></tr>
  <tr><td style="padding:6px 0;color:#5b6478">Date</td><td style="padding:6px 0;font-weight:600">${formatDate(ctx.date, "EEEE, MMMM d, yyyy")}</td></tr>
  <tr><td style="padding:6px 0;color:#5b6478">Time</td><td style="padding:6px 0;font-weight:600">${formatTime12h(ctx.time)}</td></tr>
  <tr><td style="padding:6px 0;color:#5b6478">Location</td><td style="padding:6px 0;font-weight:600">${ctx.settings.location}</td></tr>
  <tr><td style="padding:6px 0;color:#5b6478">Confirmation #</td><td style="padding:6px 0;font-weight:600">${ctx.confirmationCode}</td></tr>
</table>`.trim();
}

export function emailBookingConfirmation(ctx: MessageContext): { subject: string; html: string } {
  return {
    subject: `You're booked! Test drive confirmed — ${ctx.vehicleLabel}`,
    html: emailShell(
      ctx,
      "You're booked! 🎉",
      `<p>Hey ${ctx.customerFirstName}, your test drive is all set. Here are the details:</p>${detailsTable(ctx)}<p>Reply to this email or text ${ctx.settings.agentName} if anything needs to change. See you soon!</p>`
    ),
  };
}

export function emailReminder(ctx: MessageContext): { subject: string; html: string } {
  return {
    subject: `Reminder: your test drive is coming up — ${ctx.vehicleLabel}`,
    html: emailShell(
      ctx,
      "See you soon!",
      `<p>Hey ${ctx.customerFirstName}, just a reminder about your upcoming test drive:</p>${detailsTable(ctx)}`
    ),
  };
}

export function emailRescheduled(ctx: MessageContext): { subject: string; html: string } {
  return {
    subject: `Your test drive was rescheduled — ${ctx.vehicleLabel}`,
    html: emailShell(
      ctx,
      "Appointment rescheduled",
      `<p>Hey ${ctx.customerFirstName}, your test drive has been moved. Updated details:</p>${detailsTable(ctx)}`
    ),
  };
}

export function emailCancelled(ctx: MessageContext): { subject: string; html: string } {
  return {
    subject: `Your test drive has been cancelled — ${ctx.vehicleLabel}`,
    html: emailShell(
      ctx,
      "Appointment cancelled",
      `<p>Hey ${ctx.customerFirstName}, your test drive for the ${ctx.vehicleLabel} on ${formatDate(ctx.date, "EEEE, MMMM d")} at ${formatTime12h(ctx.time)} has been cancelled. Whenever you're ready, come book another time.</p>`
    ),
  };
}
