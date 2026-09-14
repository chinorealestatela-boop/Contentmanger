// Messaging integration seam. Nothing here requires an external account —
// every "send" logs a real Communication row (SMS/Email) against the
// customer so the CRM stays fully functional without Twilio/SendGrid/
// Resend connected. Once Settings → Integrations has real credentials,
// swap the body of `deliver()` for an actual API call — every call site
// (automation engine, quote/booking actions, follow-up sequences) stays
// the same.

import { prisma } from "@/lib/prisma";
import type { MessageTemplate } from "@prisma/client";

export type SendMessageInput = {
  customerId: string;
  leadId?: string | null;
  bookingId?: string | null;
  template: Pick<MessageTemplate, "channel" | "name" | "subject" | "body">;
  vars?: Record<string, string>;
};

function render(body: string, vars?: Record<string, string>) {
  if (!vars) return body;
  return body.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}

export async function sendMessage(input: SendMessageInput) {
  const body = render(input.template.body, input.vars);
  const integration = await prisma.integration.findUnique({
    where: { provider: input.template.channel === "SMS" ? "TWILIO" : "SENDGRID" },
  });

  // Always log the communication — this is the CRM's source of truth for
  // "what was sent to this customer", whether or not a real provider is
  // connected.
  const communication = await prisma.communication.create({
    data: {
      customerId: input.customerId,
      leadId: input.leadId ?? null,
      bookingId: input.bookingId ?? null,
      type: input.template.channel === "SMS" ? "TEXT" : "EMAIL",
      direction: "OUTBOUND",
      channel: input.template.channel,
      summary: input.template.name,
      body,
    },
  });

  if (integration?.enabled) {
    // Real provider connected — this is where the live API call goes.
    // await deliverViaProvider(integration, { to, subject: input.template.subject, body });
  }

  return communication;
}
