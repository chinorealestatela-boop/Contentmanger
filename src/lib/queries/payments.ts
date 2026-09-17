// Read-side queries backing the Payments dashboard (Feature 4) and the
// customer-search payment filters (Feature 15). Scoped the same way every
// other customer-adjacent query is — see src/lib/queries/scope.ts.

import { prisma } from "@/lib/prisma";
import { customerScopeWhere, type Scope } from "@/lib/queries/scope";
import { addDays, endOfDay, startOfDay } from "date-fns";
import { getPaymentDisplayStatus } from "@/lib/payments/status";

export type PaymentListItem = {
  id: string;
  amount: number;
  dueDate: Date;
  status: string;
  amountPaid: number;
  notes: string | null;
  customerId: string;
  customerName: string;
  customerPhone: string | null;
  salespersonId: string | null;
  salespersonName: string | null;
};

async function customerIdsInScope(scope: Scope): Promise<string[] | undefined> {
  if (scope.viewAll) return undefined;
  const rows = await prisma.customer.findMany({ where: customerScopeWhere(scope), select: { id: true } });
  return rows.map((r) => r.id);
}

/** Every non-terminal (PENDING) payment in scope, with enough customer/
 * salesperson info to render the dashboard table and its quick actions
 * without a second round-trip per row. */
export async function getPaymentDashboardData(scope: Scope) {
  const customerIds = await customerIdsInScope(scope);

  const payments = await prisma.payment.findMany({
    where: { status: "PENDING", ...(customerIds ? { customerId: { in: customerIds } } : {}) },
    include: {
      customer: { select: { firstName: true, lastName: true, phone: true, ownerId: true, owner: { select: { firstName: true, lastName: true } } } },
      lead: { select: { assigneeId: true, assignee: { select: { firstName: true, lastName: true } } } },
    },
    orderBy: { dueDate: "asc" },
  });

  const items: PaymentListItem[] = payments.map((p) => ({
    id: p.id,
    amount: p.amount,
    dueDate: p.dueDate,
    status: p.status,
    amountPaid: p.amountPaid,
    notes: p.notes,
    customerId: p.customerId,
    customerName: `${p.customer.firstName} ${p.customer.lastName}`,
    customerPhone: p.customer.phone,
    salespersonId: p.lead?.assigneeId ?? p.customer.ownerId,
    salespersonName: p.lead?.assignee ? `${p.lead.assignee.firstName} ${p.lead.assignee.lastName}` : `${p.customer.owner.firstName} ${p.customer.owner.lastName}`,
  }));

  const now = new Date();
  const today = { start: startOfDay(now), end: endOfDay(now) };

  const dueToday = items.filter((i) => i.dueDate >= today.start && i.dueDate <= today.end);
  const overdue = items.filter((i) => getPaymentDisplayStatus(i) === "OVERDUE");
  const within = (days: number) => items.filter((i) => i.dueDate > today.end && i.dueDate <= endOfDay(addDays(now, days)));

  return {
    all: items,
    dueToday,
    overdue,
    upcoming7: within(7),
    upcoming30: within(30),
    upcoming60: within(60),
    upcoming90: within(90),
    totalOwed: items.reduce((sum, i) => sum + (i.amount - i.amountPaid), 0),
    overdueTotal: overdue.reduce((sum, i) => sum + (i.amount - i.amountPaid), 0),
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
    prisma.payment.count({ where: { ...base, status: "PENDING", dueDate: { lt: startOfDay(now) } } }),
  ]);

  return { dueThisWeek, overdue };
}
