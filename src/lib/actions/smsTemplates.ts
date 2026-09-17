"use server";

// CRUD for the editable payment-reminder SMS templates (Feature 3). Kept
// separate from src/lib/payments/templates.ts (read-side + rendering) the
// same way the rest of the app splits actions/ (mutations) from queries/
// (reads) — see src/lib/queries/* vs src/lib/actions/*.

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireScope } from "@/lib/queries/scope";
import { revalidatePath } from "next/cache";
import type { SimpleActionState } from "@/lib/actions/communications";

const templateSchema = z.object({
  name: z.string().min(1, "Give the template a name."),
  trigger: z.enum(["7_DAYS_BEFORE", "3_DAYS_BEFORE", "1_DAY_BEFORE", "DUE_DATE", "OVERDUE", "NONE"]),
  body: z.string().min(1, "Message body can't be empty."),
});

export async function createSmsTemplate(_prev: SimpleActionState, formData: FormData): Promise<SimpleActionState> {
  await requireScope();
  const parsed = templateSchema.safeParse({
    name: formData.get("name"),
    trigger: formData.get("trigger") || "NONE",
    body: formData.get("body"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { name, trigger, body } = parsed.data;

  await prisma.smsTemplate.create({
    data: { name, trigger: trigger === "NONE" ? null : trigger, body, active: true },
  });

  revalidatePath("/payments/settings");
  return { success: "Template created." };
}

export async function updateSmsTemplate(_prev: SimpleActionState, formData: FormData): Promise<SimpleActionState> {
  await requireScope();
  const id = String(formData.get("templateId") ?? "");
  if (!id) return { error: "Missing template." };
  const parsed = templateSchema.safeParse({
    name: formData.get("name"),
    trigger: formData.get("trigger") || "NONE",
    body: formData.get("body"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { name, trigger, body } = parsed.data;

  await prisma.smsTemplate.update({
    where: { id },
    data: { name, trigger: trigger === "NONE" ? null : trigger, body },
  });

  revalidatePath("/payments/settings");
  return { success: "Template updated." };
}

export async function toggleSmsTemplateActive(templateId: string, active: boolean) {
  await requireScope();
  await prisma.smsTemplate.update({ where: { id: templateId }, data: { active } });
  revalidatePath("/payments/settings");
}

export async function deleteSmsTemplate(templateId: string) {
  await requireScope();
  await prisma.smsTemplate.delete({ where: { id: templateId } }).catch(() => undefined);
  revalidatePath("/payments/settings");
}
