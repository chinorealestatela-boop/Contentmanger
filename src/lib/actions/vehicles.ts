"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireScope } from "@/lib/queries/scope";
import { runAutomation } from "@/lib/automation/engine";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SimpleActionState } from "@/lib/actions/communications";

const schema = z.object({
  stockNumber: z.string().min(1, "Stock number is required."),
  vin: z.string().min(1, "VIN is required."),
  year: z.string().min(1, "Year is required."),
  make: z.string().min(1, "Make is required."),
  model: z.string().min(1, "Model is required."),
  trim: z.string().optional(),
  condition: z.string().default("USED"),
  bodyStyle: z.string().optional(),
  drivetrain: z.string().optional(),
  mileage: z.string().optional(),
  exteriorColor: z.string().optional(),
  interiorColor: z.string().optional(),
  msrp: z.string().optional(),
  sellingPrice: z.string().optional(),
  internetPrice: z.string().optional(),
  status: z.string().default("AVAILABLE"),
  location: z.string().optional(),
  seatingCapacity: z.string().optional(),
  description: z.string().optional(),
});

const num = (v?: string) => (v && v.length > 0 ? Number(v) : undefined);

export async function createVehicle(_prev: SimpleActionState, formData: FormData): Promise<SimpleActionState> {
  await requireScope();
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;

  const existing = await prisma.vehicle.findFirst({ where: { OR: [{ stockNumber: d.stockNumber }, { vin: d.vin }] } });
  if (existing) return { error: "A vehicle with that stock number or VIN already exists." };

  const vehicle = await prisma.vehicle.create({
    data: {
      stockNumber: d.stockNumber,
      vin: d.vin,
      year: Number(d.year),
      make: d.make,
      model: d.model,
      trim: d.trim,
      condition: d.condition,
      bodyStyle: d.bodyStyle,
      drivetrain: d.drivetrain,
      mileage: num(d.mileage) ?? 0,
      exteriorColor: d.exteriorColor,
      interiorColor: d.interiorColor,
      msrp: num(d.msrp),
      sellingPrice: num(d.sellingPrice),
      internetPrice: num(d.internetPrice),
      status: d.status,
      location: d.location,
      seatingCapacity: num(d.seatingCapacity),
      description: d.description,
      photos: JSON.stringify([]),
    },
  });

  revalidatePath("/vehicles");
  redirect(`/vehicles/${vehicle.id}`);
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
      stockNumber: d.stockNumber,
      vin: d.vin,
      year: Number(d.year),
      make: d.make,
      model: d.model,
      trim: d.trim,
      condition: d.condition,
      bodyStyle: d.bodyStyle,
      drivetrain: d.drivetrain,
      mileage: num(d.mileage) ?? 0,
      exteriorColor: d.exteriorColor,
      interiorColor: d.interiorColor,
      msrp: num(d.msrp),
      sellingPrice: num(d.sellingPrice),
      internetPrice: num(d.internetPrice),
      status: d.status,
      location: d.location,
      seatingCapacity: num(d.seatingCapacity),
      description: d.description,
    },
  });

  revalidatePath("/vehicles");
  revalidatePath(`/vehicles/${vehicleId}`);
  return { success: "Saved." };
}

export async function updateVehicleStatus(vehicleId: string, status: string) {
  const scope = await requireScope();
  await prisma.vehicle.update({ where: { id: vehicleId }, data: { status } });

  if (status === "SOLD") {
    const interests = await prisma.customerVehicle.findMany({ where: { vehicleId } });
    for (const interest of interests) {
      await runAutomation("VEHICLE_SOLD", { customerId: interest.customerId, leadId: interest.leadId, actorId: scope.userId, vehicleId });
    }
  }

  revalidatePath("/vehicles");
  revalidatePath(`/vehicles/${vehicleId}`);
}
