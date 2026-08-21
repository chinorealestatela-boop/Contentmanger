"use server";

import { z } from "zod";
import { requireScope } from "@/lib/queries/scope";
import { logActivity } from "@/lib/activity";
import { revalidatePath } from "next/cache";
import type { SimpleActionState } from "@/lib/actions/communications";

const schema = z.object({
  customerId: z.string().min(1),
  leadId: z.string().optional(),
  description: z.string().min(1, "Description is required."),
});

export async function logActivityManual(_prev: SimpleActionState, formData: FormData): Promise<SimpleActionState> {
  const scope = await requireScope();
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  await logActivity({
    customerId: parsed.data.customerId,
    leadId: parsed.data.leadId,
    type: "MANUAL_LOG",
    description: parsed.data.description,
    actorId: scope.userId,
  });

  revalidatePath(`/customers/${parsed.data.customerId}`);
  return { success: "Logged." };
}
