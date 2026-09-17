// Read-side queries backing the Payments dashboard (Feature 4) and the
// customer-search payment filters (Feature 15). Scoped the same way every
// other customer-adjacent query is — see src/lib/queries/scope.ts.

import { prisma } from "@/lib/prisma";
import { customerScopeWhere, type Scope } from "@/lib/queries/scope";
import { addDays, endOfDay, startOfDay } from "date-fns";

export type PaymentListItem = {
  id: string;
  amount: number;
  dueDate: Date;
  status: string;
  amountPaid: number;
  notes: string | null;
  referenceNumber: string | null;
  customerId: string;
  customerName: string;
  customerPhone: string | null;
  vehicleLabel: string | null;
  salespersonId: string | null;
  salespersonName: string | null;
};

async function customerIdsInScope(scope: Scope): Promise<string[] | undefined> {
  if (scope.viewAll) return undefined;
  const rows = await prisma.customer.findMany({ where: customerScopeWhere(scope), select: { id: true } });
  return rows.map((r) => r.id);
}

/** Every outstanding (PENDING or LATE) payment in scope, with enough
 * customer/salesperson info to render the dashboard table and its quick
 * actions without a second round-trip per row. */
export async function getPaymentDashboardData(scope: Scope) {
  const customerIds = await customerIdsInScope(scope);
  const base = customerIds ? { customerId: { in: customerIds } } : {};

  const [outstandingRows, paidRows] = await Promise.all([
    prisma.payment.findMany({
      where: { ...base, status: { in: ["PENDING", "LATE"] } },
      include: {
        customer: { select: { firstName: true, lastName: true, phone: true, ownerId: true, owner: { select: { firstName: true, lastName: true } } } },
        lead: { select: { assigneeId: true, assignee: { select: { firstName: true, lastName: true } } } },
      },
      orderBy: { dueDate: "asc" },
    }),
    prisma.payment.findMany({ where: { ...base, status: { in: ["PAID", "PARTIALLY_PAID"] } }, select: { amountPaid: true } }),
  ]);

  // Vehicle label comes from the customer's primary sale, if any — a
  // best-effort lookup batched by customer, not per-row.
  const custIds = [...new Set(outstandingRows.map((p) => p.customerId))];
  const sales = custIds.length
    ? await prisma.sale.findMany({ where: { customerId: { in: custIds } }, orderBy: { saleDate: "desc" }, include: { vehicle: true } })
    : [];
  const vehicleByCustomer = new Map(sales.map((s) => [s.customerId, `${s.vehicle.year} ${s.vehicle.make} ${s.vehicle.model}`]));

  const items: PaymentListItem[] = outstandingRows.map((p) => ({
    id: p.id,
    amount: p.amount,
    dueDate: p.dueDate,
    status: p.status,
    amountPaid: p.amountPaid,
    notes: p.notes,
    referenceNumber: p.referenceNumber,
    customerId: p.customerId,
    customerName: `${p.customer.firstName} ${p.customer.lastName}`,
    customerPhone: p.customer.phone,
    vehicleLabel: vehicleByCustomer.get(p.customerId) ?? null,
    salespersonId: p.lead?.assigneeId ?? p.customer.ownerId,
    salespersonName: p.lead?.assignee ? `${p.lead.assignee.firstName} ${p.lead.assignee.lastName}` : `${p.customer.owner.firstName} ${p.customer.owner.lastName}`,
  }));

  const now = new Date();
  const today = { start: startOfDay(now), end: endOfDay(now) };
  const tomorrow = { start: startOfDay(addDays(now, 1)), end: endOfDay(addDays(now, 1)) };

  const dueToday = items.filter((i) => i.status === "PENDING" && i.dueDate >= today.start && i.dueDate <= today.end);
  const dueTomorrow = items.filter((i) => i.status === "PENDING" && i.dueDate >= tomorrow.start && i.dueDate <= tomorrow.end);
  const due3Days = items.filter((i) => i.status === "PENDING" && i.dueDate > today.end && i.dueDate <= endOfDay(addDays(now, 3)));
  const late = items.filter((i) => i.status === "LATE");
  const within = (days: number) => items.filter((i) => i.status === "PENDING" && i.dueDate > today.end && i.dueDate <= endOfDay(addDays(now, days)));

  return {
    all: items,
    dueToday,
    dueTomorrow,
    due3Days,
    overdue: late,
    upcoming7: within(7),
    upcoming30: within(30),
    upcoming60: within(60),
    upcoming90: within(90),
    totalScheduled: items.length,
    totalOwed: items.reduce((sum, i) => sum + (i.amount - i.amountPaid), 0),
    overdueTotal: late.reduce((sum, i) => sum + (i.amount - i.amountPaid), 0),
    totalCollected: paidRows.reduce((sum, p) => sum + p.amountPaid, 0),
  };
}

/** Small summary for the main dashboard's stat tiles — avoids pulling the
 * full payment list just to show two counts. */
export async function getPaymentDashboardCounts(scope: Scope) {
  const customerIds = await customerIdsInScope(scope);
  const base = customerIds ? { customerId: { in: customerIds } } : {};
  const now = new Date();
  const week = addDays(now, 7);

  const [dueThisWeek, overdue] = await Promise.all([
    prisma.payment.count({ where: { ...base, status: "PENDING", dueDate: { gte: startOfDay(now), lte: endOfDay(week) } } }),
    prisma.payment.count({ where: { ...base, status: "LATE" } }),
  ]);

  return { dueThisWeek, overdue };
}
