import { prisma } from "@/lib/prisma";
import type { ConversationFacts } from "@/lib/tiktok/types";
import type { TikTokConversation } from "@prisma/client";

export function conversationToFacts(c: TikTokConversation): ConversationFacts {
  return {
    tiktokUsername: c.tiktokUsername,
    vehicleInterest: c.vehicleInterest,
    vehicleId: c.vehicleId,
    desiredDownPayment: c.desiredDownPayment,
    desiredMonthlyPayment: c.desiredMonthlyPayment,
    hasTradeIn: c.hasTradeIn,
    applicationStatus: c.applicationStatus,
    appointmentRequested: c.appointmentRequested,
  };
}

export type ConversationFilter = "ALL" | "UNREAD" | "HOT" | "WARM" | "APPOINTMENTS" | "HUMAN_REVIEW" | "AI_ACTIVE" | "AI_OFF";

export async function listConversations(filter: ConversationFilter = "ALL", search?: string) {
  const where: Record<string, unknown> = {};
  if (filter === "UNREAD") where.unread = true;
  else if (filter === "HOT") where.temperature = "HOT";
  else if (filter === "WARM") where.temperature = "WARM";
  else if (filter === "APPOINTMENTS") where.appointmentRequested = true;
  else if (filter === "HUMAN_REVIEW") where.status = "HUMAN_REVIEW";
  else if (filter === "AI_ACTIVE") where.OR = [{ mode: "AUTO" }, { mode: "DRAFT" }];
  else if (filter === "AI_OFF") where.mode = "OFF";

  if (search) {
    where.OR = [
      { tiktokUsername: { contains: search } },
      { tiktokDisplayName: { contains: search } },
      { customerName: { contains: search } },
      { vehicleInterest: { contains: search } },
    ];
  }

  return prisma.tikTokConversation.findMany({
    where,
    include: {
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
      escalations: { where: { status: "PENDING" }, take: 1 },
    },
    orderBy: { lastInboundAt: "desc" },
    take: 100,
  });
}

export async function getConversation(id: string) {
  return prisma.tikTokConversation.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      escalations: { orderBy: { createdAt: "desc" } },
      assignee: true,
    },
  });
}

export async function listEscalations(status: "PENDING" | "RESOLVED" = "PENDING") {
  return prisma.tikTokEscalation.findMany({
    where: { status },
    include: { conversation: true, message: true, resolvedBy: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function listKnowledge(type?: string) {
  return prisma.tikTokKnowledge.findMany({
    where: type ? { type } : {},
    include: { author: true },
    orderBy: { updatedAt: "desc" },
  });
}
