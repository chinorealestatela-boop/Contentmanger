import { prisma } from "@/lib/prisma";
import type { Scope } from "@/lib/queries/scope";
import { startOfDay, endOfDay, startOfTomorrow, endOfTomorrow } from "date-fns";

export type TaskView = "overdue" | "today" | "tomorrow" | "upcoming" | "completed" | "all";

export async function getTasks(scope: Scope, view: TaskView) {
  const assigneeWhere = scope.viewAll ? {} : { assigneeId: scope.userId };
  const now = new Date();

  const where =
    view === "overdue"
      ? { ...assigneeWhere, status: "PENDING", dueDate: { lt: startOfDay(now) } }
      : view === "today"
      ? { ...assigneeWhere, status: "PENDING", dueDate: { gte: startOfDay(now), lte: endOfDay(now) } }
      : view === "tomorrow"
      ? { ...assigneeWhere, status: "PENDING", dueDate: { gte: startOfTomorrow(), lte: endOfTomorrow() } }
      : view === "upcoming"
      ? { ...assigneeWhere, status: "PENDING", dueDate: { gt: endOfTomorrow() } }
      : view === "completed"
      ? { ...assigneeWhere, status: "COMPLETED" }
      : { ...assigneeWhere };

  return prisma.task.findMany({
    where,
    include: { customer: true, lead: { include: { stage: true } }, assignee: true },
    orderBy: [{ dueDate: "asc" }],
  });
}

export async function getTaskCounts(scope: Scope) {
  const assigneeWhere = scope.viewAll ? {} : { assigneeId: scope.userId };
  const now = new Date();
  const [overdue, today, tomorrow, upcoming, completed] = await Promise.all([
    prisma.task.count({ where: { ...assigneeWhere, status: "PENDING", dueDate: { lt: startOfDay(now) } } }),
    prisma.task.count({ where: { ...assigneeWhere, status: "PENDING", dueDate: { gte: startOfDay(now), lte: endOfDay(now) } } }),
    prisma.task.count({ where: { ...assigneeWhere, status: "PENDING", dueDate: { gte: startOfTomorrow(), lte: endOfTomorrow() } } }),
    prisma.task.count({ where: { ...assigneeWhere, status: "PENDING", dueDate: { gt: endOfTomorrow() } } }),
    prisma.task.count({ where: { ...assigneeWhere, status: "COMPLETED" } }),
  ]);
  return { overdue, today, tomorrow, upcoming, completed };
}
