"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireScope } from "@/lib/queries/scope";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SimpleActionState } from "@/lib/actions/communications";

const optionalStr = z.string().optional().transform((v) => (v && v.length > 0 ? v : undefined));
const num = (v?: string) => (v && v.length > 0 ? Number(v) : undefined);

const schema = z.object({
  fleetNumber: z.string().min(1, "Fleet number is required."),
  name: z.string().min(1, "Display name is required."),
  vin: z.string().min(1, "VIN is required."),
  year: z.string().min(1, "Year is required."),
  make: z.string().min(1, "Make is required."),
  model: z.string().min(1, "Model is required."),
  licensePlate: optionalStr,
  vehicleType: z.string().default("OTHER"),
  color: optionalStr,
  seatingCapacity: optionalStr,
  currentMileage: optionalStr,
  homeBase: optionalStr,
  hourlyRate: optionalStr,
  dailyRate: optionalStr,
  depositRequirement: optionalStr,
  insuranceProvider: optionalStr,
  insurancePolicyNo: optionalStr,
  insuranceExpiresAt: optionalStr,
  registrationExpiresAt: optionalStr,
  notes: optionalStr,
});

export async function createVehicle(_prev: SimpleActionState, formData: FormData): Promise<SimpleActionState> {
  await requireScope();
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;

  const existing = await prisma.vehicle.findFirst({ where: { OR: [{ fleetNumber: d.fleetNumber }, { vin: d.vin }] } });
  if (existing) return { error: "A vehicle with that fleet number or VIN already exists." };

  const vehicle = await prisma.vehicle.create({
    data: {
      fleetNumber: d.fleetNumber,
      name: d.name,
      vin: d.vin,
      year: Number(d.year),
      make: d.make,
      model: d.model,
      licensePlate: d.licensePlate,
      vehicleType: d.vehicleType,
      color: d.color,
      seatingCapacity: num(d.seatingCapacity),
      currentMileage: num(d.currentMileage) ?? 0,
      homeBase: d.homeBase,
      currentLocation: d.homeBase,
      hourlyRate: num(d.hourlyRate),
      dailyRate: num(d.dailyRate),
      depositRequirement: num(d.depositRequirement),
      insuranceProvider: d.insuranceProvider,
      insurancePolicyNo: d.insurancePolicyNo,
      insuranceExpiresAt: d.insuranceExpiresAt ? new Date(d.insuranceExpiresAt) : undefined,
      registrationExpiresAt: d.registrationExpiresAt ? new Date(d.registrationExpiresAt) : undefined,
      notes: d.notes,
      photos: JSON.stringify([]),
    },
  });

  revalidatePath("/fleet");
  redirect(`/fleet/${vehicle.id}`);
}

const updateSchema = schema.extend({ vehicleId: z.string().min(1) });

export async function updateVehicle(_prev: SimpleActionState, formData: FormData): Promise<SimpleActionState> {
  await requireScope();
  const parsed = updateSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { vehicleId, ...d } = parsed.data;

  await prisma.vehicle.update({
    where: { id: vehicleId },
    data: {
      fleetNumber: d.fleetNumber,
      name: d.name,
      vin: d.vin,
      year: Number(d.year),
      make: d.make,
      model: d.model,
      licensePlate: d.licensePlate,
      vehicleType: d.vehicleType,
      color: d.color,
      seatingCapacity: num(d.seatingCapacity),
      currentMileage: num(d.currentMileage) ?? 0,
      homeBase: d.homeBase,
      hourlyRate: num(d.hourlyRate),
      dailyRate: num(d.dailyRate),
      depositRequirement: num(d.depositRequirement),
      insuranceProvider: d.insuranceProvider,
      insurancePolicyNo: d.insurancePolicyNo,
      insuranceExpiresAt: d.insuranceExpiresAt ? new Date(d.insuranceExpiresAt) : undefined,
      registrationExpiresAt: d.registrationExpiresAt ? new Date(d.registrationExpiresAt) : undefined,
      notes: d.notes,
    },
  });

  revalidatePath("/fleet");
  revalidatePath(`/fleet/${vehicleId}`);
  return { success: "Saved." };
}

export async function updateVehicleAvailability(vehicleId: string, availability: string) {
  await requireScope();
  await prisma.vehicle.update({ where: { id: vehicleId }, data: { availability } });
  revalidatePath("/fleet");
  revalidatePath(`/fleet/${vehicleId}`);
  revalidatePath("/live-map");
}

export async function assignVehicleDriver(vehicleId: string, driverId: string | null) {
  await requireScope();
  await prisma.vehicle.update({ where: { id: vehicleId }, data: { assignedDriverId: driverId } });
  revalidatePath("/fleet");
  revalidatePath(`/fleet/${vehicleId}`);
}

const maintenanceSchema = z.object({
  vehicleId: z.string().min(1),
  type: z.string().default("SERVICE"),
  description: z.string().min(1, "Description is required."),
  scheduledDate: optionalStr,
  vendor: optionalStr,
  cost: optionalStr,
  notes: optionalStr,
});

export async function createMaintenanceRecord(_prev: SimpleActionState, formData: FormData): Promise<SimpleActionState> {
  await requireScope();
  const parsed = maintenanceSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;

  await prisma.maintenanceRecord.create({
    data: {
      vehicleId: d.vehicleId,
      type: d.type,
      description: d.description,
      scheduledDate: d.scheduledDate ? new Date(d.scheduledDate) : undefined,
      vendor: d.vendor,
      cost: num(d.cost),
      notes: d.notes,
    },
  });

  revalidatePath(`/fleet/${d.vehicleId}`);
  revalidatePath("/fleet");
  revalidatePath("/dashboard");
  return { success: "Maintenance scheduled." };
}

export async function completeMaintenanceRecord(recordId: string) {
  await requireScope();
  const record = await prisma.maintenanceRecord.update({ where: { id: recordId }, data: { status: "COMPLETED", completedDate: new Date() } });
  const openCount = await prisma.maintenanceRecord.count({ where: { vehicleId: record.vehicleId, status: { in: ["SCHEDULED", "IN_PROGRESS"] } } });
  if (openCount === 0) {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: record.vehicleId } });
    if (vehicle?.availability === "MAINTENANCE") {
      await prisma.vehicle.update({ where: { id: record.vehicleId }, data: { availability: "AVAILABLE" } });
    }
  }
  revalidatePath(`/fleet/${record.vehicleId}`);
  revalidatePath("/fleet");
}
