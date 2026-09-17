// Pure payment-status math — no DB access, so it's cheap to call from
// queries, actions, and UI alike without re-fetching. A Payment's stored
// `status` column only ever holds a manually-set/terminal state (PENDING,
// PAID, PARTIALLY_PAID, CANCELLED); the time-relative labels the CRM
// actually shows ("Upcoming" / "Due Soon" / "Due Today" / "Overdue") are
// derived here from dueDate so they're always correct as the calendar
// rolls forward, with no background job needed to re-stamp rows nightly.

import { differenceInCalendarDays, startOfDay } from "date-fns";

export type PaymentDisplayStatus = "PAID" | "PARTIALLY_PAID" | "CANCELLED" | "OVERDUE" | "DUE_TODAY" | "DUE_SOON" | "UPCOMING";

export const DUE_SOON_WINDOW_DAYS = 3;

export type MinimalPayment = { status: string; dueDate: Date | string };

export function getPaymentDisplayStatus(payment: MinimalPayment, now = new Date()): PaymentDisplayStatus {
  if (payment.status === "PAID" || payment.status === "PARTIALLY_PAID" || payment.status === "CANCELLED") {
    return payment.status;
  }
  const days = differenceInCalendarDays(startOfDay(new Date(payment.dueDate)), startOfDay(now));
  if (days < 0) return "OVERDUE";
  if (days === 0) return "DUE_TODAY";
  if (days <= DUE_SOON_WINDOW_DAYS) return "DUE_SOON";
  return "UPCOMING";
}

export const PAYMENT_DISPLAY_STATUS_META: Record<PaymentDisplayStatus, { label: string; color: string }> = {
  UPCOMING: { label: "Upcoming", color: "#2563eb" },
  DUE_SOON: { label: "Due Soon", color: "#a16207" },
  DUE_TODAY: { label: "Due Today", color: "#ea580c" },
  OVERDUE: { label: "Overdue", color: "#dc2626" },
  PAID: { label: "Paid", color: "#16a34a" },
  PARTIALLY_PAID: { label: "Partially Paid", color: "#0891b2" },
  CANCELLED: { label: "Cancelled", color: "#64748b" },
};

export type MinimalPlan = {
  totalRequired: number;
  amountPaidUpfront: number;
  payments: { amount: number; amountPaid: number; status: string }[];
};

/** Remaining balance = total required, minus the upfront amount, minus
 * whatever's actually been collected against each installment so far
 * (amountPaid, not amount — a PARTIALLY_PAID installment only reduces the
 * balance by what came in, not by its full scheduled amount). Always
 * computed from the underlying rows rather than stored, so it can never
 * drift out of sync with individual payment edits. */
export function computeRemainingBalance(plan: MinimalPlan): number {
  const collected = plan.payments.reduce((sum, p) => sum + (p.status === "CANCELLED" ? 0 : p.amountPaid), 0);
  return Math.max(0, plan.totalRequired - plan.amountPaidUpfront - collected);
}

/** Reminder stages, in the order the spec describes them. Each maps to a
 * fixed number of days before/after the due date (negative = after, i.e.
 * overdue) — see src/lib/payments/reminders.ts for the sweep that matches
 * these against "today". */
export type PaymentReminderStage = "7_DAYS_BEFORE" | "3_DAYS_BEFORE" | "1_DAY_BEFORE" | "DUE_DATE" | "OVERDUE";

export const PAYMENT_REMINDER_STAGES: { value: PaymentReminderStage; label: string; daysBefore: number }[] = [
  { value: "7_DAYS_BEFORE", label: "7 days before", daysBefore: 7 },
  { value: "3_DAYS_BEFORE", label: "3 days before", daysBefore: 3 },
  { value: "1_DAY_BEFORE", label: "1 day before", daysBefore: 1 },
  { value: "DUE_DATE", label: "On the due date", daysBefore: 0 },
  { value: "OVERDUE", label: "After it becomes overdue", daysBefore: -1 }, // fires once, the day after due
];
