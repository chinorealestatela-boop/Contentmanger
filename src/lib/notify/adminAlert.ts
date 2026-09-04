// Central "alert the salesperson" fan-out — the one function everything
// that needs to notify staff (the automation engine's NOTIFY action, the
// reminder sweep, appointment cancellation) calls into. Always creates the
// in-app Notification-center row (that part is not optional — the bell
// always shows every event), then additionally pushes/texts/emails the
// recipient for exactly the channels they've turned on for that event type
// in Settings → Notifications, logging per-channel success/failure back
// onto the same row so it's visible later (see the Notification schema
// comment).
//
// This is real delivery, not a simulated log line dressed up as one:
// sendPushToUser/sendAdminSms/sendAdminEmail each either actually call the
// provider's API or explicitly report "simulated" when that provider's
// credentials aren't configured yet — see each function's own file.

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { sendAdminSms } from "@/lib/sms/provider";
import { sendAdminEmail } from "@/lib/email/provider";
import { sendPushToUser } from "@/lib/push/webpush";

/** Best-effort absolute origin for SMS/email links. headers() only works
 * inside an actual request (server action, route handler) — every caller
 * of notifyAdmin() is one, but this stays defensive rather than throwing
 * if that ever isn't true, since a missing link is a minor degradation
 * (the text/email still sends, just without a clickable URL) and not
 * worth failing the whole alert over. */
async function resolveBaseUrl(): Promise<string | undefined> {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (!host) return undefined;
    const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
    return `${proto}://${host}`;
  } catch {
    return undefined;
  }
}

export type AdminAlertType =
  | "NEW_LEAD"
  | "HOT_LEAD"
  | "APPOINTMENT"
  | "APPOINTMENT_REMINDER"
  | "APPOINTMENT_TOMORROW"
  | "APPOINTMENT_CANCELLED"
  | "NO_SHOW"
  | "CUSTOMER_ACTIVITY"
  | "VEHICLE_SOLD"
  | "IMPORTANT_TASK"
  | "AUTOMATION";

export type ChannelPrefs = { push?: boolean; sms?: boolean; email?: boolean };
export type NotificationPrefs = Partial<Record<AdminAlertType, ChannelPrefs>>;

export type AdminAlertInput = {
  userId: string;
  type: AdminAlertType;
  title: string;
  body?: string;
  link?: string; // relative path, e.g. "/customers/abc123"
  baseUrl?: string; // absolute origin for SMS/email links — omit to leave them relative-only (in-app link still works either way)
};

function parsePrefs(raw: string | null): NotificationPrefs {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as NotificationPrefs;
  } catch {
    return {};
  }
}

function emailHtml(title: string, body: string | undefined, url: string | undefined) {
  return `
<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;color:#171717">
  <div style="background:#ffffff;border:1px solid #e5e5e5;border-top:4px solid #d81324;border-radius:12px;padding:20px 24px">
    <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:.04em;color:#d81324;text-transform:uppercase">AutoMax LV CRM</p>
    <h1 style="font-size:18px;margin:0 0 10px;color:#111">${title}</h1>
    ${body ? `<p style="font-size:14px;color:#333;margin:0 0 14px">${body}</p>` : ""}
    ${url ? `<a href="${url}" style="display:inline-block;background:#d81324;color:#fff;text-decoration:none;font-weight:600;font-size:13.5px;padding:9px 16px;border-radius:8px">Open in CRM</a>` : ""}
  </div>
</div>`.trim();
}

export async function notifyAdmin(input: AdminAlertInput): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user) return;

  const notification = await prisma.notification.create({
    data: { userId: input.userId, type: input.type, title: input.title, body: input.body, link: input.link },
  });

  const channels: ChannelPrefs = parsePrefs(user.notificationPrefs)[input.type] ?? {};
  if (!channels.push && !channels.sms && !channels.email) return; // in-app row already created above; nothing else to do

  const baseUrl = input.baseUrl ?? (await resolveBaseUrl());
  const absoluteUrl = input.link && baseUrl ? `${baseUrl.replace(/\/$/, "")}${input.link}` : baseUrl;

  const update: Record<string, boolean | string | undefined> = {};

  if (channels.push) {
    const res = await sendPushToUser(input.userId, { title: input.title, body: input.body ?? "", url: input.link });
    update.pushSent = res.sent;
    update.pushError = res.simulated ? "Not configured (simulated)" : res.error;
  }

  if (channels.sms) {
    const toPhone = user.notifyPhone || user.phone;
    if (!toPhone) {
      update.smsError = "No phone number on file — set one in Settings → Notifications.";
    } else {
      const smsBody = `${input.title}${input.body ? ` — ${input.body}` : ""}${absoluteUrl ? ` ${absoluteUrl}` : ""}`;
      const res = await sendAdminSms(toPhone, smsBody);
      update.smsSent = res.sent;
      update.smsError = res.simulated ? "Not configured (simulated)" : res.error;
    }
  }

  if (channels.email) {
    const toEmail = user.notifyEmail || user.email;
    const res = await sendAdminEmail(toEmail, input.title, emailHtml(input.title, input.body, absoluteUrl));
    update.emailSent = res.sent;
    update.emailError = res.simulated ? "Not configured (simulated)" : res.error;
  }

  if (Object.keys(update).length > 0) {
    await prisma.notification.update({ where: { id: notification.id }, data: update }).catch(() => undefined);
  }
}
