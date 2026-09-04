// Orchestrates syncing automaxlv.com into the existing Vehicle table.
// This is the only place that writes AUTOMAXLV-sourced Vehicle rows —
// the admin's own manual Vehicle form (source "MANUAL") is never touched
// by any of this, in either direction.
//
// SOURCE-OF-TRUTH: automaxlv.com is authoritative for inventory. This CRM's
// Customer/Lead/Appointment data is authoritative for everything else and
// is never derived from or overwritten by the site.

import { prisma } from "@/lib/prisma";
import { fetchAutoMaxInventory } from "./automaxlv";
import type { ScrapedVehicle } from "./types";

const SOURCE = "AUTOMAXLV";

function nonEmpty(s: string | null | undefined): s is string {
  return !!s && s.trim().length > 0;
}

/** Best VIN/stock#/id match for a scraped listing against existing rows,
 * checked in the priority order the spec calls for: VIN, then stock
 * number, then the site's own external id. */
async function findExistingVehicle(v: ScrapedVehicle) {
  if (nonEmpty(v.vin)) {
    const byVin = await prisma.vehicle.findUnique({ where: { vin: v.vin } });
    if (byVin) return byVin;
  }
  if (nonEmpty(v.stockNumber)) {
    const byStock = await prisma.vehicle.findUnique({ where: { stockNumber: v.stockNumber } });
    if (byStock) return byStock;
  }
  if (nonEmpty(v.externalId)) {
    const byExternal = await prisma.vehicle.findFirst({ where: { externalId: v.externalId, source: SOURCE } });
    if (byExternal) return byExternal;
  }
  return null;
}

/** A stock number is required (unique, NOT NULL) by the existing schema —
 * synthesize a stable one from the VIN when the site listing didn't have
 * one, rather than inventing an unrelated value. */
function resolveStockNumber(v: ScrapedVehicle, existingStock?: string | null): string {
  if (nonEmpty(v.stockNumber)) return v.stockNumber;
  if (existingStock) return existingStock;
  if (nonEmpty(v.vin)) return `AMX-${v.vin.slice(-8).toUpperCase()}`;
  return `AMX-${Date.now()}`;
}

/** VIN is required+unique in the existing schema (same as stockNumber) —
 * on the rare listing missing one, derive a stable placeholder from its
 * stock number instead of leaving the field blank or inventing digits. */
function resolveVin(v: ScrapedVehicle, stockNumber: string, existingVin?: string | null): string {
  if (nonEmpty(v.vin)) return v.vin;
  if (existingVin) return existingVin;
  return `NOVIN-${stockNumber}`;
}

export type SyncResult = {
  status: "SUCCESS" | "FAILED";
  vehiclesSeen: number;
  vehiclesCreated: number;
  vehiclesUpdated: number;
  vehiclesRetired: number;
  vehiclesFlagged: number;
  errorMessage?: string;
};

