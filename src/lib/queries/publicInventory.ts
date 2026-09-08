// Read-only queries behind the public "Available Vehicles" pages
// (src/app/(site)/inventory/**). Deliberately separate from
// src/lib/queries/vehicles.ts (the admin CRM's inventory queries) — that
// module's getVehicleDetail() includes customer/lead/appointment/sale
// relations, which must never reach an unauthenticated visitor. Every
// query here is scoped to status: "AVAILABLE" so a vehicle that's sold,
// on hold, in transit, or marked unavailable disappears from customer
// view immediately — including a direct hit on its old detail-page URL.

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parsePhotos, parseFeatures } from "@/lib/utils";
import { BODY_STYLES } from "@/lib/constants";

const PAGE_SIZE = 24;

export type InventorySort = "priceAsc" | "priceDesc" | "yearDesc" | "yearAsc" | "mileageAsc" | "mileageDesc" | "newest";

export type InventoryFilters = {
  q?: string;
  make?: string;
  model?: string;
  bodyStyle?: string;
  minPrice?: string;
  maxPrice?: string;
  minYear?: string;
  maxYear?: string;
  maxMileage?: string;
  features?: string; // comma-separated
  sort?: InventorySort;
  page?: number;
};

const SORT_MAP: Record<InventorySort, Prisma.VehicleOrderByWithRelationInput[]> = {
  priceAsc: [{ internetPrice: "asc" }, { sellingPrice: "asc" }],
  priceDesc: [{ internetPrice: "desc" }, { sellingPrice: "desc" }],
  yearDesc: [{ year: "desc" }],
  yearAsc: [{ year: "asc" }],
  mileageAsc: [{ mileage: "asc" }],
  mileageDesc: [{ mileage: "desc" }],
  newest: [{ createdAt: "desc" }],
};

const KNOWN_BODY_STYLES = new Set(BODY_STYLES.map((b) => b.value));

function buildWhere(filters: InventoryFilters): Prisma.VehicleWhereInput {
  const where: Prisma.VehicleWhereInput = { status: "AVAILABLE" };
  const and: Prisma.VehicleWhereInput[] = [];

  if (filters.q) {
    const q = filters.q.trim();
    if (q) {
      and.push({
        OR: [
          { make: { contains: q } },
          { model: { contains: q } },
          { trim: { contains: q } },
          { stockNumber: { contains: q } },
          { vin: { contains: q } },
          { bodyStyle: { contains: q } },
          { description: { contains: q } },
          { features: { contains: q } },
        ],
      });
    }
  }

  if (filters.make) and.push({ make: filters.make });
  if (filters.model) and.push({ model: filters.model });

  if (filters.bodyStyle) {
    and.push(
      filters.bodyStyle === "OTHER"
        ? { OR: [{ bodyStyle: null }, { bodyStyle: { notIn: [...KNOWN_BODY_STYLES] } }] }
        : { bodyStyle: filters.bodyStyle }
    );
  }

  const minPrice = filters.minPrice ? Number(filters.minPrice) : undefined;
  const maxPrice = filters.maxPrice ? Number(filters.maxPrice) : undefined;
  if (minPrice !== undefined && !Number.isNaN(minPrice)) {
    and.push({ OR: [{ internetPrice: { gte: minPrice } }, { AND: [{ internetPrice: null }, { sellingPrice: { gte: minPrice } }] }] });
  }
  if (maxPrice !== undefined && !Number.isNaN(maxPrice)) {
    and.push({ OR: [{ internetPrice: { lte: maxPrice } }, { AND: [{ internetPrice: null }, { sellingPrice: { lte: maxPrice } }] }] });
  }

  const minYear = filters.minYear ? Number(filters.minYear) : undefined;
  const maxYear = filters.maxYear ? Number(filters.maxYear) : undefined;
  if (minYear !== undefined && !Number.isNaN(minYear)) and.push({ year: { gte: minYear } });
  if (maxYear !== undefined && !Number.isNaN(maxYear)) and.push({ year: { lte: maxYear } });

  const maxMileage = filters.maxMileage ? Number(filters.maxMileage) : undefined;
  if (maxMileage !== undefined && !Number.isNaN(maxMileage)) and.push({ mileage: { lte: maxMileage } });

  const features = filters.features?.split(",").map((f) => f.trim()).filter(Boolean) ?? [];
  for (const f of features) and.push({ features: { contains: f } });

  if (and.length > 0) where.AND = and;
  return where;
}

