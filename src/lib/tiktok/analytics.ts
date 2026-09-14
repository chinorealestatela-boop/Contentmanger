// Analytics Engine (spec sections 15, 20). Aggregate read queries backing
// the TikTok AI dashboard.

import { prisma } from "@/lib/prisma";

export async function getDashboardStats() {
  const [
    totalConversations,
    unread,
    humanReview,
    hotLeads,
    warmLeads,
    appointments,
    applicationsSubmitted,
    totalInboundMessages,
    aiSentMessages,
    escalations,
  ] = await Promise.all([
    prisma.tikTokConversation.count(),
    prisma.tikTokConversation.count({ where: { unread: true } }),
    prisma.tikTokConversation.count({ where: { status: "HUMAN_REVIEW" } }),
    prisma.tikTokConversation.count({ where: { temperature: "HOT" } }),
    prisma.tikTokConversation.count({ where: { temperature: "WARM" } }),
    prisma.tikTokConversation.count({ where: { appointmentRequested: true } }),
    prisma.tikTokConversation.count({ where: { applicationStatus: { in: ["SUBMITTED", "COMPLETED"] } } }),
    prisma.tikTokMessage.count({ where: { direction: "IN" } }),
    prisma.tikTokMessage.count({ where: { direction: "OUT", aiGenerated: true, status: "SENT" } }),
    prisma.tikTokEscalation.count({ where: { status: "PENDING" } }),
  ]);

  const aiResponseRate = totalInboundMessages > 0 ? Math.round((aiSentMessages / totalInboundMessages) * 100) : 0;
  const escalationRate = totalInboundMessages > 0 ? Math.round((escalations / totalInboundMessages) * 100) : 0;

  return {
    totalConversations,
    unread,
    humanReview,
    hotLeads,
    warmLeads,
    appointments,
    applicationsSubmitted,
    aiResponseRate,
    escalationRate,
    pendingEscalations: escalations,
  };
}

export async function getResponseLog(limit = 50) {
  return prisma.tikTokMessage.findMany({
    where: { direction: "OUT" },
    include: { conversation: true, humanActor: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
