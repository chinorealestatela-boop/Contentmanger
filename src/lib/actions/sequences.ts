"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireScope } from "@/lib/queries/scope";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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

  const sequence = await prisma.followUpSequence.create({ data: parsed.data });
  revalidatePath("/follow-up-sequences");
  redirect(`/follow-up-sequences/${sequence.id}`);
}

export async function toggleSequence(id: string, active: boolean) {
  await requireScope();
  await prisma.followUpSequence.update({ where: { id }, data: { active } });
  revalidatePath("/follow-up-sequences");
}

export async function deleteSequence(id: string) {
  await requireScope();
  await prisma.followUpSequence.delete({ where: { id } });
  revalidatePath("/follow-up-sequences");
}

const stepSchema = z.object({
  sequenceId: z.string().min(1),
  dayOffset: z.string().min(1),
  type: z.string().default("CALL"),
  title: z.string().min(1, "Title is required."),
  description: z.string().optional(),
});

export async function addStep(_prev: SimpleActionState, formData: FormData): Promise<SimpleActionState> {
  await requireScope();
  const parsed = stepSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;

  const count = await prisma.followUpStep.count({ where: { sequenceId: d.sequenceId } });
  await prisma.followUpStep.create({
    data: { sequenceId: d.sequenceId, dayOffset: Number(d.dayOffset), type: d.type, title: d.title, description: d.description, order: count },
  });

  revalidatePath(`/follow-up-sequences/${d.sequenceId}`);
  return { success: "Step added." };
}

export async function removeStep(stepId: string, sequenceId: string) {
  await requireScope();
  await prisma.followUpStep.delete({ where: { id: stepId } });
  revalidatePath(`/follow-up-sequences/${sequenceId}`);
}
