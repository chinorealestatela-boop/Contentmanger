"use server";

import { headers } from "next/headers";
import { requireScope } from "@/lib/queries/scope";
import type { SyncResult } from "@/lib/inventory/sync";
import { importInventoryFromCsv } from "@/lib/inventory/csvSync";
import { revalidatePath } from "next/cache";

// Deliberately does NOT import syncAutoMaxInventoryWithRetry (or anything
// else from src/lib/inventory/sync.ts, which itself imports automaxlv.ts)
// — only the SyncResult type, which is erased at compile time and pulls in
// no runtime code. Importing the real function here used to drag
// playwright-core into this action's own serverless bundle for
// /settings/inventory-sync, which has no outputFileTracingIncludes entry
// in next.config.ts and so failed at runtime with "Cannot find module
// .../playwright-core/browsers.json" — the same error
// /api/cron/inventory-sync used to hit before it got that entry. Instead,
// "Sync Now" calls that already-correctly-configured route over HTTP, so
// playwright-core is only ever bundled in the one place it's traced for.
// importInventoryFromCsv below is safe to import directly, by contrast —
// it comes from csvSync.ts, which has no import path into automaxlv.ts at
// all (see that file's header).
async function resolveBaseUrl() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) {
    const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
    return `${proto}://${host}`;
  }
  // Fallback for contexts with no request headers (shouldn't normally
  // happen for a button-triggered server action, but keeps this from
  // throwing instead of failing with a clear "Sync failed").
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

const FAILED_STUB: Omit<SyncResult, "errorMessage"> = {
  status: "FAILED",
  vehiclesSeen: 0,
  vehiclesCreated: 0,
  vehiclesUpdated: 0,
  vehiclesRetired: 0,
  vehiclesFlagged: 0,
};

export async function runInventorySyncNow(): Promise<SyncResult> {
  await requireScope();

  let result: SyncResult;
  try {
    const baseUrl = await resolveBaseUrl();
    const res = await fetch(`${baseUrl}/api/cron/inventory-sync?trigger=MANUAL`, {
      headers: { "x-cron-secret": process.env.CRON_SECRET ?? "" },
      cache: "no-store",
    });
    const body = await res.json().catch(() => null);
    if (!body || typeof body.status !== "string") {
      result = { ...FAILED_STUB, errorMessage: `The sync route returned an unexpected response (HTTP ${res.status}).` };
    } else {
      result = body as SyncResult;
    }
  } catch (err) {
    // Never let a network hiccup calling our own sync route surface as an
    // uncaught exception in the "Sync Now" button — report it the same way
    // a sync failure from the site itself would be reported.
    result = { ...FAILED_STUB, errorMessage: err instanceof Error ? err.message : "Could not reach the sync route." };
  }

  revalidatePath("/settings/inventory-sync");
  revalidatePath("/vehicles");
  revalidatePath("/book");
  return result;
}

const MAX_CSV_BYTES = 10 * 1024 * 1024; // 10MB — comfortably larger than any real dealer inventory export

// useActionState-shaped: (previousResult, formData) => Promise<result>.
export async function importInventoryCsv(_prev: SyncResult | null, formData: FormData): Promise<SyncResult> {
  await requireScope();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ...FAILED_STUB, errorMessage: "Choose a CSV file to import first." };
  }
  if (file.size > MAX_CSV_BYTES) {
    return { ...FAILED_STUB, errorMessage: `File is too large (${Math.round(file.size / 1024 / 1024)}MB) — max 10MB.` };
  }

  let result: SyncResult;
  try {
    const text = await file.text();
    result = await importInventoryFromCsv(text);
  } catch (err) {
    result = { ...FAILED_STUB, errorMessage: err instanceof Error ? err.message : "Could not read the uploaded file." };
  }

  revalidatePath("/settings/inventory-sync");
  revalidatePath("/vehicles");
  revalidatePath("/book");
  return result;
}
