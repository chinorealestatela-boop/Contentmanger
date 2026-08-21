// Bridges the pure scoring math (src/lib/scoring.ts) to the database:
// gathers real signals for a lead and persists the recomputed score,
// temperature, and an audit trail of what changed and why.

import { prisma } from "@/lib/prisma";
import { scoreLead, classifyScore } from "@/lib/scoring";
import { runAutomation } from "@/lib/automation/engine";
import { daysBetween } from "@/lib/format";

export async function recomputeLeadScore(leadId: string, actorId?: string) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      customer: {
        include: {
          tradeIns: true,
          appointments: { where: { status: { in: ["SCHEDULED", "CONFIRMED"] } } },
          testDrives: true,
          communications: true,
          vehicleInterests: { include: { vehicle: true }, take: 1 },
        },
      },
    },
  });
  if (!lead || lead.status !== "ACTIVE") return null;

  const confirmedAppt = lead.customer.appointments.some((a) => a.status === "CONFIRMED");
  const vehicle = lead.customer.vehicleInterests[0]?.vehicle;

  const { score, breakdown } = scoreLead({
    respondedToContact: lead.customer.communications.some((c) => c.direction === "INBOUND"),
    daysSinceLastActivity: lead.lastContactedAt ? daysBetween(lead.lastContactedAt) : 999,
    hasUpcomingAppointment: lead.customer.appointments.length > 0,
    appointmentConfirmed: confirmedAppt,
    completedTestDrive: lead.customer.testDrives.length > 0,
    creditAppStatus: lead.creditAppStatus,
    hasTrade: lead.customer.tradeIns.length > 0,
    purchaseTimeframe: lead.purchaseTimeframe,
    vehicleAvailable: vehicle ? vehicle.status === "AVAILABLE" : true,
    interactionCount: lead.customer.communications.length,
  });

  const previousTemp = lead.temperature;
  const temperature = classifyScore(score);

  await prisma.$transaction([
    prisma.lead.update({ where: { id: leadId }, data: { score, temperature } }),
    prisma.leadScoreEvent.create({
      data: { leadId, points: score, reason: breakdown.map((b) => `${b.label} (${b.points >= 0 ? "+" : ""}${b.points})`).join("; ") },
    }),
  ]);

  if (temperature === "HOT" && previousTemp !== "HOT") {
    await runAutomation("HOT_LEAD", { customerId: lead.customerId, leadId, actorId });
  }

  return { score, temperature, breakdown };
}
