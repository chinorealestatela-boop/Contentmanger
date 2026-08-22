"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireScope } from "@/lib/queries/scope";
import { logActivity } from "@/lib/activity";
import { runAutomation } from "@/lib/automation/engine";
import { revalidatePath } from "next/cache";
import type { SimpleActionState } from "@/lib/actions/communications";

const reminderSchema = z.union([z.literal("NONE"), z.string().regex(/^\d+$/)]).optional();

function parseReminder(raw: FormDataEntryValue | null): number | null {
  if (!raw || raw === "NONE") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

const createSchema = z.object({
  customerId: z.string().min(1),
  leadId: z.string().optional(),
  topic: z.string().min(1, "Conversation topic is required."),
  notes: z.string().optional(),
  followUpDate: z.string().min(1, "Follow-up date is required."),
  followUpTime: z.string().min(1, "Follow-up time is required."),
  priority: z.string().default("NORMAL"),
  assigneeId: z.string().optional(),
});

export type FollowUpActionState = (SimpleActionState & { followUpId?: string }) | null;

export async function createFollowUp(_prev: FollowUpActionState, formData: FormData): Promise<FollowUpActionState> {
  const scope = await requireScope();
  const parsed = createSchema.safeParse({
    customerId: formData.get("customerId"),
    leadId: formData.get("leadId") || undefined,
    topic: formData.get("topic"),
    notes: formData.get("notes") || undefined,
    followUpDate: formData.get("followUpDate"),
    followUpTime: formData.get("followUpTime"),
    priority: formData.get("priority") || "NORMAL",
    assigneeId: formData.get("assigneeId") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const reminderRaw = formData.get("reminderOffsetMinutes");
  const reminderCheck = reminderSchema.safeParse(reminderRaw ? String(reminderRaw) : undefined);
  if (!reminderCheck.success) return { error: "Invalid reminder value." };
  const reminderOffsetMinutes = parseReminder(reminderRaw);

  const followUp = await prisma.followUp.create({
    data: {
      customerId: parsed.data.customerId,
      leadId: parsed.data.leadId,
      topic: parsed.data.topic,
      notes: parsed.data.notes,
      followUpDate: new Date(parsed.data.followUpDate),
      followUpTime: parsed.data.followUpTime,
      reminderOffsetMinutes,
      priority: parsed.data.priority,
      assigneeId: parsed.data.assigneeId || scope.userId,
    },
  });

  await logActivity({
    customerId: parsed.data.customerId,
    leadId: parsed.data.leadId,
    type: "FOLLOWUP_SCHEDULED",
    description: `Follow-up scheduled for ${parsed.data.followUpDate} at ${parsed.data.followUpTime}: ${parsed.data.topic}`,
    actorId: scope.userId,
  });

  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath(`/customers/${parsed.data.customerId}`);
  return { success: "Follow-up scheduled.", followUpId: followUp.id };
}

const completeSchema = z.object({
  followUpId: z.string().min(1),
  completionNotes: z.string().optional(),
});

export async function completeFollowUp(_prev: SimpleActionState, formData: FormData): Promise<SimpleActionState> {
  const scope = await requireScope();
  const parsed = completeSchema.safeParse({
    followUpId: formData.get("followUpId"),
    completionNotes: formData.get("completionNotes") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const followUp = await prisma.followUp.update({
    where: { id: parsed.data.followUpId },
    data: { status: "COMPLETED", completedAt: new Date(), completionNotes: parsed.data.completionNotes },
  });

  await logActivity({
    customerId: followUp.customerId,
    leadId: followUp.leadId,
    type: "FOLLOWUP_COMPLETED",
    description: `Follow-up completed: ${followUp.topic}${parsed.data.completionNotes ? ` — ${parsed.data.completionNotes}` : ""}`,
    actorId: scope.userId,
  });

  await runAutomation("FOLLOW_UP_COMPLETED", { customerId: followUp.customerId, leadId: followUp.leadId, actorId: scope.userId });

  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath(`/customers/${followUp.customerId}`);
  return { success: "Follow-up completed." };
}

const rescheduleSchema = z.object({
  followUpId: z.string().min(1),
  followUpDate: z.string().min(1, "New date is required."),
  followUpTime: z.string().min(1, "New time is required."),
  reason: z.string().optional(),
});

export async function rescheduleFollowUp(_prev: SimpleActionState, formData: FormData): Promise<SimpleActionState> {
  const scope = await requireScope();
  const parsed = rescheduleSchema.safeParse({
    followUpId: formData.get("followUpId"),
    followUpDate: formData.get("followUpDate"),
    followUpTime: formData.get("followUpTime"),
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const original = await prisma.followUp.findUnique({ where: { id: parsed.data.followUpId } });
  if (!original) return { error: "Follow-up not found." };

  const next = await prisma.followUp.create({
    data: {
      customerId: original.customerId,
      leadId: original.leadId,
      topic: original.topic,
      notes: original.notes,
      followUpDate: new Date(parsed.data.followUpDate),
      followUpTime: parsed.data.followUpTime,
      reminderOffsetMinutes: original.reminderOffsetMinutes,
      priority: original.priority,
      assigneeId: original.assigneeId,
      rescheduledFromId: original.id,
    },
  });

  await prisma.followUp.update({ where: { id: original.id }, data: { status: "RESCHEDULED" } });

  await logActivity({
    customerId: original.customerId,
    leadId: original.leadId,
    type: "FOLLOWUP_RESCHEDULED",
    description: `Follow-up rescheduled to ${parsed.data.followUpDate} at ${parsed.data.followUpTime}${parsed.data.reason ? ` — ${parsed.data.reason}` : ""}`,
    actorId: scope.userId,
  });

  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath(`/customers/${original.customerId}`);
  return { success: "Follow-up rescheduled.", followUpId: next.id } as SimpleActionState;
}

export async function cancelFollowUp(followUpId: string) {
  const scope = await requireScope();
  const followUp = await prisma.followUp.update({ where: { id: followUpId }, data: { status: "CANCELLED" } });

  await logActivity({
    customerId: followUp.customerId,
    leadId: followUp.leadId,
    type: "FOLLOWUP_CANCELLED",
    description: `Follow-up cancelled: ${followUp.topic}`,
    actorId: scope.userId,
  });

  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath(`/customers/${followUp.customerId}`);
}
