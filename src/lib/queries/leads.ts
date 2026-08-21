import { prisma } from "@/lib/prisma";
import { leadScopeWhere, type Scope } from "@/lib/queries/scope";
import type { Prisma } from "@prisma/client";

export async function listLeads(
  scope: Scope,
  opts: { q?: string; temperature?: string; status?: string; stageId?: string; sourceId?: string; page?: number; pageSize?: number } = {}
) {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 25;

  const where: Prisma.LeadWhereInput = {
    ...leadScopeWhere(scope),
    status: opts.status ?? "ACTIVE",
    ...(opts.temperature ? { temperature: opts.temperature } : {}),
    ...(opts.stageId ? { stageId: opts.stageId } : {}),
    ...(opts.sourceId ? { sourceId: opts.sourceId } : {}),
    ...(opts.q
      ? {
          customer: {
            OR: [
              { firstName: { contains: opts.q } },
              { lastName: { contains: opts.q } },
              { phone: { contains: opts.q } },
              { email: { contains: opts.q } },
            ],
          },
        }
      : {}),
  };

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      include: {
        customer: true,
        stage: true,
        source: true,
        assignee: true,
        vehicleInterests: { include: { vehicle: true }, take: 1 },
      },
      orderBy: [{ score: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.lead.count({ where }),
  ]);

  return { leads, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}
