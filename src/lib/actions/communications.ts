"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireScope } from "@/lib/queries/scope";
import { logActivity } from "@/lib/activity";
import { recomputeLeadScore } from "@/lib/scoring-engine";
import { recordFollowUpAction, type FollowUpTaskType } from "@/lib/followup";
import { revalidatePath } from "next/cache";

// Which follow-up task types a logged communication counts as evidence
// for — a logged call only satisfies a CALL (or generic FOLLOW_UP/OTHER)
// task, never a TEXT or EMAIL one, and vice versa.
const QUALIFYING_TASK_TYPES: Record<string, FollowUpTaskType[]> = {
  CALL: ["CALL", "FOLLOW_UP", "OTHER"],
  TEXT: ["TEXT", "FOLLOW_UP", "OTHER"],
  EMAIL: ["EMAIL", "FOLLOW_UP", "OTHER"],
  VOICEMAIL: ["CALL", "FOLLOW_UP", "OTHER"],
  IN_PERSON: ["FOLLOW_UP", "OTHER"],
  OTHER: ["FOLLOW_UP", "OTHER"],
};

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

  const activeLeads = await prisma.lead.findMany({ where: { customerId, status: "ACTIVE" }, select: { id: true } });
  for (const l of activeLeads) await recomputeLeadScore(l.id, scope.userId);

  await logActivity({
    customerId,
    type: "COMMUNICATION_LOGGED",
    description: `${type.charAt(0) + type.slice(1).toLowerCase()} logged: ${summary}`,
    actorId: scope.userId,
  });
  await recordFollowUpAction({
    customerId,
    actorId: scope.userId,
    taskTypes: QUALIFYING_TASK_TYPES[type] ?? ["FOLLOW_UP", "OTHER"],
    source: `${type.charAt(0) + type.slice(1).toLowerCase()} logged`,
  });

  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/dashboard");
  revalidatePath("/communications");
  return { success: "Logged." };
}
