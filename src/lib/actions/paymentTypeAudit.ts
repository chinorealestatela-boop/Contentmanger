"use server";

// Admin-only audit for the FIRST vs PICK Payment Type split (see the
// Payment.paymentType comment in prisma/schema.prisma). Every payment row
// created before this split existed defaulted to PICK — that's correct by
// definition, nothing to migrate there. The real risk this surfaces: a
// PICK payment whose notes actually describe a bank/lender payment
// (logged back when there was only one generic "payment" concept, or
// mis-entered since) — those get flagged "Needs Review," never
// auto-reclassified. Modeled on src/lib/actions/phoneAudit.ts's bucketed,
// read-only, never-guess approach: this tool only ever reads and reports,
// same as that one. Nothing is changed until a person looks at a flagged
// row and edits that payment by hand from the customer's profile.

import { prisma } from "@/lib/prisma";
import { requireScope } from "@/lib/queries/scope";
import { formatCurrency, formatDate } from "@/lib/format";

// The exact clues the user described for telling the two payment types
// apart from free text: a bank/lender mention, or the phrase "first
// payment" showing up on what's filed as a Pick payment.
const LENDER_KEYWORDS = /\b(bank|lender|credit union|financ\w*|loan|lien|repossess\w*|first payment)\b/i;

export type PaymentAuditIssueKind = "MISSING_FIRST" | "MISSING_PICK" | "MISSING_LENDER_NAME" | "DUPLICATE_DATE" | "PAST_DUE" | "NEEDS_REVIEW";

export type PaymentAuditIssue = { kind: PaymentAuditIssueKind; detail: string };

export type PaymentAuditRow = {
  customerId: string;
  customerName: string;
  firstPaymentDates: string[];
  pickPaymentDates: string[];
  issues: PaymentAuditIssue[];
};

export type PaymentAuditResult = { error: string } | { scannedCustomers: number; cleanCustomers: number; rows: PaymentAuditRow[] };

export async function runPaymentTypeAudit(): Promise<PaymentAuditResult> {
  const scope = await requireScope();
  if (scope.role !== "ADMIN") return { error: "Only admins can run this." };

  const payments = await prisma.payment.findMany({
    include: { customer: { select: { firstName: true, lastName: true } } },
    orderBy: { dueDate: "asc" },
  });

  const byCustomer = new Map<string, { name: string; payments: typeof payments }>();
  for (const p of payments) {
    const bucket = byCustomer.get(p.customerId);
    if (bucket) bucket.payments.push(p);
    else byCustomer.set(p.customerId, { name: `${p.customer.firstName} ${p.customer.lastName}`, payments: [p] });
  }

  const rows: PaymentAuditRow[] = [];

  for (const [customerId, { name, payments: custPayments }] of byCustomer) {
    const firstPayments = custPayments.filter((p) => p.paymentType === "FIRST");
    const pickPayments = custPayments.filter((p) => p.paymentType === "PICK");
    const issues: PaymentAuditIssue[] = [];

    if (firstPayments.length === 0) {
      issues.push({ kind: "MISSING_FIRST", detail: "No First Payment on file for this customer." });
    }
    if (pickPayments.length === 0) {
      issues.push({ kind: "MISSING_PICK", detail: "No Pick Payment on file for this customer." });
    }

    for (const fp of firstPayments) {
      if (!fp.paidToName) {
        issues.push({ kind: "MISSING_LENDER_NAME", detail: `First Payment due ${formatDate(fp.dueDate)} has no bank/lender name on file.` });
      }
    }

    const byDate = new Map<string, number>();
    for (const p of custPayments) {
      const label = formatDate(p.dueDate);
      byDate.set(label, (byDate.get(label) ?? 0) + 1);
    }
    for (const [dateLabel, count] of byDate) {
      if (count > 1) {
        issues.push({ kind: "DUPLICATE_DATE", detail: `More than one payment due ${dateLabel} — check these aren't the same payment logged twice.` });
      }
    }

    for (const p of custPayments) {
      if (p.status === "LATE") {
        const kindLabel = p.paymentType === "FIRST" ? "First" : "Pick";
        issues.push({ kind: "PAST_DUE", detail: `${kindLabel} payment of ${formatCurrency(p.amount)} was due ${formatDate(p.dueDate)} and is still unpaid.` });
      }
    }

    for (const p of pickPayments) {
      const haystack = `${p.notes ?? ""} ${p.referenceNumber ?? ""}`;
      if (LENDER_KEYWORDS.test(haystack)) {
        issues.push({
          kind: "NEEDS_REVIEW",
          detail: `Pick Payment due ${formatDate(p.dueDate)} has a note mentioning a bank/lender — "${(p.notes ?? "").slice(0, 140)}" — may actually belong under First Payment. Not changed automatically.`,
        });
      }
    }

    if (issues.length > 0) {
      rows.push({
        customerId,
        customerName: name,
        firstPaymentDates: firstPayments.map((p) => formatDate(p.dueDate)),
        pickPaymentDates: pickPayments.map((p) => formatDate(p.dueDate)),
        issues,
      });
    }
  }

  rows.sort((a, b) => a.customerName.localeCompare(b.customerName));

  return { scannedCustomers: byCustomer.size, cleanCustomers: byCustomer.size - rows.length, rows };
}
