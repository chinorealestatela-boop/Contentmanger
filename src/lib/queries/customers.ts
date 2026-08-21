import { prisma } from "@/lib/prisma";
import { customerScopeWhere, type Scope } from "@/lib/queries/scope";
import type { Prisma } from "@prisma/client";

export async function listCustomers(
  scope: Scope,
  opts: { q?: string; page?: number; pageSize?: number; temperature?: string; ownerId?: string } = {}
) {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 20;

  const where: Prisma.CustomerWhereInput = {
    ...customerScopeWhere(scope),
    ...(opts.ownerId ? { ownerId: opts.ownerId } : {}),
    ...(opts.q
      ? {
          OR: [
            { firstName: { contains: opts.q } },
            { lastName: { contains: opts.q } },
            { phone: { contains: opts.q } },
            { email: { contains: opts.q } },
          ],
        }
      : {}),
    ...(opts.temperature ? { leads: { some: { temperature: opts.temperature, status: "ACTIVE" } } } : {}),
  };

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      include: {
        owner: true,
        leads: { orderBy: { createdAt: "desc" }, take: 1, include: { stage: true } },
        vehicleInterests: { where: { isPrimary: true }, include: { vehicle: true }, take: 1 },
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
  return prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      owner: true,
      leads: {
        orderBy: { createdAt: "desc" },
        include: { stage: true, source: true, lostReason: true },
      },
      vehicleInterests: { include: { vehicle: true }, orderBy: { createdAt: "desc" } },
      tradeIns: { orderBy: { createdAt: "desc" } },
      appointments: { orderBy: { date: "desc" }, include: { vehicle: true, salesperson: true } },
      testDrives: { orderBy: { date: "desc" }, include: { vehicle: true, salesperson: true } },
      tasks: { orderBy: { dueDate: "desc" }, include: { assignee: true } },
      communications: { orderBy: { occurredAt: "desc" }, include: { actor: true } },
      notes: { orderBy: { createdAt: "desc" }, include: { author: true } },
      offers: { orderBy: { createdAt: "desc" }, include: { vehicle: true } },
      sales: { orderBy: { saleDate: "desc" }, include: { vehicle: true, salesperson: true } },
      activities: { orderBy: { createdAt: "desc" }, include: { actor: true }, take: 100 },
      followUpEnrollments: { orderBy: { startedAt: "desc" }, include: { sequence: true } },
    },
  });
}
