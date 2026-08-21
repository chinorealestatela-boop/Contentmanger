"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireScope } from "@/lib/queries/scope";
import { logActivity } from "@/lib/activity";
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

  await prisma.customer.update({ where: { id: customerId }, data: rest });
  await logActivity({ customerId, type: "CUSTOMER_UPDATED", description: "Contact information updated.", actorId: scope.userId });

  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/customers");
  return { success: "Saved." };
}

export async function reassignCustomer(customerId: string, ownerId: string) {
  const scope = await requireScope();
  await prisma.customer.update({ where: { id: customerId }, data: { ownerId } });
  await prisma.lead.updateMany({ where: { customerId, status: "ACTIVE" }, data: { assigneeId: ownerId } });
  await logActivity({ customerId, type: "REASSIGNED", description: "Customer reassigned.", actorId: scope.userId });
  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/customers");
  revalidatePath("/leads");
}