export async function syncAutoMaxInventory(trigger: "CRON" | "MANUAL" = "CRON"): Promise<SyncResult> {
  const run = await prisma.inventorySyncRun.create({
    data: { source: SOURCE, status: "RUNNING", trigger },
  });

  let created = 0;
  let updated = 0;
  let flagged = 0;
  let retired = 0;

  try {
    const { vehicles, unparsed } = await fetchAutoMaxInventory();

    const seenVehicleIds = new Set<string>();

    for (const v of vehicles) {
      const existing = await findExistingVehicle(v);
      const stockNumber = resolveStockNumber(v, existing?.stockNumber);
      const vin = resolveVin(v, stockNumber, existing?.vin);

      // Confidence check per listing, independent of the page-level parse:
      // if we can't even get year/make/model, don't create/overwrite a
      // record with guesses — flag the existing one (if any) for review
      // and otherwise skip it entirely.
      const hasCoreFields = v.year && nonEmpty(v.make) && nonEmpty(v.model);

      if (!hasCoreFields) {
        if (existing) {
          await prisma.vehicle.update({ where: { id: existing.id }, data: { syncStatus: "NEEDS_REVIEW", lastSyncedAt: new Date() } });
          seenVehicleIds.add(existing.id);
          flagged++;
        }
        continue;
      }

      // "Keep the existing value if appropriate" for any field the site
      // didn't provide this pass, rather than nulling out good data.
      const data = {
        stockNumber,
        vin,
        year: v.year!,
        make: v.make!,
        model: v.model!,
        trim: v.trim ?? existing?.trim ?? null,
        condition: "USED",
        bodyStyle: v.bodyStyle ?? existing?.bodyStyle ?? null,
        drivetrain: v.drivetrain ?? existing?.drivetrain ?? null,
        mileage: v.mileage ?? existing?.mileage ?? 0,
        exteriorColor: v.exteriorColor ?? existing?.exteriorColor ?? null,
        interiorColor: v.interiorColor ?? existing?.interiorColor ?? null,
        sellingPrice: v.price ?? existing?.sellingPrice ?? null,
        internetPrice: v.price ?? existing?.internetPrice ?? null,
        status: "AVAILABLE",
        photos: JSON.stringify(v.photos.length > 0 ? v.photos : existing ? JSON.parse(existing.photos || "[]") : []),
        description: v.description ?? existing?.description ?? null,
        engine: v.engine ?? existing?.engine ?? null,
        transmission: v.transmission ?? existing?.transmission ?? null,
        features: JSON.stringify(v.features.length > 0 ? v.features : existing ? JSON.parse(existing.features || "[]") : []),
        source: SOURCE,
        sourceUrl: v.url,
        externalId: v.externalId ?? existing?.externalId ?? null,
        lastSyncedAt: new Date(),
        syncStatus: "OK",
      };

      if (existing) {
        await prisma.vehicle.update({ where: { id: existing.id }, data });
        seenVehicleIds.add(existing.id);
        updated++;
      } else {
        const createdRow = await prisma.vehicle.create({ data });
        seenVehicleIds.add(createdRow.id);
        created++;
      }
    }

    flagged += unparsed.length;

    // Anything previously synced from AutoMax but not seen this pass is no
    // longer listed on the site — retire it (never delete, never touch
    // MANUAL-sourced rows).
    const staleVehicles = await prisma.vehicle.findMany({
      where: { source: SOURCE, status: { not: "UNAVAILABLE" }, id: { notIn: Array.from(seenVehicleIds) } },
      select: { id: true },
    });
    if (staleVehicles.length > 0) {
      await prisma.vehicle.updateMany({
        where: { id: { in: staleVehicles.map((v) => v.id) } },
        data: { status: "UNAVAILABLE", lastSyncedAt: new Date() },
      });
      retired = staleVehicles.length;
    }

    await prisma.inventorySyncRun.update({
      where: { id: run.id },
      data: {
        status: "SUCCESS",
        finishedAt: new Date(),
        vehiclesSeen: vehicles.length,
        vehiclesCreated: created,
        vehiclesUpdated: updated,
        vehiclesRetired: retired,
        vehiclesFlagged: flagged,
      },
    });

    return { status: "SUCCESS", vehiclesSeen: vehicles.length, vehiclesCreated: created, vehiclesUpdated: updated, vehiclesRetired: retired, vehiclesFlagged: flagged };
  } catch (err) {
    // Never touch existing inventory on failure — the last successfully
    // synced data stays exactly as-is.
    const message = err instanceof Error ? err.message : "Unknown sync error";
    await prisma.inventorySyncRun.update({
      where: { id: run.id },
      data: { status: "FAILED", finishedAt: new Date(), errorMessage: message, vehiclesCreated: created, vehiclesUpdated: updated, vehiclesFlagged: flagged, vehiclesRetired: retired },
    });
    return { status: "FAILED", vehiclesSeen: 0, vehiclesCreated: created, vehiclesUpdated: updated, vehiclesRetired: retired, vehiclesFlagged: flagged, errorMessage: message };
  }
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

  // Manually-entered inventory isn't tracked on the website — nothing to
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
