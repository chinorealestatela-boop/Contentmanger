"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireScope } from "@/lib/queries/scope";
import { findOrCreateConversation, ingestMessage } from "@/lib/tiktok/ingest";
import type { TikTokMode } from "@/lib/constants";
import type { SimpleActionState } from "@/lib/actions/communications";

function revalidateConversation(id: string) {
  revalidatePath("/tiktok");
  revalidatePath(`/tiktok/${id}`);
  revalidatePath("/tiktok/review");
  revalidatePath("/dashboard");
}

/** Manual ingestion (spec section 19): since TikTok doesn't grant a public
 * DM API, inbound messages are logged here — by pasting them in, or later
 * by the webhook route calling the same pipeline once real API access
 * exists. Runs the full understanding -> confidence -> response pipeline
 * and persists the result. */
const ingestSchema = z.object({
  tiktokUsername: z.string().min(1, "TikTok username is required."),
  tiktokDisplayName: z.string().optional(),
  text: z.string().min(1, "Message text is required."),
});

export async function ingestInboundMessage(_prev: SimpleActionState, formData: FormData): Promise<SimpleActionState> {
  await requireScope();
  const parsed = ingestSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { tiktokUsername, tiktokDisplayName, text } = parsed.data;

  const conversation = await findOrCreateConversation(tiktokUsername.replace(/^@/, ""), tiktokDisplayName);
  await processInboundMessage(conversation.id, text);
  revalidateConversation(conversation.id);
  return { success: "Message logged." };
}

/** Core entry point used by the logged-in UI (manual ingestion above, and
 * "log another message" on a conversation). Requires a session — the
 * webhook route (src/app/api/tiktok/webhook/route.ts) calls
 * src/lib/tiktok/ingest.ts's `ingestMessage` directly instead, since a real
 * TikTok webhook authenticates via a shared secret, not a user session. */
export async function processInboundMessage(conversationId: string, rawText: string) {
  await requireScope();
  return ingestMessage(conversationId, rawText);
}

// ── Draft approval / manual send (spec section 10) ──────────────────────

export async function approveDraft(messageId: string, editedText?: string) {
  const scope = await requireScope();
  const message = await prisma.tikTokMessage.findUniqueOrThrow({ where: { id: messageId } });
  const finalText = editedText?.trim() || message.body;
  await prisma.tikTokMessage.update({
    where: { id: messageId },
    data: {
      body: finalText,
      status: "QUEUED",
      editedByHuman: Boolean(editedText && editedText.trim() !== message.originalDraft),
      humanActorId: scope.userId,
    },
  });
  revalidateConversation(message.conversationId);
}

export async function markMessageSent(messageId: string) {
  const message = await prisma.tikTokMessage.findUniqueOrThrow({ where: { id: messageId } });
  await prisma.tikTokMessage.update({ where: { id: messageId }, data: { status: "SENT", sentAt: new Date() } });
  await prisma.tikTokConversation.update({ where: { id: message.conversationId }, data: { lastOutboundAt: new Date() } });
  revalidateConversation(message.conversationId);
}

export async function discardDraft(messageId: string) {
  const message = await prisma.tikTokMessage.findUniqueOrThrow({ where: { id: messageId } });
  await prisma.tikTokMessage.update({ where: { id: messageId }, data: { status: "BLOCKED" } });
  revalidateConversation(message.conversationId);
}

export async function sendManualReply(conversationId: string, text: string) {
  const scope = await requireScope();
  if (!text.trim()) return;
  await prisma.tikTokMessage.create({
    data: { conversationId, direction: "OUT", senderType: "HUMAN", rawBody: text, body: text, status: "SENT", sentAt: new Date(), humanActorId: scope.userId },
  });
  await prisma.tikTokConversation.update({ where: { id: conversationId }, data: { lastOutboundAt: new Date(), unread: false } });
  revalidateConversation(conversationId);
}

export async function markConversationRead(conversationId: string) {
  await prisma.tikTokConversation.update({ where: { id: conversationId }, data: { unread: false } });
  revalidatePath("/tiktok");
}

export async function setConversationMode(conversationId: string, mode: TikTokMode) {
  await requireScope();
  await prisma.tikTokConversation.update({ where: { id: conversationId }, data: { mode } });
  revalidateConversation(conversationId);
}

export async function takeOverConversation(conversationId: string) {
  const scope = await requireScope();
  await prisma.tikTokConversation.update({
    where: { id: conversationId },
    data: { mode: "OFF", humanTakeoverAt: new Date(), status: "OPEN", assigneeId: scope.userId },
  });
  revalidateConversation(conversationId);
}

// ── Global settings ──────────────────────────────────────────────────────

export async function setGlobalMode(mode: TikTokMode) {
  await requireScope();
  await prisma.tikTokAISettings.upsert({ where: { id: "default" }, update: { mode }, create: { id: "default", mode } });
  revalidatePath("/tiktok/settings");
  revalidatePath("/tiktok");
}

