// Deferred-payment-completion follow-up (additive feature — thank-you +
// referral-program nudge). Fires once, synchronously, right after
// markPaymentPaid() settles the last outstanding payment on a plan — this
// is a direct user action ("I just collected this payment"), not a
// time-based event, so it doesn't belong in the reminder sweep
// (src/lib/payments/reminders.ts) alongside the before/overdue stages.
//
// Idempotency lives entirely on PaymentPlan.completedAt/followUpTaskId
// (see the schema comment on PaymentPlan): checkAndCreateCompletionFollowUp
// re-reads the plan fresh and only ever acts while both are still null, so
// calling it after every markPaymentPaid — even on a plan that isn't
// actually complete yet, or one that already got its follow-up — can never
// create a second Task or Notification for the same plan.

import { prisma } from "@/lib/prisma";
import { notifyAdmin } from "@/lib/notify/adminAlert";
import { logActivity } from "@/lib/activity";
import { formatCurrency } from "@/lib/format";

type SettlementCheckable = { status: string; amountPaid: number };

/** A plan is "complete" once every non-cancelled payment on it has landed
 * on a terminal settled state (PAID or WAIVED) and at least one payment
 * was actually paid — a plan whose only payment was waived was forgiven,
 * not completed, and shouldn't trigger a thank-you. */
export function isPlanFullySettled(payments: SettlementCheckable[]): boolean {
  const active = payments.filter((p) => p.status !== "CANCELLED");
  if (active.length === 0) return false;
  const allResolved = active.every((p) => p.status === "PAID" || p.status === "WAIVED");
  const anyPaid = active.some((p) => p.status === "PAID");
  return allResolved && anyPaid;
}

/** Total actually collected against a plan — upfront amount plus whatever
 * came in against each installment. Shared by the completion check (to
 * decide the "amount paid" shown in the follow-up task/notification) and
 * the dashboard/customer-profile displays, so they never disagree. */
export function computeTotalCollected(plan: { amountPaidUpfront: number; payments: { amountPaid: number }[] }): number {
  return plan.amountPaidUpfront + plan.payments.reduce((sum, p) => sum + p.amountPaid, 0);
}

async function resolveAssignee(customerId: string, leadId: string | null): Promise<string | null> {
  if (leadId) {
    const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { assigneeId: true } });
    if (lead) return lead.assigneeId;
  }
  const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: { ownerId: true } });
  return customer?.ownerId ?? null;
}

/** Best-effort "what did they buy" label — mirrors the same fallback chain
 * used for the payments dashboard (src/lib/queries/payments.ts): most
 * recent Sale first, then the customer's primary vehicle-of-interest. */
export async function vehicleLabelForCustomer(customerId: string): Promise<string | null> {
  const sale = await prisma.sale.findFirst({ where: { customerId }, orderBy: { saleDate: "desc" }, include: { vehicle: true } });
  if (sale) return `${sale.vehicle.year} ${sale.vehicle.make} ${sale.vehicle.model}`;

  const interest = await prisma.customerVehicle.findFirst({ where: { customerId, isPrimary: true }, include: { vehicle: true } });
  if (interest?.vehicle) return `${interest.vehicle.year} ${interest.vehicle.make} ${interest.vehicle.model}`;
  if (interest) return [interest.year, interest.make, interest.model].filter(Boolean).join(" ") || null;
  return null;
}

/** Call this right after any write that could complete a plan — today
 * that's only markPaymentPaid(). Safe to call unconditionally: it re-reads
 * the plan itself, so it's a no-op unless the plan is both newly settled
 * and hasn't already had a follow-up created. */
export async function checkAndCreateCompletionFollowUp(planId: string, actorId: string) {
  const plan = await prisma.paymentPlan.findUnique({
    where: { id: planId },
    include: { payments: true, customer: true },
  });
  if (!plan || plan.completedAt || plan.followUpTaskId) return null;
  if (!isPlanFullySettled(plan.payments)) return null;

  const amountPaid = computeTotalCollected(plan);
  const completedAt = new Date();
  const assigneeId = (await resolveAssignee(plan.customerId, plan.leadId)) ?? actorId;
  const customerName = `${plan.customer.firstName} ${plan.customer.lastName}`;
  const amountLabel = formatCurrency(amountPaid || plan.totalRequired);
  const vehicleLabel = await vehicleLabelForCustomer(plan.customerId);
  const vehicleSuffix = vehicleLabel ? ` for the ${vehicleLabel}` : "";

  const task = await prisma.task.create({
    data: {
      customerId: plan.customerId,
      leadId: plan.leadId,
      title: `Send thank-you + referral message to ${customerName}`,
      type: "REFERRAL",
      priority: "HIGH",
      dueDate: completedAt,
      assigneeId,
      source: "AUTOMATION",
      notes: `Deferred down payment completed — ${amountLabel}${vehicleSuffix}. Send a thank-you message and mention the $200 referral program.`,
    },
  });

  await prisma.paymentPlan.update({
    where: { id: plan.id },
    data: { status: "COMPLETED", completedAt, followUpTaskId: task.id },
  });

  await notifyAdmin({
    userId: assigneeId,
    type: "PAYMENT_COMPLETED",
    title: "💰 Deferred Payment Completed — Follow-Up Needed",
    body: `${customerName} has completed their deferred down payment of ${amountLabel}${vehicleSuffix}. Send them a thank-you message and remind them about the $200 referral program.`,
    link: `/customers/${plan.customerId}`,
  });

  await logActivity({
    customerId: plan.customerId,
    leadId: plan.leadId,
    type: "PAYMENT_PLAN_COMPLETED",
    description: `Deferred down payment completed — ${amountLabel}${vehicleSuffix} paid in full. Thank-you/referral follow-up task created for ${customerName}.`,
    actorId,
    metadata: { planId: plan.id, taskId: task.id },
  });

  return task;
}
