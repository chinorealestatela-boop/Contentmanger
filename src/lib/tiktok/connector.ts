// TikTok Connector (spec sections 19, 20). TikTok does not offer a public
// API for reading/sending a creator's own DMs — only approved TikTok
// Business Messaging partners get one, and it requires an application
// through TikTok. So this connector, like the AssistantProvider pattern in
// src/lib/ai/provider.ts, is built against a small interface with a
// working default that needs no API access:
//
//  - Inbound: messages are entered manually (paste a DM in) via the Inbox
//    "Log a message" action, or in bulk from Training Center imports. Once
//    TikTok grants API access, POST the payload to
//    src/app/api/tiktok/webhook/route.ts instead and nothing else changes.
//  - Outbound: `send()` never calls TikTok — it marks the message QUEUED
//    and the salesperson copies it into the TikTok app themselves, then
//    marks it sent. A real connector implementing this same interface can
//    replace `manualConnector` in `getActiveConnector()` the moment API
//    credentials exist, with no changes to the pipeline or UI.
//
// This is a deliberate design constraint, not a limitation to work around:
// scraping TikTok or automating the consumer app would violate TikTok's
// terms and this system will not do that.

import { prisma } from "@/lib/prisma";

export type MessagingConnector = {
  id: string;
  name: string;
  requiresApiKey: boolean;
  isConfigured: () => Promise<boolean>;
  send: (tiktokUsername: string, text: string) => Promise<{ ok: boolean; requiresManualSend: boolean; error?: string }>;
};

export const manualConnector: MessagingConnector = {
  id: "manual",
  name: "Manual (no TikTok API access configured)",
  requiresApiKey: false,
  isConfigured: async () => true,
  send: async () => ({ ok: true, requiresManualSend: true }),
};

export async function getActiveConnector(): Promise<MessagingConnector> {
  const integration = await prisma.integration.findUnique({ where: { provider: "TIKTOK" } });
  if (integration?.enabled) {
    // Future: once TikTok Business Messaging API credentials are present,
    // return a real connector here that calls TikTok's API directly. Until
    // then every conversation still works — replies are just sent by hand.
  }
  return manualConnector;
}
