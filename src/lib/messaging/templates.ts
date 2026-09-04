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

// What to bring + arrival instructions are shared verbatim across the
// confirmation SMS, email, and webpage (see BookingWizard's confirmation
// screen and ManagePanel) — one source of copy so all three always agree.
export const WHAT_TO_BRING = [
  "Most recent pay stub — OR 3 months of bank statements if self-employed",
  "Government-issued ID",
  "Utility bill (gas, water, power, or cell phone) — OR a bank statement",
];

export function arrivalInstruction(ctx: Pick<MessageContext, "settings">): string {
  return `When you arrive, please let the staff know you're here for your test drive with ${ctx.settings.agentName}.`;
}

// ── SMS ──────────────────────────────────────────────────────────────────
// Every text ends with the compliance footer once, in the confirmation
// message; follow-ups stay short since it's an ongoing conversation thread
// (carriers/A2P guidance: include opt-out info periodically, not on every
// single message in a thread).

const SMS_FOOTER = "Reply STOP to opt out, HELP for help. Msg & data rates may apply.";

export function smsBookingConfirmation(ctx: MessageContext): string {
  return (
    `Hi ${ctx.customerFirstName}! Your test drive with ${ctx.settings.agentName} is confirmed for ${when(ctx)}.\n\n` +
    `To help make your car-buying process go as smoothly as possible, please bring:\n` +
    `• ${WHAT_TO_BRING[0]}\n` +
    `• ${WHAT_TO_BRING[1]}\n` +
    `• ${WHAT_TO_BRING[2]}\n\n` +
    `${arrivalInstruction(ctx)}\n\n` +
    `${ctx.settings.location}\n` +
    `${ctx.dealershipPhone}\n\n` +
    `Confirmation #${ctx.confirmationCode}. Manage this booking: ${ctx.manageUrl}\n` +
    `${SMS_FOOTER}`
  );
}

export function smsReminder24h(ctx: MessageContext): string {
  return (
    `Hi ${ctx.customerFirstName}, it's ${ctx.settings.agentName} at ${ctx.dealershipName} — just confirming your test drive tomorrow ` +
    `at ${formatTime12h(ctx.time)}. Don't forget your pay stub or bank statements, ID, and a utility bill or bank statement. See you then! Need to reschedule? ${ctx.manageUrl}`
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
// Body stays light/white — many email clients render dark-mode HTML
// unpredictably, so the red/black brand identity lives in the header band
// and accent colors instead of the whole message background.

function emailShell(ctx: MessageContext, heading: string, body: string) {
  return `
<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;color:#171717">
  <div style="background:#000000;padding:20px 24px;border-radius:12px 12px 0 0;border-bottom:3px solid #e2141f">
    <p style="margin:0;color:#fff;font-size:18px;font-weight:700">${ctx.dealershipName}</p>
  </div>
  <div style="border:1px solid #e5e5e5;border-top:none;padding:24px;border-radius:0 0 12px 12px">
    <h1 style="font-size:22px;margin:0 0 12px;color:#111">${heading}</h1>
    ${body}
    <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0" />
    <p style="font-size:12.5px;color:#6e6e6e;margin:0">
      ${ctx.settings.agentName} · ${ctx.dealershipName} · ${ctx.dealershipPhone}<br />
      Manage this appointment: <a href="${ctx.manageUrl}" style="color:#e2141f">${ctx.manageUrl}</a>
    </p>
  </div>
</div>`.trim();
}

function detailsTable(ctx: MessageContext) {
  return `
<table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0">
  <tr><td style="padding:6px 0;color:#6e6e6e;width:120px">Vehicle</td><td style="padding:6px 0;font-weight:600">${ctx.vehicleLabel}</td></tr>
  <tr><td style="padding:6px 0;color:#6e6e6e">Date</td><td style="padding:6px 0;font-weight:600">${formatDate(ctx.date, "EEEE, MMMM d, yyyy")}</td></tr>
  <tr><td style="padding:6px 0;color:#6e6e6e">Time</td><td style="padding:6px 0;font-weight:600">${formatTime12h(ctx.time)}</td></tr>
  <tr><td style="padding:6px 0;color:#6e6e6e">Location</td><td style="padding:6px 0;font-weight:600">${ctx.settings.location}</td></tr>
  <tr><td style="padding:6px 0;color:#6e6e6e">Confirmation #</td><td style="padding:6px 0;font-weight:600">${ctx.confirmationCode}</td></tr>
</table>`.trim();
}

function whatToBringBlock() {
  return `
<div style="background:#faf6f6;border:1px solid #f2d5d6;border-left:4px solid #e2141f;border-radius:8px;padding:14px 16px;margin:16px 0">
  <p style="margin:0 0 8px;font-weight:700;font-size:13.5px;color:#111">Please Bring</p>
  <ul style="margin:0;padding-left:18px;font-size:13.5px;line-height:1.6;color:#333">
    ${WHAT_TO_BRING.map((item) => `<li>${item}</li>`).join("")}
  </ul>
  <p style="margin:10px 0 0;font-size:12.5px;color:#6e6e6e">To help make your car-buying process go as smoothly as possible, please bring this information with you.</p>
</div>`.trim();
}

export function emailBookingConfirmation(ctx: MessageContext): { subject: string; html: string } {
  return {
    subject: `Test Drive Confirmed — ${ctx.vehicleLabel}`,
    html: emailShell(
      ctx,
      "TEST DRIVE CONFIRMED 🎉",
      `<p>Hi ${ctx.customerFirstName},</p>
       <p>Your test drive with ${ctx.settings.agentName} has been confirmed.</p>
       ${detailsTable(ctx)}
       ${whatToBringBlock()}
       <p style="font-weight:600">${arrivalInstruction(ctx)}</p>
       <p>Questions? Call <a href="tel:${ctx.dealershipPhone.replace(/[^\d+]/g, "")}" style="color:#e2141f">${ctx.dealershipPhone}</a>.</p>`
    ),
  };
}

export function emailReminder(ctx: MessageContext): { subject: string; html: string } {
  return {
    subject: `Reminder: your test drive is coming up — ${ctx.vehicleLabel}`,
    html: emailShell(
      ctx,
      "See you soon!",
      `<p>Hi ${ctx.customerFirstName}, just a reminder about your upcoming test drive:</p>${detailsTable(ctx)}${whatToBringBlock()}<p style="font-weight:600">${arrivalInstruction(ctx)}</p>`
    ),
  };
}

export function emailRescheduled(ctx: MessageContext): { subject: string; html: string } {
  return {
    subject: `Your test drive was rescheduled — ${ctx.vehicleLabel}`,
    html: emailShell(
      ctx,
      "Appointment rescheduled",
      `<p>Hi ${ctx.customerFirstName}, your test drive has been moved. Updated details:</p>${detailsTable(ctx)}${whatToBringBlock()}<p style="font-weight:600">${arrivalInstruction(ctx)}</p>`
    ),
  };
}

export function emailCancelled(ctx: MessageContext): { subject: string; html: string } {
  return {
    subject: `Your test drive has been cancelled — ${ctx.vehicleLabel}`,
    html: emailShell(
      ctx,
      "Appointment cancelled",
      `<p>Hi ${ctx.customerFirstName}, your test drive for the ${ctx.vehicleLabel} on ${formatDate(ctx.date, "EEEE, MMMM d")} at ${formatTime12h(ctx.time)} has been cancelled. Whenever you're ready, come book another time.</p>`
    ),
  };
}
