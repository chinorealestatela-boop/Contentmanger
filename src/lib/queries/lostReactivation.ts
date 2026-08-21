import { prisma } from "@/lib/prisma";
import { leadScopeWhere, type Scope } from "@/lib/queries/scope";

export async function listLostLeads(scope: Scope, opts: { lostReasonId?: string } = {}) {
  return prisma.lead.findMany({
    where: { ...leadScopeWhere(scope), status: "LOST", ...(opts.lostReasonId ? { lostReasonId: opts.lostReasonId } : {}) },
    include: { customer: true, lostReason: true, stage: true, vehicleInterests: { include: { vehicle: true }, take: 1 } },
    orderBy: { lostAt: "desc" },
  });
}

export async function getReactivationCandidates(scope: Scope, days: number) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const [lost, stale] = await Promise.all([
    prisma.lead.findMany({
      where: { ...leadScopeWhere(scope), status: "LOST", lostAt: { lte: cutoff } },
      include: { customer: true, lostReason: true, vehicleInterests: { include: { vehicle: true }, take: 1 } },
      orderBy: { lostAt: "desc" },
    }),
    prisma.lead.findMany({
      where: {
        ...leadScopeWhere(scope),
        status: "ACTIVE",
        OR: [{ lastContactedAt: { lte: cutoff } }, { lastContactedAt: null, createdAt: { lte: cutoff } }],
      },
      include: { customer: true, lostReason: true, vehicleInterests: { include: { vehicle: true }, take: 1 } },
      orderBy: { lastContactedAt: "asc" },
    }),
  ]);

  return { lost, stale };
}
