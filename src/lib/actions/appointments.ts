"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireScope } from "@/lib/queries/scope";
import { logActivity } from "@/lib/activity";
import { runAutomation } from "@/lib/automation/engine";
import { recomputeLeadScore } from "@/lib/scoring-engine";
import { revalidatePath } from "next/cache";
import type { SimpleActionState } from "@/lib/actions/communications";

const schema = z.object({
  customerId: z.string().min(1),
  leadId: z.string().optional(),
  vehicleId: z.string().optional(),
  date: z.string().min(1, "Date is required."),
  time: z.string().min(1, "Time is required."),
  type: z.string().default("SHOWROOM_VISIT"),
  notes: z.string().optional(),
  salespersonId: z.string().optional(),
});

export async function createAppointment(_prev: SimpleActionState, formData: FormData): Promise<SimpleActionState> {
  const scope = await requireScope();
  const parsed = schema.safeParse({
    customerId: formData.get("customerId"),
    leadId: formData.get("leadId") || undefined,
    vehicleId: formData.get("vehicleId") || undefined,
    date: formData.get("date"),
    time: formData.get("time"),
    type: formData.get("type") || "SHOWROOM_VISIT",
    notes: formData.get("notes") || undefined,
    salespersonId: formData.get("salespersonId") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const salespersonId = parsed.data.salespersonId || scope.userId;

  await prisma.appointment.create({
    data: {
      customerId: parsed.data.customerId,
      vehicleId: parsed.data.vehicleId,
      date: new Date(parsed.data.date),
      time: parsed.data.time,
      type: parsed.data.type,
      notes: parsed.data.notes,
      salespersonId,
    },
  });

  await logActivity({
    customerId: parsed.data.customerId,
    leadId: parsed.data.leadId,
    type: "APPOINTMENT",
    description: `${parsed.data.type.replace(/_/g, " ").toLowerCase()} appointment scheduled for ${parsed.data.date} at ${parsed.data.time}.`,
    actorId: scope.userId,
  });

  await runAutomation("APPOINTMENT_CREATED", { customerId: parsed.data.customerId, leadId: parsed.data.leadId, actorId: scope.userId });

  const activeLead = await prisma.lead.findFirst({ where: { customerId: parsed.data.customerId, status: "ACTIVE" } });
  if (activeLead) await recomputeLeadScore(activeLead.id, scope.userId);

  revalidatePath("/appointments");
  revalidatePath("/dashboard");
  revalidatePath(`/customers/${parsed.data.customerId}`);
  return { success: "Appointment scheduled." };
}

export async function updateAppointmentStatus(appointmentId: string, status: string) {
  const scope = await requireScope();
  const appt = await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status },
    include: { customer: true },
  });

  const lead = await prisma.lead.findFirst({ where: { customerId: appt.customerId, status: "ACTIVE" }, orderBy: { createdAt: "desc" } });

  await logActivity({
    customerId: appt.customerId,
    leadId: lead?.id,
    type: "APPOINTMENT",
    description: `Appointment marked ${status.replace(/_/g, " ").toLowerCase()}.`,
    actorId: scope.userId,
  });

  if (status === "NO_SHOW") {
    await runAutomation("APPOINTMENT_NO_SHOW", { customerId: appt.customerId, leadId: lead?.id, actorId: scope.userId });
  } else if (status === "COMPLETED") {
    await runAutomation("APPOINTMENT_COMPLETED", { customerId: appt.customerId, leadId: lead?.id, actorId: scope.userId });
  }

  if (lead) await recomputeLeadScore(lead.id, scope.userId);

  revalidatePath("/appointments");
  revalidatePath("/dashboard");
  revalidatePath(`/customers/${appt.customerId}`);
}

export async function rescheduleAppointment(appointmentId: string, date: string, time: string) {
  await requireScope();
  const appt = await prisma.appointment.update({
    where: { id: appointmentId },
    data: { date: new Date(date), time, status: "SCHEDULED" },
  });
  revalidatePath("/appointments");
  revalidatePath(`/customers/${appt.customerId}`);
}
