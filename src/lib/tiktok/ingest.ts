// Core inbound-message handler — no auth check here on purpose. It's
// wrapped by two different callers with two different auth models:
//  - src/lib/actions/tiktok.ts's `processInboundMessage` (a server action
//    used by the logged-in UI) calls requireScope() first.
//  - src/app/api/tiktok/webhook/route.ts (a real TikTok webhook, once
//    connected) authenticates via a shared secret instead of a session.
// Keeping the actual pipeline + persistence logic here means both callers
// share one implementation instead of drifting apart.

import { prisma } from "@/lib/prisma";
import { conversationToFacts } from "@/lib/queries/tiktok";
import { runPipeline } from "@/lib/tiktok/pipeline";
import { getSettings } from "@/lib/tiktok/knowledge-base";
import { getActiveConnector } from "@/lib/tiktok/connector";
import type { TikTokMode } from "@/lib/constants";

export async function findOrCreateConversation(tiktokUsername: string, tiktokDisplayName?: string) {
  const existing = await prisma.tikTokConversation.findUnique({ where: { tiktokUsername } });
  if (existing) return existing;
  return prisma.tikTokConversation.create({ data: { tiktokUsername, tiktokDisplayName: tiktokDisplayName || null } });
}

export async function ingestMessage(conversationId: string, rawText: string) {
  const conversation = await prisma.tikTokConversation.findUniqueOrThrow({ where: { id: conversationId } });
  const settings = await getSettings();
  const resolvedMode = (conversation.mode ?? settings.mode) as TikTokMode;
  const facts = conversationToFacts(conversation);

  const result = await runPipeline(rawText, facts, resolvedMode);

  const inbound = await prisma.tikTokMessage.create({
    data: {
      conversationId,
      direction: "IN",
      senderType: "CUSTOMER",
      rawBody: rawText,
      body: rawText,
      understanding: JSON.stringify({ paraphrase: result.understanding.paraphrase, requiresInfo: result.understanding.requiresInfo }),
      intent: result.classification.intent,
      confidence: result.confidenceScore,
      requiresHuman: result.outcome.action === "ESCALATE",
      escalationReason: result.outcome.action === "ESCALATE" ? result.outcome.reason : null,
      status: "RECEIVED",
    },
  });

  await prisma.tikTokConversation.update({
    where: { id: conversationId },
    data: {
      unread: true,
      lastInboundAt: new Date(),
      lastConfidence: result.confidenceScore,
      temperature: result.temperature,
      status: result.outcome.action === "ESCALATE" ? "HUMAN_REVIEW" : conversation.status,
      vehicleInterest: result.extractedFacts.vehicleInterest ?? conversation.vehicleInterest,
      desiredDownPayment: result.extractedFacts.desiredDownPayment ?? conversation.desiredDownPayment,
      desiredMonthlyPayment: result.extractedFacts.desiredMonthlyPayment ?? conversation.desiredMonthlyPayment,
      hasTradeIn: result.extractedFacts.hasTradeIn ?? conversation.hasTradeIn,
      appointmentRequested: result.extractedFacts.appointmentRequested || conversation.appointmentRequested,
    },
  });

  if (result.outcome.action === "ESCALATE") {
    // Audit the blocked draft (if the safety guard caught one) so it's
    // visible in the Response Approval Log even though it was never sent.
    if (result.outcome.suggestedResponses[0] && (result.outcome.reason === "HALLUCINATION_BLOCKED" || result.outcome.reason === "COMPLEX")) {
      await prisma.tikTokMessage.create({
        data: {
          conversationId,
          direction: "OUT",
          senderType: "AI",
          rawBody: result.outcome.suggestedResponses[0],
          body: result.outcome.suggestedResponses[0],
          aiGenerated: true,
          status: "BLOCKED",
          intent: result.classification.intent,
          confidence: result.confidenceScore,
          requiresHuman: true,
          escalationReason: result.outcome.reason,
        },
      });
    }
    await prisma.tikTokEscalation.create({
      data: {
        conversationId,
        messageId: inbound.id,
        reason: result.outcome.reason,
        aiInterpretation: result.outcome.aiInterpretation,
        intent: result.classification.intent,
        confidence: result.confidenceScore,
        suggestedResponses: JSON.stringify(result.outcome.suggestedResponses),
      },
    });
  } else if (result.outcome.action === "RESPOND") {
    const outbound = await prisma.tikTokMessage.create({
      data: {
        conversationId,
        direction: "OUT",
        senderType: "AI",
        rawBody: result.outcome.text,
        body: result.outcome.text,
        aiGenerated: true,
        status: result.outcome.autoSend ? "QUEUED" : "DRAFT",
        originalDraft: result.outcome.text,
        intent: result.classification.intent,
        confidence: result.confidenceScore,
      },
    });
    if (result.outcome.autoSend) {
      const connector = await getActiveConnector();
      const sendResult = await connector.send(conversation.tiktokUsername, result.outcome.text);
      if (sendResult.ok && !sendResult.requiresManualSend) {
        await prisma.tikTokMessage.update({ where: { id: outbound.id }, data: { status: "SENT", sentAt: new Date() } });
        await prisma.tikTokConversation.update({ where: { id: conversationId }, data: { lastOutboundAt: new Date() } });
      }
    }
  }

  return result;
}
