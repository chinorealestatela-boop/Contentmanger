import { prisma } from "@/lib/prisma";
import { customerScopeWhere, leadScopeWhere, type Scope } from "@/lib/queries/scope";

export async function globalSearch(scope: Scope, q: string) {
  if (!q.trim()) return { customers: [], leads: [], bookings: [], vehicles: [], drivers: [], quotes: [], payments: [] };

  const customerWhere = customerScopeWhere(scope);

  const [customers, leads, bookings, vehicles, drivers, quotes, payments] = await Promise.all([
    prisma.customer.findMany({
      where: {
        ...customerWhere,
        OR: [
          { firstName: { contains: q } },
          { lastName: { contains: q } },
          { phone: { contains: q } },
          { email: { contains: q } },
          { company: { contains: q } },
        ],
      },
      include: { owner: true },
      take: 15,
    }),
    prisma.lead.findMany({
      where: {
        ...leadScopeWhere(scope),
        OR: [
          { serviceRequested: { contains: q } },
          { pickupLocation: { contains: q } },
          { dropoffLocation: { contains: q } },
          { customer: { OR: [{ firstName: { contains: q } }, { lastName: { contains: q } }] } },
        ],
      },
      include: { customer: true, stage: true },
      take: 15,
    }),
    prisma.booking.findMany({
      where: {
        OR: [
          { bookingNumber: { contains: q } },
          { pickupAddress: { contains: q } },
          { dropoffAddress: { contains: q } },
          { customer: { OR: [{ firstName: { contains: q } }, { lastName: { contains: q } }] } },
        ],
      },
      include: { customer: true, vehicle: true },
      take: 15,
    }),
    prisma.vehicle.findMany({
      where: { OR: [{ vin: { contains: q } }, { fleetNumber: { contains: q } }, { make: { contains: q } }, { model: { contains: q } }, { name: { contains: q } }] },
      take: 15,
    }),
    prisma.driver.findMany({
      where: { OR: [{ firstName: { contains: q } }, { lastName: { contains: q } }, { phone: { contains: q } }] },
      take: 10,
    }),
    prisma.quote.findMany({
      where: { OR: [{ quoteNumber: { contains: q } }, { customer: { OR: [{ firstName: { contains: q } }, { lastName: { contains: q } }] } }] },
      include: { customer: true },
      take: 10,
    }),
    prisma.payment.findMany({
      where: { customer: { OR: [{ firstName: { contains: q } }, { lastName: { contains: q } }] } },
      include: { customer: true },
      take: 10,
    }),
  ]);

  return { customers, leads, bookings, vehicles, drivers, quotes, payments };
}
