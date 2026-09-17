// Backs the new /sold-leads page — the CRM previously had no dedicated
// view of sold customers (only a purple "Sold" badge scattered across the
// regular customer list — see the architecture research this was built
// from). This is the "sold customers section" the downpayment-tracking
// feature plugs into, mirroring how /lost-leads already exists for LOST.

import { prisma } from "@/lib/prisma";
import { leadScopeWhere, type Scope } from "@/lib/queries/scope";
import { computeRemainingBalance } from "@/lib/payments/status";

export type SoldLeadItem = {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string | null;
  vehicle: string | null;
  stockNumber: string | null;
  vin: string | null;
  salePrice: number | null;
  salespersonName: string;
  soldAt: Date | null;
  hasPaymentPlan: boolean;
  outstandingBalance: number;
  lateCount: number;
  nextDueDate: Date | null;
};

export async function listSoldLeads(scope: Scope): Promise<SoldLeadItem[]> {
  const leads = await prisma.lead.findMany({
    where: { ...leadScopeWhere(scope), status: "SOLD" },
    include: {
      customer: true,
      assignee: true,
      sales: { include: { vehicle: true }, orderBy: { saleDate: "desc" }, take: 1 },
      paymentPlans: { include: { payments: true } },
    },
    orderBy: { soldAt: "desc" },
  });

  return leads.map((l) => {
    const sale = l.sales[0];
    const allPayments = l.paymentPlans.flatMap((p) => p.payments);
    const outstandingBalance = l.paymentPlans.reduce((sum, p) => sum + computeRemainingBalance(p), 0);
    const lateCount = allPayments.filter((p) => p.status === "LATE").length;
    const nextDue = allPayments
      .filter((p) => p.status === "PENDING")
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0];

    return {
      id: l.id,
      customerId: l.customerId,
      customerName: `${l.customer.firstName} ${l.customer.lastName}`,
      customerPhone: l.customer.phone,
      vehicle: sale ? `${sale.vehicle.year} ${sale.vehicle.make} ${sale.vehicle.model}` : null,
      stockNumber: sale?.vehicle.stockNumber ?? null,
      vin: sale?.vehicle.vin ?? null,
      salePrice: sale?.salePrice ?? null,
      salespersonName: `${l.assignee.firstName} ${l.assignee.lastName}`,
      soldAt: l.soldAt,
      hasPaymentPlan: l.paymentPlans.length > 0,
      outstandingBalance,
      lateCount,
      nextDueDate: nextDue?.dueDate ?? null,
    };
  });
}
