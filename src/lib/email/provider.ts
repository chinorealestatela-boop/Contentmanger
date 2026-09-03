// Email transport. Real sending goes through Resend's REST API via plain
// fetch (no SDK dependency needed) — chosen for a simple HTTP API and a
// generous free tier that's plenty for one salesperson's booking volume.
// Without RESEND_API_KEY / RESEND_FROM_EMAIL set, every send is
// "simulated": logged to EmailMessage with status SIMULATED and printed to
// the console. Connect Resend later (create an account, verify a sending
// domain, set the two env vars — see .env) and nothing else changes.

import { prisma } from "@/lib/prisma";

export type EmailType = "BOOKING_CONFIRMATION" | "REMINDER" | "RESCHEDULED" | "CANCELLED";

export function isResendConfigured(): boolean {
  return !!(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

async function sendViaResend(to: string, subject: string, html: string): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: process.env.RESEND_FROM_EMAIL, to, subject, html }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, error: data?.message ?? `Resend responded ${res.status}` };
    return { ok: true, id: data?.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error sending email." };
  }
}

export async function sendEmail(params: {
  customerId: string;
  appointmentId?: string | null;
  toEmail: string;
  type: EmailType;
  subject: string;
  html: string;
}): Promise<{ sent: boolean; simulated: boolean }> {
  if (!isResendConfigured()) {
    await prisma.emailMessage.create({
      data: {
        customerId: params.customerId,
        appointmentId: params.appointmentId ?? undefined,
        toEmail: params.toEmail,
        type: params.type,
        subject: params.subject,
        body: params.html,
        status: "SIMULATED",
        sentAt: new Date(),
      },
    });
    console.log(`[EMAIL SIMULATED -> ${params.toEmail}] ${params.subject}`);
    return { sent: false, simulated: true };
  }

  const result = await sendViaResend(params.toEmail, params.subject, params.html);
  await prisma.emailMessage.create({
    data: {
      customerId: params.customerId,
      appointmentId: params.appointmentId ?? undefined,
      toEmail: params.toEmail,
      type: params.type,
      subject: params.subject,
      body: params.html,
      status: result.ok ? "SENT" : "FAILED",
      providerId: result.id,
      errorMessage: result.error,
      sentAt: result.ok ? new Date() : undefined,
    },
  });
  return { sent: result.ok, simulated: false };
}
