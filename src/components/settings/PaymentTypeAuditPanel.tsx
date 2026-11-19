"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Search, AlertTriangle, CheckCircle2 } from "lucide-react";
import { runPaymentTypeAudit, type PaymentAuditResult, type PaymentAuditIssueKind } from "@/lib/actions/paymentTypeAudit";

const ISSUE_STYLE: Record<PaymentAuditIssueKind, { label: string; className: string }> = {
  MISSING_FIRST: { label: "Missing First Payment", className: "border-amber-200 bg-amber-50 text-amber-800" },
  MISSING_PICK: { label: "Missing Pick Payment", className: "border-amber-200 bg-amber-50 text-amber-800" },
  MISSING_LENDER_NAME: { label: "Missing Lender Name", className: "border-amber-200 bg-amber-50 text-amber-800" },
  DUPLICATE_DATE: { label: "Duplicate Date", className: "border-sky-200 bg-sky-50 text-sky-800" },
  PAST_DUE: { label: "Past Due", className: "border-red-200 bg-red-50 text-red-700" },
  NEEDS_REVIEW: { label: "Needs Review", className: "border-violet-200 bg-violet-50 text-violet-800" },
};

export function PaymentTypeAuditPanel() {
  const [result, setResult] = useState<PaymentAuditResult | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[13px] text-[var(--text-muted)]">
          Scans every customer with a payment on file and flags anything that needs a human look: a missing First or Pick Payment, a First Payment
          with no bank/lender name, duplicate due dates, past-due payments, or a Pick Payment whose notes mention a bank/lender and may have been
          filed under the wrong type. Nothing here is changed automatically — every flagged row needs a person to open that customer&rsquo;s profile
          and fix it by hand.
        </p>
        <button disabled={pending} onClick={() => startTransition(async () => setResult(await runPaymentTypeAudit()))} className="btn btn-primary mt-3">
          <Search size={14} /> {pending ? "Scanning…" : "Scan Payment Types"}
        </button>
      </div>

      {result && "error" in result && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{result.error}</p>}

      {result && !("error" in result) && (
        <div className="space-y-4">
          <p className="text-[12.5px] text-[var(--text-muted)]">
            Scanned {result.scannedCustomers} customer{result.scannedCustomers === 1 ? "" : "s"} with at least one payment on file.
          </p>

          <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
            <span>
              <strong>{result.cleanCustomers}</strong> customer{result.cleanCustomers === 1 ? "" : "s"} clean — nothing flagged.
            </span>
          </div>

          {result.rows.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
              <table className="w-full text-[12.5px]">
                <thead className="bg-[var(--bg-subtle)] text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">
                  <tr>
                    <th className="px-3 py-2">Customer</th>
                    <th className="px-3 py-2">First Payment Date(s)</th>
                    <th className="px-3 py-2">Pick Payment Date(s)</th>
                    <th className="px-3 py-2">What changed</th>
                    <th className="px-3 py-2">Issues</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {result.rows.map((r) => (
                    <tr key={r.customerId} className="align-top">
                      <td className="px-3 py-2 font-medium text-[var(--text)]">
                        <Link href={`/customers/${r.customerId}`} className="text-[var(--brand)] hover:underline">{r.customerName}</Link>
                      </td>
                      <td className="px-3 py-2 text-[var(--text-muted)]">{r.firstPaymentDates.length > 0 ? r.firstPaymentDates.join(", ") : "—"}</td>
                      <td className="px-3 py-2 text-[var(--text-muted)]">{r.pickPaymentDates.length > 0 ? r.pickPaymentDates.join(", ") : "—"}</td>
                      <td className="px-3 py-2 text-[var(--text-faint)]">No change — flagged for review</td>
                      <td className="px-3 py-2">
                        <ul className="space-y-1.5">
                          {r.issues.map((issue, i) => (
                            <li key={i} className={`rounded-md border px-2 py-1 text-[11.5px] ${ISSUE_STYLE[issue.kind].className}`}>
                              <span className="font-semibold">{ISSUE_STYLE[issue.kind].label}:</span> {issue.detail}
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {result.rows.length === 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-2 text-[13px] text-[var(--text-muted)]">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>No issues found.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
