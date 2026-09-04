"use server";

import { requireScope } from "@/lib/queries/scope";
import { syncAutoMaxInventoryWithRetry, type SyncResult } from "@/lib/inventory/sync";
import { revalidatePath } from "next/cache";

export async function runInventorySyncNow(): Promise<SyncResult> {
  await requireScope();
  const result = await syncAutoMaxInventoryWithRetry("MANUAL");
  revalidatePath("/settings/inventory-sync");
  revalidatePath("/vehicles");
  revalidatePath("/book");
  return result;
}
