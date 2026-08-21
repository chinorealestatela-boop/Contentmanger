import { prisma } from "@/lib/prisma";

/** Central helper for writing to the customer activity timeline. Every
 * meaningful CRM action (communication logged, note added, stage change,
 * appointment set, automation fired, etc.) should call this so the
 * customer profile's timeline stays a complete chronological record. */
export async function logActivity(params: {
  customerId: string;
  leadId?: string | null;
  type: string;
  description: string;
  actorId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  return prisma.activity.create({
    data: {
      customerId: params.customerId,
      leadId: params.leadId ?? null,
      type: params.type,
      description: params.description,
      actorId: params.actorId ?? null,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    },
  });
}
