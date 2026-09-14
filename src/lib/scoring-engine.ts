// Bridges the pure scoring math (src/lib/scoring.ts) to the database:
// gathers real signals for a lead and persists the recomputed score,
// auto-flagging VIP/high-value leads (spec §4) and firing the
// HIGH_VALUE_LEAD automation the moment a lead crosses the threshold.

import { prisma } from "@/lib/prisma";
import { scoreLead, VIP_SCORE_THRESHOLD } from "@/lib/scoring";
import { runAutomation } from "@/lib/automation/engine";
import { daysBetween } from "@/lib/format";

const LUXURY_TYPES = new Set(["ROLLS_ROYCE", "BENTLEY", "MAYBACH", "LAMBORGHINI", "EXOTIC"]);

export async function recomputeLeadScore(leadId: string, actorId?: string) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      customer: { include: { bookings: { select: { id: true } }, communications: true } },
      vehicle: { select: { vehicleType: true } },
      communications: true,
      quotes: { select: { id: true } },
    },
  });
  if (!lead || lead.status !== "ACTIVE") return null;

  const allComms = [...lead.communications, ...lead.customer.communications];
  const serviceDateWithinDays = lead.serviceDate ? Math.max(0, daysBetween(new Date(), lead.serviceDate)) : null;

  const { score, breakdown } = scoreLead({
    respondedToContact: allComms.some((c) => c.direction === "INBOUND"),
    daysSinceLastActivity: lead.lastContactedAt ? daysBetween(lead.lastContactedAt) : 999,
    serviceDateWithinDays,
    estimatedPrice: lead.estimatedPrice,
    isRepeatClient: lead.customer.bookings.length > 0,
    customerTier: lead.customer.tier,
    vehicleIsLuxuryTier: lead.vehicle ? LUXURY_TYPES.has(lead.vehicle.vehicleType) : false,
    hasQuoteSent: lead.quotes.length > 0,
    interactionCount: allComms.length,
  });

  const wasVip = lead.isVip;
  const isVip = wasVip || score >= VIP_SCORE_THRESHOLD;

  await prisma.$transaction([
    prisma.lead.update({ where: { id: leadId }, data: { score, isVip } }),
    prisma.leadScoreEvent.create({ data: { leadId, points: score, reason: breakdown.map((b) => `${b.label} (${b.points >= 0 ? "+" : ""}${b.points})`).join("; ") } }),
  ]);

  if (isVip && !wasVip) {
    await runAutomation("HIGH_VALUE_LEAD", { customerId: lead.customerId, leadId, actorId });
  }

  return { score, isVip, breakdown };
}
