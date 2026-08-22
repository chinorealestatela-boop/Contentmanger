import { prisma } from "@/lib/prisma";
import type { Scope } from "@/lib/queries/scope";
import { startOfDay, endOfDay } from "date-fns";
import { syncFollowUps } from "@/lib/followups";

const includeCustomer = {
  customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
  lead: { select: { id: true, stage: { select: { name: true, color: true } } } },
  assignee: { select: { firstName: true, lastName: true } },
} as const;

/** Call once per page render before reading follow-ups — cheap, idempotent
 * aging sweep (SCHEDULED -> MISSED, fires reminder notifications). */
export async function ensureFollowUpsFresh() {
  return syncFollowUps();
}

export async function listFollowUpsForCustomer(customerId: string) {
  return prisma.followUp.findMany({
    where: { customerId },
    include: includeCustomer,
    orderBy: [{ followUpDate: "desc" }, { followUpTime: "desc" }],
  });
}

export async function getFollowUpsDueToday(scope: Scope, limit = 20) {
  return prisma.followUp.findMany({
    where: {
      assigneeId: scope.viewAll ? undefined : scope.userId,
      status: "SCHEDULED",
      followUpDate: { gte: startOfDay(new Date()), lte: endOfDay(new Date()) },
    },
    include: includeCustomer,
    orderBy: { followUpTime: "asc" },
    take: limit,
  });
}

export async function getOverdueFollowUps(scope: Scope, limit = 20) {
  return prisma.followUp.findMany({
    where: {
      assigneeId: scope.viewAll ? undefined : scope.userId,
      status: "MISSED",
    },
    include: includeCustomer,
    orderBy: [{ followUpDate: "asc" }],
    take: limit,
  });
}

export async function getUpcomingFollowUps(scope: Scope, limit = 30) {
  return prisma.followUp.findMany({
    where: {
      assigneeId: scope.viewAll ? undefined : scope.userId,
      status: "SCHEDULED",
      followUpDate: { gte: startOfDay(new Date()) },
    },
    include: includeCustomer,
    orderBy: [{ followUpDate: "asc" }, { followUpTime: "asc" }],
    take: limit,
  });
}

export type FollowUpListFilters = {
  status?: string; // SCHEDULED | COMPLETED | RESCHEDULED | CANCELLED | MISSED | DUE_TODAY | ALL
  priority?: string;
  q?: string;
};

export async function listFollowUps(scope: Scope, filters: FollowUpListFilters = {}) {
  const where: Record<string, unknown> = {
    assigneeId: scope.viewAll ? undefined : scope.userId,
  };

  if (filters.status && filters.status !== "ALL") {
    if (filters.status === "DUE_TODAY") {
      where.status = "SCHEDULED";
      where.followUpDate = { gte: startOfDay(new Date()), lte: endOfDay(new Date()) };
    } else {
      where.status = filters.status;
    }
  }
  if (filters.priority) where.priority = filters.priority;
  if (filters.q) {
    where.OR = [
      { topic: { contains: filters.q } },
      { notes: { contains: filters.q } },
      { customer: { OR: [{ firstName: { contains: filters.q } }, { lastName: { contains: filters.q } }, { phone: { contains: filters.q } }] } },
    ];
  }

  return prisma.followUp.findMany({
    where,
    include: includeCustomer,
    orderBy: [{ followUpDate: "asc" }, { followUpTime: "asc" }],
  });
}
