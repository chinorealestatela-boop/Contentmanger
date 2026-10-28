"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireScope, customerScopeWhere } from "@/lib/queries/scope";
import { logActivity } from "@/lib/activity";
import { recordFollowUpAction } from "@/lib/followup";
import { revalidatePath } from "next/cache";
import type { SimpleActionState } from "@/lib/actions/communications";

const schema = z.object({
  customerId: z.string().min(1),
  firstName: z.string().min(1, "First name is required."),
  lastName: z.string().min(1, "Last name is required."),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  preferredContactMethod: z.string().default("PHONE"),
  bestContactTime: z.string().optional(),
});

export async function updateCustomer(_prev: SimpleActionState, formData: FormData): Promise<SimpleActionState> {
  const scope = await requireScope();
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { customerId, ...rest } = parsed.data;

  // Ownership check, not just auth — without this a logged-in salesperson
  // could edit any other salesperson's customer by posting this action
  // with a different customerId directly (bypassing the UI entirely).
  const result = await prisma.customer.updateMany({ where: { id: customerId, ...customerScopeWhere(scope) }, data: rest });
  if (result.count === 0) return { error: "Customer not found." };

  await logActivity({ customerId, type: "CUSTOMER_UPDATED", description: "Contact information updated.", actorId: scope.userId });
  // A profile edit alone isn't proof a call/text/email happened — only
  // completes the generic FOLLOW_UP/OTHER bucket, never CALL/TEXT/EMAIL/
  // APPOINTMENT/TRADE/CREDIT tasks (see followup.ts's header comment).
  await recordFollowUpAction({ customerId, actorId: scope.userId, taskTypes: ["FOLLOW_UP", "OTHER"], source: "Customer information updated" });

  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/customers");
  return { success: "Saved." };
}

/** Moving a customer between salespeople's books is a team-management
 * action, not something a restricted salesperson can do to their own or
 * anyone else's records — gated to managers/admins (the same viewAll
 * permission that lets them see everyone's customers in the first place). */
export async function reassignCustomer(customerId: string, ownerId: string) {
  const scope = await requireScope();
  if (!scope.viewAll) return;
  const result = await prisma.customer.updateMany({ where: { id: customerId }, data: { ownerId } });
  if (result.count === 0) return;
  await prisma.lead.updateMany({ where: { customerId, status: "ACTIVE" }, data: { assigneeId: ownerId } });
  await logActivity({ customerId, type: "REASSIGNED", description: "Customer reassigned.", actorId: scope.userId });
  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/customers");
  revalidatePath("/leads");
}
