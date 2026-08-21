import { prisma } from "@/lib/prisma";
import { customerScopeWhere, type Scope } from "@/lib/queries/scope";

export async function globalSearch(scope: Scope, q: string) {
  if (!q.trim()) return { customers: [], vehicles: [], appointments: [] };

  const customerWhere = customerScopeWhere(scope);

  const [customers, vehicles, appointments] = await Promise.all([
    prisma.customer.findMany({
      where: {
        ...customerWhere,
        OR: [
          { firstName: { contains: q } },
          { lastName: { contains: q } },
          { phone: { contains: q } },
          { email: { contains: q } },
          { notes: { some: { body: { contains: q } } } },
          { leads: { some: { OR: [{ source: { name: { contains: q } } }, { stage: { name: { contains: q } } }, { temperature: { contains: q } }, { salesNotes: { contains: q } }] } } },
        ],
      },
      include: { owner: true, leads: { take: 1, orderBy: { createdAt: "desc" }, include: { stage: true } } },
      take: 20,
    }),
    prisma.vehicle.findMany({
      where: {
        OR: [
          { vin: { contains: q } },
          { stockNumber: { contains: q } },
          { make: { contains: q } },
          { model: { contains: q } },
        ],
      },
      take: 20,
    }),
    prisma.appointment.findMany({
      where: {
        salespersonId: scope.viewAll ? undefined : scope.userId,
        OR: [{ notes: { contains: q } }, { type: { contains: q } }, { customer: { OR: [{ firstName: { contains: q } }, { lastName: { contains: q } }] } }],
      },
      include: { customer: true },
      take: 10,
    }),
  ]);

  return { customers, vehicles, appointments };
}
