import { prisma } from "@/lib/prisma";
import { leadScopeWhere, type Scope } from "@/lib/queries/scope";
import type { Prisma } from "@prisma/client";

export async function listLeads(
  scope: Scope,
  opts: { q?: string; isVip?: boolean; status?: string; stageId?: string; sourceId?: string; page?: number; pageSize?: number } = {}
) {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 25;

  const where: Prisma.LeadWhereInput = {
    ...leadScopeWhere(scope),
    status: opts.status ?? "ACTIVE",
    ...(opts.isVip ? { isVip: true } : {}),
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
              { company: { contains: opts.q } },
            ],
          },
        }
      : {}),
  };

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      include: { customer: true, stage: true, source: true, assignee: true, vehicle: true },
      orderBy: [{ isVip: "desc" }, { score: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.lead.count({ where }),
  ]);

  return { leads, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getLeadById(leadId: string) {
  return prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      customer: true,
      stage: true,
      source: true,
      assignee: true,
      vehicle: true,
      lostReason: true,
      tasks: { orderBy: { dueDate: "asc" } },
      activities: { orderBy: { createdAt: "desc" }, take: 20, include: { actor: true } },
      communications: { orderBy: { occurredAt: "desc" } },
      quotes: { orderBy: { createdAt: "desc" } },
      bookings: { orderBy: { date: "desc" } },
    },
  });
}
