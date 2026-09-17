import { prisma } from "@/lib/prisma";
import { customerScopeWhere, type Scope } from "@/lib/queries/scope";
import { getPaymentDisplayStatus, type PaymentDisplayStatus } from "@/lib/payments/status";

// Recognized as a payment-status search term regardless of case/spacing —
// lets "overdue payments", "due this week", etc. work as plain search text
// alongside name/phone/email, per Feature 15.
const PAYMENT_STATUS_KEYWORDS: Record<string, PaymentDisplayStatus[]> = {
  overdue: ["OVERDUE"],
  "past due": ["OVERDUE"],
  "due today": ["DUE_TODAY"],
  "due soon": ["DUE_SOON"],
  upcoming: ["UPCOMING"],
  paid: ["PAID"],
  "partially paid": ["PARTIALLY_PAID"],
  "payment due": ["OVERDUE", "DUE_TODAY", "DUE_SOON", "UPCOMING"],
};

export async function globalSearch(scope: Scope, q: string) {
  if (!q.trim()) return { customers: [], vehicles: [], appointments: [], followUps: [], payments: [] };

  const customerWhere = customerScopeWhere(scope);
  const qLower = q.trim().toLowerCase();
  const matchedStatuses = Object.entries(PAYMENT_STATUS_KEYWORDS).find(([kw]) => qLower.includes(kw))?.[1];

  const [customers, vehicles, appointments, followUps, paymentsRaw] = await Promise.all([
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
        OR: [{ notes: { contains: q } }, { type: { contains: q } }, { location: { contains: q } }, { customer: { OR: [{ firstName: { contains: q } }, { lastName: { contains: q } }] } }],
      },
      include: { customer: true },
      take: 10,
    }),
    prisma.followUp.findMany({
      where: {
        assigneeId: scope.viewAll ? undefined : scope.userId,
        OR: [{ topic: { contains: q } }, { notes: { contains: q } }, { completionNotes: { contains: q } }, { customer: { OR: [{ firstName: { contains: q } }, { lastName: { contains: q } }, { phone: { contains: q } }] } }],
      },
      include: { customer: true },
      take: 10,
    }),
    // Matched either by a recognized status keyword ("overdue", "due
    // today", ...) or by customer name/phone — a plain "$500" or a
    // customer's name should also surface their outstanding payments.
    prisma.payment.findMany({
      where: {
        status: "PENDING",
        customer: customerWhere,
        ...(matchedStatuses
          ? {}
          : { customer: { ...customerWhere, OR: [{ firstName: { contains: q } }, { lastName: { contains: q } }, { phone: { contains: q } }] } }),
      },
      include: { customer: true },
      take: 20,
    }),
  ]);

  const payments = (matchedStatuses ? paymentsRaw.filter((p) => matchedStatuses.includes(getPaymentDisplayStatus(p))) : paymentsRaw).slice(0, 10);

  return { customers, vehicles, appointments, followUps, payments };
}
