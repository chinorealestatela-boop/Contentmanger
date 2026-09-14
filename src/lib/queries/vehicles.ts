import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export type VehicleFilters = {
  q?: string;
  availability?: string;
  vehicleType?: string;
  page?: number;
  pageSize?: number;
};

export async function listVehicles(filters: VehicleFilters = {}) {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 24;

  const where: Prisma.VehicleWhereInput = {
    isActive: true,
    ...(filters.availability ? { availability: filters.availability } : {}),
    ...(filters.vehicleType ? { vehicleType: filters.vehicleType } : {}),
    ...(filters.q
      ? {
          OR: [
            { name: { contains: filters.q } },
            { make: { contains: filters.q } },
            { model: { contains: filters.q } },
            { fleetNumber: { contains: filters.q } },
            { vin: { contains: filters.q } },
          ],
        }
      : {}),
  };

  const [vehicles, total] = await Promise.all([
    prisma.vehicle.findMany({
      where,
      include: { assignedDriver: true, _count: { select: { bookings: true } } },
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.vehicle.count({ where }),
  ]);

  return { vehicles, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getVehicleDetail(id: string) {
  return prisma.vehicle.findUnique({
    where: { id },
    include: {
      assignedDriver: true,
      maintenanceRecords: { orderBy: { scheduledDate: "desc" } },
      gpsPings: { orderBy: { recordedAt: "desc" }, take: 1 },
      bookings: { include: { customer: true, driver: true }, orderBy: { date: "desc" }, take: 15 },
      documents: { orderBy: { createdAt: "desc" } },
      preferredByCustomers: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

export async function getFleetStats() {
  const [total, available, onTrip, maintenance, offline] = await Promise.all([
    prisma.vehicle.count({ where: { isActive: true } }),
    prisma.vehicle.count({ where: { isActive: true, availability: "AVAILABLE" } }),
    prisma.vehicle.count({ where: { isActive: true, availability: "ON_TRIP" } }),
    prisma.vehicle.count({ where: { isActive: true, availability: "MAINTENANCE" } }),
    prisma.vehicle.count({ where: { isActive: true, availability: "OFFLINE" } }),
  ]);
  return { total, available, onTrip, maintenance, offline };
}

/** Checks whether a vehicle already has a booking overlapping the given
 * date + time window (spec §7: "prevent double-booking a vehicle"). Two
 * bookings on the same calendar date are treated as conflicting unless
 * their time ranges (pickupTime–endTime) don't overlap; if either is
 * missing an end time, a conservative 2-hour block is assumed. */
export async function findVehicleConflicts(vehicleId: string, date: Date, pickupTime: string, endTime: string | null, excludeBookingId?: string) {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const existing = await prisma.booking.findMany({
    where: {
      vehicleId,
      date: { gte: dayStart, lte: dayEnd },
      bookingStatus: { notIn: ["CANCELLED"] },
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
    },
    include: { customer: true },
  });

  const [h, m] = pickupTime.split(":").map(Number);
  const startMin = h * 60 + m;
  const endMin = endTime ? toMinutes(endTime) : startMin + 120;

  return existing.filter((b) => {
    const bStart = toMinutes(b.pickupTime);
    const bEnd = b.endTime ? toMinutes(b.endTime) : bStart + 120;
    return startMin < bEnd && bStart < endMin;
  });
}

function toMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
