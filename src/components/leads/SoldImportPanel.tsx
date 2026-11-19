"use client";

import { useActionState } from "react";
import { UploadCloud, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { importSoldCustomersCsv, type SoldImportResult } from "@/lib/actions/soldImport";

// Bulk-adds sold deals + their down payment schedule from a "Sold
// Customers / Down Payment Report" CSV export — same upload pattern as
// CsvImportPanel.tsx (inventory), different target action/result shape.
export function SoldImportPanel() {
  const [result, formAction, pending] = useActionState<SoldImportResult | null, FormData>(importSoldCustomersCsv, null);

  return (
    <div className="space-y-3">
      <form action={formAction} className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input type="file" name="file" accept=".csv,text/csv" required className="input flex-1" />
        <button type="submit" disabled={pending} className="btn btn-primary shrink-0">
          <UploadCloud size={14} /> {pending ? "Importing…" : "Import Sold Customers"}
        </button>
      </form>

      <p className="text-[12px] text-[var(--text-faint)]">
        Accepts either the Sold Customers / Down Payment Report (Name, Phone, Email, Salesperson, Vehicle Year/Make/Model, VIN, Stock Number,
        Transaction Date, Required Down Payment, Amount Paid, Down Payment Status, Next Payment Date/Amount, Payment Notes) or the richer Sold Customer
        Audit export, which also carries lender fields (Lien Holder, Amount Financed, First Payment Due Date/Amount). Each row creates a sold lead, a
        sale record, a Pick Payment schedule for anything still owed to the dealership, and — when both the due date and amount are on file — a First
        Payment record for the customer&rsquo;s first loan payment to their bank or lender. All visible right away on this page and on the
        customer&rsquo;s profile. Safe to re-upload: a vehicle that already has a sale on file is skipped, not duplicated.
      </p>

      {result && (
        <div className="space-y-2">
          <div
            className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
              result.status === "SUCCESS" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {result.status === "SUCCESS" ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <XCircle size={16} className="mt-0.5 shrink-0" />}
            <span>
              {result.status === "SUCCESS"
                ? `Imported ${result.imported} of ${result.totalRows} rows${result.skippedDuplicate ? ` — ${result.skippedDuplicate} already on file, skipped` : ""}${
                    result.backfilledFirstPayments ? ` — ${result.backfilledFirstPayments} already-imported customer(s) were missing a First Payment, now added` : ""
                  }${result.errors.length ? ` — ${result.errors.length} row(s) had a problem, see below` : ""}.`
                : `Import failed: ${result.errorMessage}`}
            </span>
          </div>

          {result.unmatchedSalespeople.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-800">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>
                Couldn&rsquo;t match the salesperson name on file for {result.unmatchedSalespeople.length} row(s) — assigned to you instead, reassign
                manually if needed: {result.unmatchedSalespeople.map((u) => `${u.row} (${u.name})`).join(", ")}
              </span>
            </div>
          )}

          {result.missingFirstPaymentInfo.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-800">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>
                {result.missingFirstPaymentInfo.length} row(s) had only a First Payment Due Date <em>or</em> Amount, not both — no First Payment was
                created, enter it manually on the customer&rsquo;s profile: {result.missingFirstPaymentInfo.map((m) => m.row).join(", ")}
              </span>
            </div>
          )}

          {result.errors.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] text-red-700">
              <p className="font-semibold">Rows that need attention:</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {result.errors.map((e, i) => (
                  <li key={i}>
                    {e.row}: {e.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
