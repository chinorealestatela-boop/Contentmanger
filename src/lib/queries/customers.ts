import { prisma } from "@/lib/prisma";
import { customerScopeWhere, type Scope } from "@/lib/queries/scope";
import type { Prisma } from "@prisma/client";

export async function listCustomers(
  scope: Scope,
  opts: { q?: string; page?: number; pageSize?: number; tier?: string; ownerId?: string } = {}
) {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 20;

  const where: Prisma.CustomerWhereInput = {
    ...customerScopeWhere(scope),
    ...(opts.ownerId ? { ownerId: opts.ownerId } : {}),
    ...(opts.tier ? { tier: opts.tier } : {}),
    ...(opts.q
      ? {
          OR: [
            { firstName: { contains: opts.q } },
            { lastName: { contains: opts.q } },
            { phone: { contains: opts.q } },
            { email: { contains: opts.q } },
            { company: { contains: opts.q } },
          ],
        }
      : {}),
  };

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      include: {
        owner: true,
        leads: { orderBy: { createdAt: "desc" }, take: 1, include: { stage: true } },
        bookings: { orderBy: { date: "desc" }, take: 1 },
      },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.customer.count({ where }),
  ]);

  return { customers, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getCustomerProfile(customerId: string) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      owner: true,
      preferredVehicle: true,
      preferredDriver: true,
      leads: { orderBy: { createdAt: "desc" }, include: { stage: true, source: true, lostReason: true } },
      bookings: { orderBy: { date: "desc" }, include: { vehicle: true, driver: true } },
      quotes: { orderBy: { createdAt: "desc" } },
      payments: { orderBy: { createdAt: "desc" } },
      tasks: { orderBy: { dueDate: "desc" }, include: { assignee: true } },
      communications: { orderBy: { occurredAt: "desc" }, include: { actor: true } },
      notes_: { orderBy: { createdAt: "desc" }, include: { author: true } },
      documents: { orderBy: { createdAt: "desc" } },
      activities: { orderBy: { createdAt: "desc" }, include: { actor: true }, take: 100 },
      followUpEnrollments: { orderBy: { startedAt: "desc" }, include: { sequence: true } },
      followUps: { orderBy: [{ followUpDate: "desc" }, { followUpTime: "desc" }], include: { assignee: true } },
    },
  });
  if (!customer) return null;

  const completedBookings = customer.bookings.filter((b) => b.bookingStatus === "COMPLETED");
  const totalSpent = completedBookings.reduce((sum, b) => sum + b.totalPrice, 0);
  const avgBookingValue = completedBookings.length ? totalSpent / completedBookings.length : 0;

  const vehicleCounts = new Map<string, number>();
  for (const b of customer.bookings) {
    if (!b.vehicle) continue;
    vehicleCounts.set(b.vehicle.name, (vehicleCounts.get(b.vehicle.name) ?? 0) + 1);
  }
  const preferredVehicles = [...vehicleCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

  return {
    ...customer,
    stats: {
      totalSpent,
      avgBookingValue,
      totalBookings: customer.bookings.length,
      completedBookings: completedBookings.length,
      preferredVehicles,
    },
  };
}
