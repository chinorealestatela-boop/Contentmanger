// Orchestrates syncing automaxlv.com's live inventory into the existing
// Vehicle table. This is the "site is reachable and lets us scrape it"
// path — see csvSync.ts for the manual-upload fallback that's currently
// the reliable one (automaxlv.com blocks automated access behind
// Cloudflare; see automaxlv.ts's header for how that was confirmed).
// Either path is the only place that writes AUTOMAXLV-sourced Vehicle
// rows — the admin's own manual Vehicle form (source "MANUAL") is never
// touched by any of this, in either direction.
//
// SOURCE-OF-TRUTH: automaxlv.com is authoritative for inventory. This CRM's
// Customer/Lead/Appointment data is authoritative for everything else and
// is never derived from or overwritten by the site.

import { prisma } from "@/lib/prisma";
import { fetchAutoMaxInventory } from "./automaxlv";
import { applyInventoryResult, SOURCE } from "./engine";
import type { SyncResult } from "./engine";

export type { SyncResult, SyncTrigger } from "./engine";

export async function syncAutoMaxInventory(trigger: "CRON" | "MANUAL" = "CRON"): Promise<SyncResult> {
  return applyInventoryResult(fetchAutoMaxInventory, trigger);
}

/** One retry, short delay — a single flaky request shouldn't fail an
 * entire sync pass or log a false "site is down". */
export async function syncAutoMaxInventoryWithRetry(trigger: "CRON" | "MANUAL" = "CRON"): Promise<SyncResult> {
  const first = await syncAutoMaxInventory(trigger);
  if (first.status === "SUCCESS") return first;
  await new Promise((r) => setTimeout(r, 3000));
  return syncAutoMaxInventory(trigger);
}

// ── Live availability re-check, called immediately before a test-drive
// booking is confirmed (see src/lib/actions/booking.ts) ──────────────────

export async function verifyVehicleStillListed(vehicleId: string): Promise<{ available: boolean; reason?: string }> {
  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle) return { available: false, reason: "Vehicle not found." };

  // Manually-entered inventory (and a synced vehicle with no live VDP URL
  // to check — e.g. one that only ever came in through a CSV upload
  // without a URL column) isn't tracked on the website — nothing to
  // re-verify, trust the CRM's own status field.
  if (vehicle.source !== SOURCE || !vehicle.sourceUrl) {
    return { available: vehicle.status === "AVAILABLE" };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(vehicle.sourceUrl, { method: "GET", signal: controller.signal });
    clearTimeout(timeout);

    if (res.status === 404 || res.status === 410) {
      await prisma.vehicle.update({ where: { id: vehicle.id }, data: { status: "UNAVAILABLE", lastSyncedAt: new Date() } });
      return { available: false, reason: "This vehicle is no longer available. Please select another vehicle from our current inventory." };
    }
    if (!res.ok) {
      // Transient site error — don't block a legitimate customer over it,
      // fall back to our last-synced status.
      return { available: vehicle.status === "AVAILABLE", reason: vehicle.status !== "AVAILABLE" ? "This vehicle is no longer available. Please select another vehicle from our current inventory." : undefined };
    }

    const html = await res.text();
    const soldMarkers = /\b(sold|no longer available|vehicle unavailable)\b/i;
    if (soldMarkers.test(html)) {
      await prisma.vehicle.update({ where: { id: vehicle.id }, data: { status: "UNAVAILABLE", lastSyncedAt: new Date() } });
      return { available: false, reason: "This vehicle is no longer available. Please select another vehicle from our current inventory." };
    }

    return { available: true };
  } catch {
    // Site unreachable right now — don't hard-block on a transient network
    // error, trust the last successful sync instead.
    return { available: vehicle.status === "AVAILABLE", reason: vehicle.status !== "AVAILABLE" ? "This vehicle is no longer available. Please select another vehicle from our current inventory." : undefined };
  }
}
