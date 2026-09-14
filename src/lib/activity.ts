import { prisma } from "@/lib/prisma";

/** Central helper for writing to the activity timeline (customer profile,
 * booking detail, dashboard feed). Every meaningful CRM action — stage
 * change, quote sent, booking created, payment received, driver assigned,
 * automation fired, etc. — should call this so there's a complete
 * chronological audit trail (spec §28/§29: "every important action
 * should be logged"). */
export async function logActivity(params: {
  customerId?: string | null;
  leadId?: string | null;
  bookingId?: string | null;
  type: string;
  description: string;
  actorId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  return prisma.activity.create({
    data: {
      customerId: params.customerId ?? null,
      leadId: params.leadId ?? null,
      bookingId: params.bookingId ?? null,
      type: params.type,
      description: params.description,
      actorId: params.actorId ?? null,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    },
  });
}
