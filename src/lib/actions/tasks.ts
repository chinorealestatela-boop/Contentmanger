"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireScope } from "@/lib/queries/scope";
import { logActivity } from "@/lib/activity";
import { revalidatePath } from "next/cache";
import type { SimpleActionState } from "@/lib/actions/communications";
import { runAutomation } from "@/lib/automation/engine";

export type TaskActionState = (SimpleActionState & { taskId?: string }) | null;

const createSchema = z.object({
  customerId: z.string().optional(),
  leadId: z.string().optional(),
  title: z.string().min(1, "Title is required."),
  type: z.string().default("OTHER"),
  priority: z.string().default("NORMAL"),
  dueDate: z.string().min(1, "Due date is required."),
  dueTime: z.string().optional(),
  notes: z.string().optional(),
  assigneeId: z.string().optional(),
});

export async function createTask(_prev: TaskActionState, formData: FormData): Promise<TaskActionState> {
  const scope = await requireScope();
  const parsed = createSchema.safeParse({
    customerId: formData.get("customerId") || undefined,
    leadId: formData.get("leadId") || undefined,
    title: formData.get("title"),
    type: formData.get("type") || "OTHER",
    priority: formData.get("priority") || "NORMAL",
    dueDate: formData.get("dueDate"),
    dueTime: formData.get("dueTime") || undefined,
    notes: formData.get("notes") || undefined,
    assigneeId: formData.get("assigneeId") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const task = await prisma.task.create({
    data: {
      customerId: parsed.data.customerId,
      leadId: parsed.data.leadId,
      title: parsed.data.title,
      type: parsed.data.type,
      priority: parsed.data.priority,
      dueDate: new Date(parsed.data.dueDate),
      dueTime: parsed.data.dueTime,
      notes: parsed.data.notes,
      assigneeId: parsed.data.assigneeId || scope.userId,
      source: "MANUAL",
    },
  });

  if (parsed.data.customerId) {
    await logActivity({
      customerId: parsed.data.customerId,
      leadId: parsed.data.leadId,
      type: "TASK_CREATED",
      description: `Task created: ${parsed.data.title}`,
      actorId: scope.userId,
    });
  }

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  if (parsed.data.customerId) revalidatePath(`/customers/${parsed.data.customerId}`);
  return { success: "Task created.", taskId: task.id };
}

export async function completeTask(taskId: string) {
  const scope = await requireScope();
  const task = await prisma.task.update({
    where: { id: taskId },
    data: { status: "COMPLETED", completedAt: new Date() },
  });

  if (task.customerId) {
    await logActivity({
      customerId: task.customerId,
      leadId: task.leadId,
      type: "TASK_COMPLETED",
      description: `Task completed: ${task.title}`,
      actorId: scope.userId,
    });
    if (task.type === "FOLLOW_UP" || task.source === "SEQUENCE") {
      await runAutomation("FOLLOW_UP_COMPLETED", { customerId: task.customerId, leadId: task.leadId, actorId: scope.userId });
    }
  }

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  if (task.customerId) revalidatePath(`/customers/${task.customerId}`);
}

export async function snoozeTask(taskId: string, days: number) {
  await requireScope();
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return;
  const newDate = new Date(task.dueDate);
  newDate.setDate(newDate.getDate() + days);
  await prisma.task.update({ where: { id: taskId }, data: { status: "SNOOZED", dueDate: newDate } });
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
}

export async function reopenTask(taskId: string) {
  await requireScope();
  await prisma.task.update({ where: { id: taskId }, data: { status: "PENDING" } });
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
}

export async function cancelTask(taskId: string) {
  await requireScope();
  await prisma.task.update({ where: { id: taskId }, data: { status: "CANCELLED" } });
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
}
