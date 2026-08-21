"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireScope } from "@/lib/queries/scope";
import { logActivity } from "@/lib/activity";
import { runAutomation } from "@/lib/automation/engine";
import { revalidatePath } from "next/cache";
import type { SimpleActionState } from "@/lib/actions/communications";

const schema = z.object({
  customerId: z.string().min(1),
  leadId: z.string().optional(),
  vehicleId: z.string().min(1, "Select the vehicle test driven."),
  appointmentId: z.string().optional(),
  customerReaction: z.string().default("POSITIVE"),
  objections: z.string().optional(),
  nextStep: z.string().optional(),
  notes: z.string().optional(),
});

export async function logTestDrive(_prev: SimpleActionState, formData: FormData): Promise<SimpleActionState> {
  const scope = await requireScope();
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;

  const vehicle = await prisma.vehicle.findUnique({ where: { id: d.vehicleId } });
  if (!vehicle) return { error: "Vehicle not found." };

  await prisma.testDrive.create({
    data: {
      customerId: d.customerId,
      vehicleId: d.vehicleId,
      appointmentId: d.appointmentId || undefined,
      salespersonId: scope.userId,
      date: new Date(),
      startTime: new Date().toTimeString().slice(0, 5),
      customerReaction: d.customerReaction,
      objections: d.objections,
      nextStep: d.nextStep,
      notes: d.notes,
    },
  });

  if (d.appointmentId) {
    await prisma.appointment.update({ where: { id: d.appointmentId }, data: { status: "COMPLETED" } });
  }

  await logActivity({
    customerId: d.customerId,
    leadId: d.leadId,
    type: "TEST_DRIVE_COMPLETED",
    description: `Test drive completed: ${vehicle.year} ${vehicle.make} ${vehicle.model} — reaction ${d.customerReaction.toLowerCase()}.`,
    actorId: scope.userId,
  });

  await runAutomation("TEST_DRIVE_COMPLETED", { customerId: d.customerId, leadId: d.leadId, actorId: scope.userId, vehicleId: d.vehicleId });

  revalidatePath(`/customers/${d.customerId}`);
  revalidatePath("/dashboard");
  return { success: "Test drive logged." };
}
