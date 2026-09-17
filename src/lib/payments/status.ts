// Pure payment-status math — no DB access, so it's cheap to call from
// queries, actions, and UI alike without re-fetching.
//
// Payment.status stores the AUTHORITATIVE state: PENDING, PAID,
// PARTIALLY_PAID, LATE, CANCELLED, or WAIVED. PAID/PARTIALLY_PAID/
// CANCELLED/WAIVED are only ever set by a person (markPaymentPaid,
// cancelPayment, markPaymentWaived). LATE is the one status a person
// never sets directly — the reminder sweep (src/lib/payments/
// reminders.ts) flips a PENDING payment to LATE automatically the first
// time it runs after the due date has passed with nothing recorded, per
// "a scheduled payment remains Pending until confirmed as received... if
// a payment is past its due date and remains unpaid, mark it Late."
//
// getPaymentDisplayStatus below only adds time-relative *sub-labels*
// (Due Soon / Due Today / Upcoming) on top of a still-PENDING payment —
// it never overrides a real stored status, and it never invents "Late"
// itself (that would require knowing "now" everywhere display happens
// and would drift from what the sweep actually recorded).

import { differenceInCalendarDays, startOfDay } from "date-fns";

export type PaymentStoredStatus = "PENDING" | "PAID" | "PARTIALLY_PAID" | "LATE" | "CANCELLED" | "WAIVED";

export type PaymentDisplayStatus = "PAID" | "PARTIALLY_PAID" | "LATE" | "CANCELLED" | "WAIVED" | "DUE_TODAY" | "DUE_SOON" | "UPCOMING";

export const DUE_SOON_WINDOW_DAYS = 3;

export type MinimalPayment = { status: string; dueDate: Date | string };

export function getPaymentDisplayStatus(payment: MinimalPayment, now = new Date()): PaymentDisplayStatus {
  if (payment.status !== "PENDING") return payment.status as PaymentDisplayStatus;
  const days = differenceInCalendarDays(startOfDay(new Date(payment.dueDate)), startOfDay(now));
  if (days <= 0) return "DUE_TODAY";
  if (days <= DUE_SOON_WINDOW_DAYS) return "DUE_SOON";
  return "UPCOMING";
}

export const PAYMENT_DISPLAY_STATUS_META: Record<PaymentDisplayStatus, { label: string; color: string }> = {
  UPCOMING: { label: "Upcoming", color: "#2563eb" },
  DUE_SOON: { label: "Due Soon", color: "#a16207" },
  DUE_TODAY: { label: "Due Today", color: "#ea580c" },
  LATE: { label: "Late", color: "#dc2626" },
  PAID: { label: "Paid", color: "#16a34a" },
  PARTIALLY_PAID: { label: "Partially Paid", color: "#0891b2" },
  CANCELLED: { label: "Cancelled", color: "#64748b" },
  WAIVED: { label: "Waived", color: "#8b5cf6" },
};

export const PAYMENT_STATUS_OPTIONS: { value: PaymentStoredStatus; label: string }[] = [
  { value: "PENDING", label: "Pending" },
  { value: "PAID", label: "Paid" },
  { value: "PARTIALLY_PAID", label: "Partially Paid" },
  { value: "LATE", label: "Late" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "WAIVED", label: "Waived" },
];

export type MinimalPlan = {
  totalRequired: number;
  amountPaidUpfront: number;
  payments: { amount: number; amountPaid: number; status: string }[];
};

/** Remaining balance = total required, minus the upfront amount, minus
 * whatever's actually been collected against each installment so far
 * (amountPaid, not amount — a PARTIALLY_PAID installment only reduces the
 * balance by what came in, not by its full scheduled amount). A WAIVED
 * payment reduces the balance by its full scheduled amount even though
 * nothing was collected — waiving it means it's no longer owed. Always
 * computed from the underlying rows rather than stored, so it can never
 * drift out of sync with individual payment edits. */
export function computeRemainingBalance(plan: MinimalPlan): number {
  const credited = plan.payments.reduce((sum, p) => {
    if (p.status === "CANCELLED") return sum;
    if (p.status === "WAIVED") return sum + p.amount;
    return sum + p.amountPaid;
  }, 0);
  return Math.max(0, plan.totalRequired - plan.amountPaidUpfront - credited);
}

/** Reminder stages, in the order the spec describes them. Each maps to a
 * fixed number of days before the due date (0 = due date itself) — see
 * src/lib/payments/reminders.ts for the sweep that matches these against
 * "today," including catch-up behavior for a missed cron run. Overdue
 * reminders are handled separately (recurring, not a fixed day offset —
 * see PaymentAutomationSettings.overdueRepeat). */
export type PaymentReminderStage = "7_DAYS_BEFORE" | "3_DAYS_BEFORE" | "1_DAY_BEFORE" | "DUE_DATE" | "OVERDUE";

/** The four "before/on due date" stages, each fired at most once per
 * payment. OVERDUE is deliberately not in this list — it doesn't have a
 * fixed day offset, it recurs on a configurable interval after the due
 * date has passed (see PaymentAutomationSettings.overdueRepeat), so it's
 * scheduled by separate logic in the sweep. */
export const PAYMENT_REMINDER_STAGES: { value: PaymentReminderStage; label: string; daysBefore: number }[] = [
  { value: "7_DAYS_BEFORE", label: "7 days before", daysBefore: 7 },
  { value: "3_DAYS_BEFORE", label: "3 days before", daysBefore: 3 },
  { value: "1_DAY_BEFORE", label: "1 day before", daysBefore: 1 },
  { value: "DUE_DATE", label: "On the due date", daysBefore: 0 },
];

/** All five stages, including OVERDUE — used wherever the UI needs to
 * show/configure every stage (Automation Center, SMS template picker),
 * as opposed to PAYMENT_REMINDER_STAGES above which only the "before due
 * date" sweep loop iterates over. */
export const ALL_PAYMENT_REMINDER_STAGES: { value: PaymentReminderStage; label: string }[] = [
  ...PAYMENT_REMINDER_STAGES,
  { value: "OVERDUE", label: "Overdue (recurring)" },
];
