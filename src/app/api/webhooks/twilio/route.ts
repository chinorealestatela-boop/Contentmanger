// Twilio delivery-status webhook. Registered as the StatusCallback on every
// outbound SMS (see sendViaTwilio in src/lib/sms/provider.ts), so once
// Twilio actually attempts delivery it POSTs back here with the real
// carrier outcome — "queued" and "sent" at send time don't tell you
// whether a text actually reached the phone; "delivered"/"failed"/
// "undelivered" do. That update is what makes the failure genuinely
// visible/retriable rather than the initial API-accepted response.
//
// Signature verification (X-Twilio-Signature) confirms the request really
// came from Twilio and not from someone POSTing fake "delivered" statuses
// at this public URL — see https://www.twilio.com/docs/usage/webhooks/webhooks-security.

import crypto from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function validTwilioSignature(url: string, params: Record<string, string>, signature: string | null, authToken: string): boolean {
  if (!signature) return false;
  const data = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], url);
  const expected = crypto.createHmac("sha1", authToken).update(Buffer.from(data, "utf-8")).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const raw = await req.text();
  const params = Object.fromEntries(new URLSearchParams(raw));

  // Reconstruct the exact URL Twilio signed against — must match the
  // StatusCallback URL byte-for-byte (scheme + host + path, no query).
  const h = req.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const url = `${proto}://${host}/api/webhooks/twilio`;

  if (!authToken) {
    console.error("[twilio webhook] TWILIO_AUTH_TOKEN not set — cannot verify signature, dropping request.");
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }
  if (!validTwilioSignature(url, params, h.get("x-twilio-signature"), authToken)) {
    console.warn("[twilio webhook] invalid signature, dropping request.");
    return NextResponse.json({ error: "invalid signature" }, { status: 403 });
  }

  const sid = params.MessageSid ?? params.SmsSid;
  const status = (params.MessageStatus ?? params.SmsStatus ?? "").toLowerCase();
  if (!sid || !status) return NextResponse.json({ ok: true }); // nothing actionable

  const msg = await prisma.smsMessage.findFirst({ where: { providerId: sid } });
  if (!msg) return NextResponse.json({ ok: true }); // unknown/stale message, ignore quietly

  if (status === "delivered") {
    await prisma.smsMessage.update({ where: { id: msg.id }, data: { status: "DELIVERED" } });
  } else if (status === "failed" || status === "undelivered") {
    const errorMessage = params.ErrorMessage || (params.ErrorCode ? `Twilio error ${params.ErrorCode}` : "Delivery failed.");
    await prisma.smsMessage.update({ where: { id: msg.id }, data: { status: "FAILED", errorMessage } });
  }
  // "queued" / "sending" / "sent" — transient, already reflected as SENT.

  return NextResponse.json({ ok: true });
}
