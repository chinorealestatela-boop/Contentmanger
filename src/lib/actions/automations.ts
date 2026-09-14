"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireScope } from "@/lib/queries/scope";
import { runTimeBasedAutomationChecks } from "@/lib/automation/engine";
import { revalidatePath } from "next/cache";
import type { SimpleActionState } from "@/lib/actions/communications";

export async function toggleAutomationRule(ruleId: string, active: boolean) {
  await requireScope();
  await prisma.automationRule.update({ where: { id: ruleId }, data: { active } });
  revalidatePath("/automations");
}

export async function runAutomationChecksNow() {
  await requireScope();
  const created = await runTimeBasedAutomationChecks();
  revalidatePath("/automations");
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  return created;
}

const createRuleSchema = z.object({
  name: z.string().min(1, "Name is required."),
  triggerEvent: z.string().min(1),
  hours: z.string().optional(),
  actionType: z.enum(["CREATE_TASK", "NOTIFY_STAFF", "SEND_MESSAGE"]),
  taskType: z.string().optional(),
  taskTitle: z.string().optional(),
  taskPriority: z.string().optional(),
  dueInHours: z.string().optional(),
  notifyType: z.string().optional(),
  templateKey: z.string().optional(),
});

export async function createAutomationRule(_prev: SimpleActionState, formData: FormData): Promise<SimpleActionState> {
  await requireScope();
  const parsed = createRuleSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;

  const action =
    d.actionType === "CREATE_TASK"
      ? { type: "CREATE_TASK", taskType: d.taskType || "OTHER", title: d.taskTitle || "Follow up", priority: d.taskPriority || "NORMAL", dueInHours: d.dueInHours ? Number(d.dueInHours) : 4 }
      : d.actionType === "SEND_MESSAGE"
      ? { type: "SEND_MESSAGE", templateKey: d.templateKey || "LEAD_CONFIRMATION" }
      : { type: "NOTIFY_STAFF", notifyType: d.notifyType || "NEW_LEAD" };

  const count = await prisma.automationRule.count();

  await prisma.automationRule.create({
    data: {
      name: d.name,
      triggerEvent: d.triggerEvent,
      conditions: d.triggerEvent === "NO_CONTACT_X_HOURS" ? JSON.stringify({ hours: d.hours ? Number(d.hours) : 4 }) : null,
      actions: JSON.stringify([action]),
      order: count,
    },
  });

  revalidatePath("/automations");
  return { success: "Rule created." };
}

export async function deleteAutomationRule(ruleId: string) {
  await requireScope();
  await prisma.automationRule.delete({ where: { id: ruleId } });
  revalidatePath("/automations");
}
