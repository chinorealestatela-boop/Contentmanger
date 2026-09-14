"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireScope } from "@/lib/queries/scope";
import { revalidatePath } from "next/cache";
import type { SimpleActionState } from "@/lib/actions/communications";

const schema = z.object({
  key: z.string().min(1),
  subject: z.string().optional(),
  body: z.string().min(1, "Message body can't be empty."),
});

export async function updateMessageTemplate(_prev: SimpleActionState, formData: FormData): Promise<SimpleActionState> {
  await requireScope();
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  await prisma.messageTemplate.update({ where: { key: parsed.data.key }, data: { subject: parsed.data.subject, body: parsed.data.body } });
  revalidatePath("/follow-ups");
  return { success: "Template saved." };
}

export async function toggleMessageTemplate(key: string, active: boolean) {
  await requireScope();
  await prisma.messageTemplate.update({ where: { key }, data: { active } });
  revalidatePath("/follow-ups");
}
