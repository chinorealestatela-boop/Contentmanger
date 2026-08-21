"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireScope } from "@/lib/queries/scope";
import { logActivity } from "@/lib/activity";
import { revalidatePath } from "next/cache";
import type { SimpleActionState } from "@/lib/actions/communications";

const schema = z.object({
  customerId: z.string().min(1),
  year: z.string().optional(),
  make: z.string().optional(),
  model: z.string().optional(),
  trim: z.string().optional(),
  vin: z.string().optional(),
  mileage: z.string().optional(),
  payoff: z.string().optional(),
  estimatedValue: z.string().optional(),
  desiredValue: z.string().optional(),
  appraisalStatus: z.string().default("PENDING"),
  notes: z.string().optional(),
});

export async function addTradeIn(_prev: SimpleActionState, formData: FormData): Promise<SimpleActionState> {
  const scope = await requireScope();
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;

  await prisma.tradeIn.create({
    data: {
      customerId: d.customerId,
      year: d.year ? Number(d.year) : undefined,
      make: d.make,
      model: d.model,
      trim: d.trim,
      vin: d.vin,
      mileage: d.mileage ? Number(d.mileage) : undefined,
      payoff: d.payoff ? Number(d.payoff) : 0,
      estimatedValue: d.estimatedValue ? Number(d.estimatedValue) : 0,
      desiredValue: d.desiredValue ? Number(d.desiredValue) : undefined,
      appraisalStatus: d.appraisalStatus,
      notes: d.notes,
    },
  });

  await logActivity({
    customerId: d.customerId,
    type: "TRADE_ADDED",
    description: `Trade-in added: ${[d.year, d.make, d.model].filter(Boolean).join(" ") || "vehicle"}.`,
    actorId: scope.userId,
  });

  revalidatePath(`/customers/${d.customerId}`);
  revalidatePath("/trade-ins");
  return { success: "Trade-in added." };
}

export async function updateTradeInStatus(tradeInId: string, customerId: string, appraisalStatus: string) {
  await requireScope();
  await prisma.tradeIn.update({ where: { id: tradeInId }, data: { appraisalStatus } });
  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/trade-ins");
}
