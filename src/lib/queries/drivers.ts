import { prisma } from "@/lib/prisma";
import { startOfDay, endOfDay } from "date-fns";

export async function listDrivers(filters: { q?: string; status?: string } = {}) {
  return prisma.driver.findMany({
    where: {
      isActive: true,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.q
        ? { OR: [{ firstName: { contains: filters.q } }, { lastName: { contains: filters.q } }, { phone: { contains: filters.q } }] }
        : {}),
    },
    include: { assignedVehicles: true, _count: { select: { bookings: true } } },
    orderBy: { firstName: "asc" },
  });
}

export async function getDriverDetail(id: string) {
  return prisma.driver.findUnique({
    where: { id },
    include: {
      assignedVehicles: true,
      bookings: { include: { customer: true, vehicle: true, trip: true }, orderBy: { date: "desc" }, take: 20 },
      documents: true,
      preferredByCustomers: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

export async function getDriverStats() {
  const [total, available, enRoute, offDuty] = await Promise.all([
    prisma.driver.count({ where: { isActive: true } }),
    prisma.driver.count({ where: { isActive: true, status: "AVAILABLE" } }),
    prisma.driver.count({ where: { isActive: true, status: { in: ["EN_ROUTE", "WITH_CLIENT", "ASSIGNED"] } } }),
    prisma.driver.count({ where: { isActive: true, status: "OFF_DUTY" } }),
  ]);
  return { total, available, enRoute, offDuty };
}

/** Resolves the Driver profile for the currently logged-in user (mobile
 * driver console). Returns null if this user has no linked Driver row. */
export async function getDriverProfileForUser(userId: string) {
  return prisma.driver.findUnique({ where: { userId } });
}

export async function getDriverTripsToday(driverId: string) {
  return prisma.booking.findMany({
    where: { driverId, date: { gte: startOfDay(new Date()), lte: endOfDay(new Date()) }, bookingStatus: { notIn: ["CANCELLED"] } },
    include: { customer: true, vehicle: true, trip: true },
    orderBy: { pickupTime: "asc" },
  });
}

export async function getDriverUpcomingTrips(driverId: string) {
  return prisma.booking.findMany({
    where: { driverId, date: { gt: endOfDay(new Date()) }, bookingStatus: { notIn: ["CANCELLED", "COMPLETED"] } },
    include: { customer: true, vehicle: true },
    orderBy: { date: "asc" },
    take: 10,
  });
}
