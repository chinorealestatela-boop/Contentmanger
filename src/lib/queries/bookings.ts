import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export type BookingFilters = {
  q?: string;
  status?: string;
  vehicleId?: string;
  driverId?: string;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
};

export async function listBookings(filters: BookingFilters = {}) {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;

  const where: Prisma.BookingWhereInput = {
    ...(filters.status ? { bookingStatus: filters.status } : {}),
    ...(filters.vehicleId ? { vehicleId: filters.vehicleId } : {}),
    ...(filters.driverId ? { driverId: filters.driverId } : {}),
    ...(filters.from || filters.to ? { date: { gte: filters.from, lte: filters.to } } : {}),
    ...(filters.q
      ? {
          OR: [
            { bookingNumber: { contains: filters.q } },
            { customer: { OR: [{ firstName: { contains: filters.q } }, { lastName: { contains: filters.q } }, { phone: { contains: filters.q } }] } },
          ],
        }
      : {}),
  };

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      include: { customer: true, vehicle: true, driver: true },
      orderBy: { date: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.booking.count({ where }),
  ]);

  return { bookings, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getBookingDetail(id: string) {
  return prisma.booking.findUnique({
    where: { id },
    include: {
      customer: true,
      lead: true,
      vehicle: true,
      driver: true,
      trip: true,
      payments: { orderBy: { createdAt: "desc" } },
      tasks: { orderBy: { dueDate: "asc" } },
      activities: { orderBy: { createdAt: "desc" }, include: { actor: true }, take: 30 },
      communications: { orderBy: { occurredAt: "desc" } },
      documents: true,
      quote: true,
    },
  });
}

export async function getOperationsBoardBookings() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setDate(end.getDate() + 3);
  end.setHours(23, 59, 59, 999);

  return prisma.booking.findMany({
    where: { date: { gte: start, lte: end }, bookingStatus: { notIn: ["CANCELLED"] } },
    include: { customer: true, vehicle: true, driver: true },
    orderBy: { pickupTime: "asc" },
  });
}
