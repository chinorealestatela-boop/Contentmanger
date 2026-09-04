"use client";

import { useActionState } from "react";
import { UploadCloud, CheckCircle2, XCircle } from "lucide-react";
import { importInventoryCsv } from "@/lib/actions/inventory";
import type { SyncResult } from "@/lib/inventory/sync";

// Recommended path (see /settings/inventory-sync page copy): automaxlv.com
// blocks automated access (Cloudflare bot protection), confirmed from
// production logs — this uploads the dealer's own export instead, through
// the same dedupe/upsert/retire engine as the live scrape would use.
export function CsvImportPanel() {
  const [result, formAction, pending] = useActionState<SyncResult | null, FormData>(importInventoryCsv, null);

  return (
    <div className="space-y-3">
      <form action={formAction} className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input type="file" name="file" accept=".csv,text/csv" required className="input flex-1" />
        <button type="submit" disabled={pending} className="btn btn-primary shrink-0">
          <UploadCloud size={14} /> {pending ? "Importing…" : "Import CSV"}
        </button>
      </form>

      <p className="text-[12px] text-[var(--text-faint)]">
        Export your <strong className="text-[var(--text-muted)]">full current inventory</strong> from DealerCenter (or any spreadsheet tool) as a CSV — like a
        live sync, this replaces the prior AutoMax-sourced list: any previously-imported vehicle not present in the file gets marked unavailable, so
        uploading only a partial list will incorrectly hide the rest. Expected columns (any common header name works, case-insensitive): VIN or Stock
        Number (required), Year, Make, Model, Trim, Price, Mileage, Exterior/Interior Color, Engine, Transmission, Drivetrain, Body Style, Description,
        Features, Photos, and optionally a Status column (a row marked &ldquo;sold&rdquo;/&ldquo;pending&rdquo; is skipped, not imported as available).
      </p>

      {result && (
        <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${result.status === "SUCCESS" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"}`}>
          {result.status === "SUCCESS" ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <XCircle size={16} className="mt-0.5 shrink-0" />}
          <span>
            {result.status === "SUCCESS"
              ? `Imported ${result.vehiclesSeen} rows — ${result.vehiclesCreated} new, ${result.vehiclesUpdated} updated, ${result.vehiclesRetired} marked unavailable${result.vehiclesFlagged ? `, ${result.vehiclesFlagged} flagged/skipped` : ""}.`
              : `Import failed: ${result.errorMessage}`}
          </span>
        </div>
      )}
    </div>
  );
}
