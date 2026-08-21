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
  body: z.string().min(1, "Note can't be empty."),
});

export async function addNote(_prev: SimpleActionState, formData: FormData): Promise<SimpleActionState> {
  const scope = await requireScope();
  const parsed = schema.safeParse({
    customerId: formData.get("customerId"),
    leadId: formData.get("leadId") || undefined,
    body: formData.get("body"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  await prisma.note.create({
    data: { customerId: parsed.data.customerId, leadId: parsed.data.leadId, body: parsed.data.body, authorId: scope.userId },
  });

  await logActivity({
    customerId: parsed.data.customerId,
    leadId: parsed.data.leadId,
    type: "NOTE_ADDED",
    description: `Note added: ${parsed.data.body.slice(0, 120)}${parsed.data.body.length > 120 ? "…" : ""}`,
    actorId: scope.userId,
  });

  revalidatePath(`/customers/${parsed.data.customerId}`);
  return { success: "Note added." };
}
