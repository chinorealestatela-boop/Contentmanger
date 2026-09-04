// Shared dedupe/upsert/retire engine for writing an InventoryFetchResult
// (from any source) into the existing Vehicle table. Deliberately kept in
// its own module with NO import of automaxlv.ts (the headless-Chromium
// scraper) — sync.ts (live scrape) and csvSync.ts (manual CSV upload,
// src/lib/actions/inventory.ts's "Import" action) both depend on this file
// instead of on each other, so importing the CSV path never drags
// playwright-core into a serverless bundle that doesn't need it (see the
// comment at the top of src/lib/actions/inventory.ts for why that
// specifically matters on Vercel).

import { prisma } from "@/lib/prisma";
import type { ScrapedVehicle, InventoryFetchResult } from "./types";

export const SOURCE = "AUTOMAXLV";

export type SyncTrigger = "CRON" | "MANUAL" | "CSV_UPLOAD";

export type SyncResult = {
  status: "SUCCESS" | "FAILED";
  vehiclesSeen: number;
  vehiclesCreated: number;
  vehiclesUpdated: number;
  vehiclesRetired: number;
  vehiclesFlagged: number;
  errorMessage?: string;
};

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
 * synthesize a stable one from the VIN when the listing didn't have one,
 * rather than inventing an unrelated value. */
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

/** Given a fetch result (from the live automaxlv.com scrape or a
 * manually-uploaded CSV), dedupe/upsert/retire exactly the same way. The
 * only thing that differs between sources is how `fetchResult` was
 * produced. */
export async function applyInventoryResult(fetchResult: () => Promise<InventoryFetchResult>, trigger: SyncTrigger): Promise<SyncResult> {
  const run = await prisma.inventorySyncRun.create({
    data: { source: SOURCE, status: "RUNNING", trigger },
  });

  let created = 0;
  let updated = 0;
  let flagged = 0;
  let retired = 0;

  try {
    const { vehicles, unparsed } = await fetchResult();

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

      // "Keep the existing value if appropriate" for any field this pass
      // didn't provide, rather than nulling out good data.
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
    // longer listed — retire it (never delete, never touch MANUAL-sourced
    // rows). Applies the same way whether "not seen" means the live site
    // stopped listing it or this CSV upload simply didn't include it.
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
