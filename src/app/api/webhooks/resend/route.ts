// Resend delivery-status webhook (email.delivered / email.bounced /
// email.complained / email.delivery_delayed). Same purpose as the Twilio
// webhook: sendViaResend only tells us the API accepted the send, not
// whether the mailbox actually got it — this is what turns a silent bounce
// into a visible, retriable FAILED row instead of a false "Sent" forever.
//
// Resend signs webhooks with Svix (see https://resend.com/docs/dashboard/webhooks/verify-webhooks-requests).
// Configure the endpoint in the Resend dashboard, copy the signing secret
// (starts with "whsec_") into RESEND_WEBHOOK_SECRET.

import crypto from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function validSvixSignature(secret: string, id: string, timestamp: string, body: string, signatureHeader: string): boolean {
  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const signedContent = `${id}.${timestamp}.${body}`;
  const expected = crypto.createHmac("sha256", secretBytes).update(signedContent).digest("base64");
  return signatureHeader
    .split(" ")
    .map((part) => part.split(",")[1])
    .filter(Boolean)
    .some((sig) => {
      const a = Buffer.from(expected);
      const b = Buffer.from(sig);
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    });
}

export async function POST(req: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const body = await req.text();
  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");

  if (!secret) {
    console.error("[resend webhook] RESEND_WEBHOOK_SECRET not set — cannot verify signature, dropping request.");
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }
  if (!svixId || !svixTimestamp || !svixSignature || !validSvixSignature(secret, svixId, svixTimestamp, body, svixSignature)) {
    console.warn("[resend webhook] invalid signature, dropping request.");
    return NextResponse.json({ error: "invalid signature" }, { status: 403 });
  }

  const event = JSON.parse(body) as { type?: string; data?: { email_id?: string; bounce?: { message?: string } } };
  const emailId = event.data?.email_id;
  if (!emailId || !event.type) return NextResponse.json({ ok: true });

  const msg = await prisma.emailMessage.findFirst({ where: { providerId: emailId } });
  if (!msg) return NextResponse.json({ ok: true }); // unknown/stale message, ignore quietly

  if (event.type === "email.delivered") {
    await prisma.emailMessage.update({ where: { id: msg.id }, data: { status: "DELIVERED" } });
  } else if (event.type === "email.bounced" || event.type === "email.delivery_delayed") {
    await prisma.emailMessage.update({
      where: { id: msg.id },
      data: { status: "FAILED", errorMessage: event.data?.bounce?.message ?? event.type },
    });
  } else if (event.type === "email.complained") {
    // Recipient marked it spam — not a delivery failure, but worth a note
    // rather than leaving it looking like a clean "Sent".
    await prisma.emailMessage.update({ where: { id: msg.id }, data: { errorMessage: "Recipient marked this email as spam." } });
  }

  return NextResponse.json({ ok: true });
}
