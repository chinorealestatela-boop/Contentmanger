"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireScope } from "@/lib/queries/scope";
import { logActivity } from "@/lib/activity";
import { revalidatePath } from "next/cache";

const schema = z.object({
  customerId: z.string().min(1),
  type: z.enum(["CALL", "TEXT", "EMAIL", "VOICEMAIL", "IN_PERSON", "OTHER"]),
  direction: z.enum(["OUTBOUND", "INBOUND"]).default("OUTBOUND"),
  summary: z.string().min(1, "Summary is required."),
  body: z.string().optional(),
});

export type SimpleActionState = { error?: string; success?: string } | null;

export async function logCommunication(_prev: SimpleActionState, formData: FormData): Promise<SimpleActionState> {
  const scope = await requireScope();
  const parsed = schema.safeParse({
    customerId: formData.get("customerId"),
    type: formData.get("type"),
    direction: formData.get("direction") ?? "OUTBOUND",
    summary: formData.get("summary"),
    body: formData.get("body") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const { customerId, type, direction, summary, body } = parsed.data;

  await prisma.communication.create({
    data: { customerId, type, direction, summary, body, actorId: scope.userId },
  });

  await prisma.lead.updateMany({
    where: { customerId, status: "ACTIVE" },
    data: { lastContactedAt: new Date() },
  });

  await logActivity({
    customerId,
    type: "COMMUNICATION_LOGGED",
    description: `${type.charAt(0) + type.slice(1).toLowerCase()} logged: ${summary}`,
    actorId: scope.userId,
  });

  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/dashboard");
  revalidatePath("/communications");
  return { success: "Logged." };
}
