// Manual fallback sync path: a dealer-uploaded CSV inventory export,
// applied through the same dedupe/upsert/retire engine as the live scrape
// (see engine.ts) — see csvImport.ts's header for why this path exists.
//
// Deliberately imports NOTHING from sync.ts or automaxlv.ts — only
// engine.ts and csvImport.ts, neither of which touches playwright-core.
// This file is what src/lib/actions/inventory.ts's CSV-import server
// action imports, so that action's own serverless bundle (same route,
// /settings/inventory-sync, as the "Sync Now" button) never pulls in the
// headless-browser dependency it doesn't need for this path. See that
// action file's comment for the full story on why that specifically
// matters on Vercel.

import { applyInventoryResult } from "./engine";
import type { SyncResult } from "./engine";
import { parseInventoryCsv } from "./csvImport";

export async function importInventoryFromCsv(csvText: string): Promise<SyncResult> {
  return applyInventoryResult(async () => parseInventoryCsv(csvText), "CSV_UPLOAD");
}
