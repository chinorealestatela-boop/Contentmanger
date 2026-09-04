"use client";

import { useState, useTransition } from "react";
import { RefreshCcw, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { runInventorySyncNow } from "@/lib/actions/inventory";
import type { SyncResult } from "@/lib/inventory/sync";

export function InventorySyncPanel() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<SyncResult | null>(null);

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setResult(await runInventorySyncNow());
          })
        }
        className="btn btn-primary"
      >
        <RefreshCcw size={14} className={pending ? "animate-spin" : ""} />
        {pending ? "Syncing…" : "Sync Now"}
      </button>

      {result && (
        <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${result.status === "SUCCESS" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"}`}>
          {result.status === "SUCCESS" ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <XCircle size={16} className="mt-0.5 shrink-0" />}
          <span>
            {result.status === "SUCCESS"
              ? `Synced ${result.vehiclesSeen} vehicles — ${result.vehiclesCreated} new, ${result.vehiclesUpdated} updated, ${result.vehiclesRetired} marked unavailable${result.vehiclesFlagged ? `, ${result.vehiclesFlagged} flagged for review` : ""}.`
              : `Sync failed: ${result.errorMessage}`}
          </span>
        </div>
      )}
      {result?.status === "FAILED" && (
        <p className="flex items-start gap-1.5 text-[12px] text-[var(--text-faint)]">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" /> Existing inventory was left untouched — nothing was deleted or marked sold because of this failure.
        </p>
      )}
    </div>
  );
}
