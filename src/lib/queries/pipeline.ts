import { prisma } from "@/lib/prisma";
import { leadScopeWhere, type Scope } from "@/lib/queries/scope";

export async function getPipelineData(scope: Scope, opts: { assigneeId?: string } = {}) {
  const [stages, leads] = await Promise.all([
    prisma.pipelineStage.findMany({ where: { active: true }, orderBy: { order: "asc" } }),
    prisma.lead.findMany({
      where: { ...leadScopeWhere(scope), status: "ACTIVE", ...(opts.assigneeId ? { assigneeId: opts.assigneeId } : {}) },
      include: { customer: true, vehicle: true },
      orderBy: [{ isVip: "desc" }, { score: "desc" }],
    }),
  ]);

  return { stages, leads };
}
