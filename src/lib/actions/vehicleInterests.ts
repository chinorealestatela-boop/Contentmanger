"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireScope } from "@/lib/queries/scope";
import { logActivity } from "@/lib/activity";
import { revalidatePath } from "next/cache";
import type { SimpleActionState } from "@/lib/actions/communications";

const schema = z.object({
  customerId: z.string().min(1),
  leadId: z.string().optional(),
  vehicleId: z.string().optional(),
  year: z.string().optional(),
  make: z.string().optional(),
  model: z.string().optional(),
  trim: z.string().optional(),
  interestLevel: z.string().default("INTERESTED"),
});

export async function addVehicleInterest(_prev: SimpleActionState, formData: FormData): Promise<SimpleActionState> {
  const scope = await requireScope();
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;

  if (!d.vehicleId && !d.make && !d.model) return { error: "Select a vehicle from inventory or enter make/model." };

  let label = "a vehicle";
  if (d.vehicleId) {
    const v = await prisma.vehicle.findUnique({ where: { id: d.vehicleId } });
    if (v) label = `${v.year} ${v.make} ${v.model}`;
  } else {
    label = [d.year, d.make, d.model].filter(Boolean).join(" ");
  }

  await prisma.customerVehicle.create({
    data: {
      customerId: d.customerId,
      leadId: d.leadId,
      vehicleId: d.vehicleId,
      year: d.year ? Number(d.year) : undefined,
      make: d.make,
      model: d.model,
      trim: d.trim,
      interestLevel: d.interestLevel,
    },
  });

  await logActivity({
    customerId: d.customerId,
    leadId: d.leadId,
    type: "VEHICLE_INTEREST_ADDED",
    description: `Added vehicle of interest: ${label}.`,
    actorId: scope.userId,
  });

  revalidatePath(`/customers/${d.customerId}`);
  return { success: "Vehicle added." };
}

export async function removeVehicleInterest(id: string, customerId: string) {
  await requireScope();
  await prisma.customerVehicle.delete({ where: { id } });
  revalidatePath(`/customers/${customerId}`);
}
