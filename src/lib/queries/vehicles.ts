import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export type VehicleFilters = {
  q?: string;
  status?: string;
  condition?: string;
  bodyStyle?: string;
  drivetrain?: string;
  maxPrice?: string;
  thirdRow?: string;
  color?: string;
  missingPhotos?: string;
  page?: number;
  pageSize?: number;
};

// Negation of HAS_PHOTO_WHERE (publicInventory.ts) — vehicles this excludes
// from the booking/inventory site because they have no photo on file, even
// though they're fully visible (and often still "Available") here in the
// admin CRM.
const MISSING_PHOTO_WHERE: Prisma.VehicleWhereInput = { OR: [{ photos: null }, { photos: "" }, { photos: "[]" }] };

export async function listVehicles(filters: VehicleFilters = {}) {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 24;

  const where: Prisma.VehicleWhereInput = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.condition ? { condition: filters.condition } : {}),
    ...(filters.bodyStyle ? { bodyStyle: filters.bodyStyle } : {}),
    ...(filters.drivetrain ? { drivetrain: filters.drivetrain } : {}),
    ...(filters.thirdRow === "true" ? { seatingCapacity: { gte: 6 } } : {}),
    ...(filters.missingPhotos === "true" ? MISSING_PHOTO_WHERE : {}),
    ...(filters.maxPrice
      ? {
          OR: [
            { internetPrice: { lte: Number(filters.maxPrice) } },
            { AND: [{ internetPrice: null }, { sellingPrice: { lte: Number(filters.maxPrice) } }] },
          ],
        }
      : {}),
    ...(filters.color ? { exteriorColor: { contains: filters.color } } : {}),
    ...(filters.q
      ? {
          OR: [
            { make: { contains: filters.q } },
            { model: { contains: filters.q } },
            { trim: { contains: filters.q } },
            { stockNumber: { contains: filters.q } },
            { vin: { contains: filters.q } },
          ],
        }
      : {}),
  };

  const [vehicles, total] = await Promise.all([
    prisma.vehicle.findMany({
      where,
      include: { _count: { select: { customerInterests: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.vehicle.count({ where }),
  ]);

  return { vehicles, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getVehicleDetail(id: string) {
  return prisma.vehicle.findUnique({
    where: { id },
    include: {
      customerInterests: { include: { customer: true, lead: { include: { stage: true } } } },
      appointments: { include: { customer: true }, orderBy: { date: "desc" }, take: 10 },
      testDrives: { include: { customer: true }, orderBy: { date: "desc" }, take: 10 },
      sales: { include: { customer: true }, orderBy: { saleDate: "desc" } },
    },
  });
}

export async function getInventoryStats() {
  const [total, available, hold, sold, inTransit, missingPhotos] = await Promise.all([
    prisma.vehicle.count(),
    prisma.vehicle.count({ where: { status: "AVAILABLE" } }),
    prisma.vehicle.count({ where: { status: "HOLD" } }),
    prisma.vehicle.count({ where: { status: "SOLD" } }),
    prisma.vehicle.count({ where: { status: "IN_TRANSIT" } }),
    // Available but hidden from the booking/inventory site because there's
    // no photo on file yet — see HAS_PHOTO_WHERE in publicInventory.ts.
    prisma.vehicle.count({ where: { status: "AVAILABLE", ...MISSING_PHOTO_WHERE } }),
  ]);
  return { total, available, hold, sold, inTransit, missingPhotos };
}
