// SMS transport. Real sending goes through Twilio's REST API via plain
// fetch (no SDK dependency needed). When TWILIO_ACCOUNT_SID /
// TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER aren't set, every send is
// "simulated": logged to the SmsMessage table with status SIMULATED and
// printed to the server console, so the whole booking flow — including
// "was this reminder actually sent" tracking — works with zero external
// accounts. Connect Twilio later and nothing else changes.
//
// To go live: create a Twilio account, buy/verify a phone number, and set
// the three env vars above (see .env). For production SMS marketing/
// reminders in the US you'll also want an A2P 10DLC campaign registered
// with Twilio — required by carriers for non-trivial volume.

import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/phone";

export type SmsType = "BOOKING_CONFIRMATION" | "REMINDER_24H" | "REMINDER_2H" | "RESCHEDULED" | "CANCELLED" | "CUSTOM";

export function isTwilioConfigured(): boolean {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER);
}

export { normalizePhone, isValidPhone } from "@/lib/phone";

async function sendViaTwilio(to: string, body: string): Promise<{ ok: boolean; sid?: string; error?: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  const from = process.env.TWILIO_FROM_NUMBER!;

  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, error: data?.message ?? `Twilio responded ${res.status}` };
    return { ok: true, sid: data?.sid };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error sending SMS." };
  }
}

export async function sendSms(params: {
  customerId: string;
  appointmentId?: string | null;
  toPhone: string;
  type: SmsType;
  body: string;
}): Promise<{ sent: boolean; simulated: boolean }> {
  const normalized = normalizePhone(params.toPhone) ?? params.toPhone;

  if (!isTwilioConfigured()) {
    await prisma.smsMessage.create({
      data: {
        customerId: params.customerId,
        appointmentId: params.appointmentId ?? undefined,
        toPhone: normalized,
        type: params.type,
        body: params.body,
        status: "SIMULATED",
        sentAt: new Date(),
      },
    });
    console.log(`[SMS SIMULATED -> ${normalized}] ${params.body}`);
    return { sent: false, simulated: true };
  }

  const result = await sendViaTwilio(normalized, params.body);
  await prisma.smsMessage.create({
    data: {
      customerId: params.customerId,
      appointmentId: params.appointmentId ?? undefined,
      toPhone: normalized,
      type: params.type,
      body: params.body,
      status: result.ok ? "SENT" : "FAILED",
      providerId: result.sid,
      errorMessage: result.error,
      sentAt: result.ok ? new Date() : undefined,
    },
  });
  return { sent: result.ok, simulated: false };
}
