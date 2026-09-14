"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireScope } from "@/lib/queries/scope";
import { revalidatePath } from "next/cache";
import type { SimpleActionState } from "@/lib/actions/communications";

const seqSchema = z.object({
  name: z.string().min(1, "Name is required."),
  description: z.string().optional(),
  trigger: z.string().default("MANUAL"),
});

export async function createSequence(_prev: SimpleActionState, formData: FormData): Promise<SimpleActionState> {
  await requireScope();
  const parsed = seqSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  await prisma.followUpSequence.create({ data: parsed.data });
  revalidatePath("/follow-ups");
  return { success: "Sequence created." };
}

export async function toggleSequence(id: string, active: boolean) {
  await requireScope();
  await prisma.followUpSequence.update({ where: { id }, data: { active } });
  revalidatePath("/follow-ups");
}

export async function deleteSequence(id: string) {
  await requireScope();
  await prisma.followUpSequence.delete({ where: { id } });
  revalidatePath("/follow-ups");
}

const stepSchema = z.object({
  sequenceId: z.string().min(1),
  offsetMinutes: z.string().min(1),
  channel: z.string().default("SMS"),
  title: z.string().min(1, "Title is required."),
  messageBody: z.string().optional(),
});

export async function addStep(_prev: SimpleActionState, formData: FormData): Promise<SimpleActionState> {
  await requireScope();
  const parsed = stepSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;

  const count = await prisma.followUpStep.count({ where: { sequenceId: d.sequenceId } });
  await prisma.followUpStep.create({
    data: { sequenceId: d.sequenceId, offsetMinutes: Number(d.offsetMinutes), channel: d.channel, title: d.title, messageBody: d.messageBody, order: count },
  });

  revalidatePath("/follow-ups");
  return { success: "Step added." };
}

export async function removeStep(stepId: string) {
  await requireScope();
  await prisma.followUpStep.delete({ where: { id: stepId } });
  revalidatePath("/follow-ups");
}