export async function searchPublicInventory(filters: InventoryFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const where = buildWhere(filters);
  const orderBy = SORT_MAP[filters.sort ?? "newest"];

  const [rows, total] = await Promise.all([
    prisma.vehicle.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        stockNumber: true,
        year: true,
        make: true,
        model: true,
        trim: true,
        condition: true,
        bodyStyle: true,
        mileage: true,
        exteriorColor: true,
        interiorColor: true,
        sellingPrice: true,
        internetPrice: true,
        photos: true,
        features: true,
      },
    }),
    prisma.vehicle.count({ where }),
  ]);

  const vehicles = rows.map((v) => ({ ...v, photos: parsePhotos(v.photos), features: parseFeatures(v.features) }));
  return { vehicles, total, page, pageSize: PAGE_SIZE, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

/** Everything needed to populate the filter sidebar, computed from the
 * current AVAILABLE inventory only — makes/models/features that exist
 * only on sold/unavailable vehicles never show up as filter options.
 * Cheap even at a few hundred vehicles: this selects a handful of narrow
 * columns, never photos/description. */
export async function getInventoryFilterOptions() {
  const rows = await prisma.vehicle.findMany({
    where: { status: "AVAILABLE" },
    select: { make: true, model: true, bodyStyle: true, year: true, mileage: true, sellingPrice: true, internetPrice: true, features: true },
  });

  const makeModelMap = new Map<string, Set<string>>();
  const bodyStyles = new Set<string>();
  const featureSet = new Set<string>();
  let minYear = Infinity;
  let maxYear = -Infinity;
  let minPrice = Infinity;
  let maxPrice = -Infinity;
  let maxMileage = 0;

  for (const v of rows) {
    if (!makeModelMap.has(v.make)) makeModelMap.set(v.make, new Set());
    makeModelMap.get(v.make)!.add(v.model);
    bodyStyles.add(v.bodyStyle && KNOWN_BODY_STYLES.has(v.bodyStyle) ? v.bodyStyle : "OTHER");
    for (const f of parseFeatures(v.features)) featureSet.add(f);
    if (v.year < minYear) minYear = v.year;
    if (v.year > maxYear) maxYear = v.year;
    const price = v.internetPrice ?? v.sellingPrice;
    if (price != null) {
      if (price < minPrice) minPrice = price;
      if (price > maxPrice) maxPrice = price;
    }
    if (v.mileage > maxMileage) maxMileage = v.mileage;
  }

  const makes = [...makeModelMap.keys()].sort();
  const makeModels: Record<string, string[]> = {};
  for (const [make, models] of makeModelMap) makeModels[make] = [...models].sort();

  return {
    makes,
    makeModels,
    bodyStyles: [...bodyStyles].sort(),
    features: [...featureSet].sort(),
    yearBounds: rows.length > 0 ? { min: minYear, max: maxYear } : { min: new Date().getFullYear() - 10, max: new Date().getFullYear() },
    priceBounds: rows.length > 0 && minPrice !== Infinity ? { min: Math.floor(minPrice), max: Math.ceil(maxPrice) } : { min: 0, max: 100000 },
    maxMileage: rows.length > 0 ? maxMileage : 200000,
    count: rows.length,
  };
}

export async function getPublicVehicle(id: string) {
  const v = await prisma.vehicle.findFirst({
    where: { id, status: "AVAILABLE" },
  });
  if (!v) return null;
  return { ...v, photos: parsePhotos(v.photos), features: parseFeatures(v.features) };
}

export type PublicVehicleListItem = Awaited<ReturnType<typeof searchPublicInventory>>["vehicles"][number];
export type PublicVehicleDetail = NonNullable<Awaited<ReturnType<typeof getPublicVehicle>>>;
