import { prisma } from "@/lib/prisma";
import { customerScopeWhere, leadScopeWhere, type Scope } from "@/lib/queries/scope";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";

function today() {
  return { gte: startOfDay(new Date()), lte: endOfDay(new Date()) };
}

export async function getDashboardMetrics(scope: Scope) {
  const leadWhere = leadScopeWhere(scope);
  const now = new Date();
  const todayRange = today();
  const weekRange = { gte: startOfWeek(now), lte: endOfWeek(now) };
  const monthRange = { gte: startOfMonth(now), lte: endOfMonth(now) };

  const [
    todaysReservations,
    upcomingReservations,
    activeTrips,
    availableVehicles,
    vehiclesOut,
    vehiclesMaintenance,
    newLeads,
    uncontactedLeads,
    quotesAwaiting,
    confirmedBookings,
    revenueTodayAgg,
    revenueWeekAgg,
    revenueMonthAgg,
    outstandingAgg,
    totalCustomers,
  ] = await Promise.all([
    prisma.booking.count({ where: { date: todayRange, bookingStatus: { notIn: ["CANCELLED"] } } }),
    prisma.booking.count({ where: { date: { gt: endOfDay(now) }, bookingStatus: { notIn: ["CANCELLED", "COMPLETED"] } } }),
    prisma.booking.count({ where: { opsStage: { in: ["DRIVER_ASSIGNED", "DRIVER_EN_ROUTE", "ARRIVED", "PASSENGER_ONBOARD", "IN_TRANSIT"] } } }),
    prisma.vehicle.count({ where: { isActive: true, availability: "AVAILABLE" } }),
    prisma.vehicle.count({ where: { isActive: true, availability: "ON_TRIP" } }),
    prisma.vehicle.count({ where: { isActive: true, availability: "MAINTENANCE" } }),
    prisma.lead.count({ where: { ...leadWhere, createdAt: todayRange } }),
    prisma.lead.count({ where: { ...leadWhere, status: "ACTIVE", lastContactedAt: null } }),
    prisma.quote.count({ where: { status: { in: ["SENT", "VIEWED"] } } }),
    prisma.booking.count({ where: { bookingStatus: "CONFIRMED" } }),
    prisma.payment.aggregate({ where: { status: "SUCCEEDED", processedAt: todayRange }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { status: "SUCCEEDED", processedAt: weekRange }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { status: "SUCCEEDED", processedAt: monthRange }, _sum: { amount: true } }),
    prisma.booking.aggregate({ where: { remainingBalance: { gt: 0 }, bookingStatus: { notIn: ["CANCELLED"] } }, _sum: { remainingBalance: true } }),
    prisma.customer.count({ where: customerScopeWhere(scope) }),
  ]);

  return {
    todaysReservations,
    upcomingReservations,
    activeTrips,
    availableVehicles,
    vehiclesOut,
    vehiclesMaintenance,
    newLeads,
    uncontactedLeads,
    quotesAwaiting,
    confirmedBookings,
    revenueToday: revenueTodayAgg._sum.amount ?? 0,
    revenueWeek: revenueWeekAgg._sum.amount ?? 0,
    revenueMonth: revenueMonthAgg._sum.amount ?? 0,
    outstandingPayments: outstandingAgg._sum.remainingBalance ?? 0,
    totalCustomers,
  };
}

export async function getTodaysOperations() {
  return prisma.booking.findMany({
    where: { date: today(), bookingStatus: { notIn: ["CANCELLED"] } },
    include: { customer: true, vehicle: true, driver: true },
    orderBy: { pickupTime: "asc" },
  });
}

export async function getHighValueLeads(scope: Scope, limit = 6) {
  return prisma.lead.findMany({
    where: { ...leadScopeWhere(scope), status: "ACTIVE", isVip: true },
    include: { customer: true, stage: true },
    orderBy: { score: "desc" },
    take: limit,
  });
}

export async function getTasksDueToday(scope: Scope, limit = 8) {
  return prisma.task.findMany({
    where: { assigneeId: scope.viewAll ? undefined : scope.userId, status: "PENDING", dueDate: { lte: endOfDay(new Date()) } },
    include: { customer: true, lead: true, booking: true },
    orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
    take: limit,
  });
}

export async function getMaintenanceAlerts(limit = 5) {
  const soon = new Date();
  soon.setDate(soon.getDate() + 7);
  return prisma.maintenanceRecord.findMany({
    where: { status: { in: ["SCHEDULED", "IN_PROGRESS"] }, scheduledDate: { lte: soon } },
    include: { vehicle: true },
    orderBy: { scheduledDate: "asc" },
    take: limit,
  });
}
