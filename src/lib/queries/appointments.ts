import { prisma } from "@/lib/prisma";
import type { Scope } from "@/lib/queries/scope";
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns";

export async function getAppointmentsForMonth(scope: Scope, year: number, month: number) {
  const monthStart = startOfMonth(new Date(year, month, 1));
  const monthEnd = endOfMonth(monthStart);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = endOfWeek(monthEnd);

  return prisma.appointment.findMany({
    where: {
      salespersonId: scope.viewAll ? undefined : scope.userId,
      date: { gte: gridStart, lte: gridEnd },
    },
    include: { customer: true, vehicle: true, salesperson: true },
    orderBy: { time: "asc" },
  });
}

export async function getUpcomingAppointments(scope: Scope, limit = 30) {
  return prisma.appointment.findMany({
    where: {
      salespersonId: scope.viewAll ? undefined : scope.userId,
      date: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      status: { notIn: ["CANCELLED", "COMPLETED"] },
    },
    include: { customer: true, vehicle: true, salesperson: true },
    orderBy: [{ date: "asc" }, { time: "asc" }],
    take: limit,
  });
}