const thresholdsSchema = z.object({
  autoThreshold: z.coerce.number().min(0).max(100),
  draftThreshold: z.coerce.number().min(0).max(100),
  businessName: z.string().optional(),
  voiceNotes: z.string().optional(),
});

export async function updateTikTokSettings(_prev: SimpleActionState, formData: FormData): Promise<SimpleActionState> {
  await requireScope();
  const parsed = thresholdsSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { autoThreshold, draftThreshold, businessName, voiceNotes } = parsed.data;
  if (draftThreshold > autoThreshold) return { error: "Draft threshold can't be higher than the auto-send threshold." };
  await prisma.tikTokAISettings.upsert({
    where: { id: "default" },
    update: { autoThreshold, draftThreshold, businessName: businessName || null, voiceNotes: voiceNotes || null },
    create: { id: "default", autoThreshold, draftThreshold, businessName: businessName || null, voiceNotes: voiceNotes || null },
  });
  revalidatePath("/tiktok/settings");
  return { success: "Settings saved." };
}

// ── Escalations / human review (spec section 9) ─────────────────────────

export async function resolveEscalation(escalationId: string, note?: string) {
  const scope = await requireScope();
  const escalation = await prisma.tikTokEscalation.findUniqueOrThrow({ where: { id: escalationId } });
  await prisma.tikTokEscalation.update({
    where: { id: escalationId },
    data: { status: "RESOLVED", resolvedAt: new Date(), resolvedById: scope.userId, resolutionNote: note || null },
  });
  const pending = await prisma.tikTokEscalation.count({ where: { conversationId: escalation.conversationId, status: "PENDING" } });
  if (pending === 0) {
    await prisma.tikTokConversation.update({ where: { id: escalation.conversationId }, data: { status: "OPEN" } });
  }
  revalidateConversation(escalation.conversationId);
}

export async function sendSuggestedResponse(escalationId: string, text: string) {
  const escalation = await prisma.tikTokEscalation.findUniqueOrThrow({ where: { id: escalationId } });
  await sendManualReply(escalation.conversationId, text);
  await resolveEscalation(escalationId, "Sent a suggested/edited response.");
}

// ── Training Center (spec sections 5, 16) ───────────────────────────────

const knowledgeSchema = z.object({
  type: z.string().min(1),
  title: z.string().optional(),
  content: z.string().min(1, "Content is required."),
  tags: z.string().optional(),
});

export async function addKnowledge(_prev: SimpleActionState, formData: FormData): Promise<SimpleActionState> {
  const scope = await requireScope();
  const parsed = knowledgeSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { type, title, content, tags } = parsed.data;
  await prisma.tikTokKnowledge.create({ data: { type, title: title || null, content, tags: tags || null, authorId: scope.userId } });
  revalidatePath("/tiktok/training");
  return { success: "Added to the Training Center." };
}

export async function toggleKnowledge(id: string, active: boolean) {
  await requireScope();
  await prisma.tikTokKnowledge.update({ where: { id }, data: { active } });
  revalidatePath("/tiktok/training");
}

export async function deleteKnowledge(id: string) {
  await requireScope();
  await prisma.tikTokKnowledge.delete({ where: { id } });
  revalidatePath("/tiktok/training");
}

export async function editKnowledge(id: string, content: string) {
  const scope = await requireScope();
  const existing = await prisma.tikTokKnowledge.findUniqueOrThrow({ where: { id } });
  await prisma.tikTokKnowledge.update({
    where: { id },
    data: { content, version: existing.version + 1, authorId: scope.userId },
  });
  revalidatePath("/tiktok/training");
}

/** "Correct Response" (spec section 5): the human's fix is stored as a
 * versioned CORRECTION knowledge item the response generator's future LLM
 * path (and Chino, reviewing the Training Center) can learn from. */
const correctionSchema = z.object({
  messageId: z.string().min(1),
  correctedText: z.string().min(1, "Enter what you would have said."),
});

export async function correctResponse(_prev: SimpleActionState, formData: FormData): Promise<SimpleActionState> {
  const scope = await requireScope();
  const parsed = correctionSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { messageId, correctedText } = parsed.data;
  const message = await prisma.tikTokMessage.findUniqueOrThrow({ where: { id: messageId } });

  await prisma.tikTokKnowledge.create({
    data: {
      type: "CORRECTION",
      content: correctedText,
      incorrectResponse: message.body,
      sourceConversationId: message.conversationId,
      sourceMessageId: message.id,
      authorId: scope.userId,
    },
  });
  await prisma.tikTokMessage.update({ where: { id: messageId }, data: { editedByHuman: true } });
  revalidatePath("/tiktok/training");
  revalidateConversation(message.conversationId);
  return { success: "Saved as a correction — the AI will learn from this." };
}
