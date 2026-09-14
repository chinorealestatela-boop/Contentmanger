// Webhook endpoint for a real TikTok Business Messaging API integration
// (spec section 19). TikTok does not offer a public API for reading a
// creator's own DMs to third-party apps — only approved Business
// Messaging partners get one, via an application through TikTok for
// Developers. This route is the seam that access plugs into: once
// approved, point TikTok's webhook configuration at this URL and fill in
// TIKTOK_WEBHOOK_SECRET; nothing else in the app (pipeline, UI, database)
// needs to change — see src/lib/tiktok/connector.ts for the corresponding
// outbound seam.
//
// Until that access exists, inbound messages are logged manually from the
// Inbox ("Log a TikTok DM") and this route stays inert (501), so nothing
// here scrapes TikTok, automates the consumer app, or handles credentials
// in a way that would violate TikTok's terms.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findOrCreateConversation, ingestMessage } from "@/lib/tiktok/ingest";

// Shape TikTok's Business Messaging webhook is expected to send. Adjust to
// match the actual payload once real API docs/access are in hand — this is
// a reasonable placeholder, not a guarantee of TikTok's real schema.
type TikTokWebhookPayload = {
  sender: { username: string; display_name?: string };
  message: { text: string };
};

export async function POST(request: Request) {
  const integration = await prisma.integration.findUnique({ where: { provider: "TIKTOK" } });
  if (!integration?.enabled) {
    return NextResponse.json(
      { error: "TikTok API access isn't configured. Log messages manually from the Inbox until Business Messaging API access is granted." },
      { status: 501 }
    );
  }

  const secret = request.headers.get("x-tiktok-webhook-secret");
  const configured = integration.config ? (JSON.parse(integration.config) as { webhookSecret?: string }).webhookSecret : undefined;
  if (!configured || secret !== configured) {
    return NextResponse.json({ error: "Invalid webhook secret." }, { status: 401 });
  }

  const payload = (await request.json()) as TikTokWebhookPayload;
  if (!payload?.sender?.username || !payload?.message?.text) {
    return NextResponse.json({ error: "Malformed payload." }, { status: 400 });
  }

  const conversation = await findOrCreateConversation(payload.sender.username.replace(/^@/, ""), payload.sender.display_name);
  await ingestMessage(conversation.id, payload.message.text);

  return NextResponse.json({ ok: true });
}
