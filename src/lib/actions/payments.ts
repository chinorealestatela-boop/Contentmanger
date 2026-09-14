"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireScope } from "@/lib/queries/scope";
import { logActivity } from "@/lib/activity";
import { createPaymentLink, markPaymentSucceeded, markPaymentFailed } from "@/lib/integrations/payments";
import { revalidatePath } from "next/cache";
import type { SimpleActionState } from "@/lib/actions/communications";

function revalidateAll(bookingId?: string | null, customerId?: string) {
  revalidatePath("/payments");
  revalidatePath("/dashboard");
  if (bookingId) revalidatePath(`/bookings/${bookingId}`);
  if (customerId) revalidatePath(`/customers/${customerId}`);
}

const recordSchema = z.object({
  customerId: z.string().min(1),
  bookingId: z.string().optional(),
  amount: z.string().min(1, "Amount is required."),
  type: z.string().default("DEPOSIT"),
  method: z.string().default("CARD"),
});

/** Staff manually records a payment already collected (cash, wire, or a
 * card charge taken outside the app) — instantly marks it succeeded and
 * updates the booking's balance. */
export async function recordPayment(_prev: SimpleActionState, formData: FormData): Promise<SimpleActionState> {
  const scope = await requireScope();
  const parsed = recordSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;

  const payment = await prisma.payment.create({
    data: { customerId: d.customerId, bookingId: d.bookingId || null, amount: Number(d.amount), type: d.type, method: d.method, status: "PENDING" },
  });
  await markPaymentSucceeded(payment.id);
  await logActivity({ customerId: d.customerId, bookingId: d.bookingId, type: "PAYMENT_RECEIVED", description: `Payment recorded: $${Number(d.amount).toLocaleString()} (${d.type}).`, actorId: scope.userId });

  revalidateAll(d.bookingId, d.customerId);
  return { success: "Payment recorded." };
}

const linkSchema = z.object({
  customerId: z.string().min(1),
  bookingId: z.string().optional(),
  amount: z.string().min(1, "Amount is required."),
  type: z.string().default("DEPOSIT"),
});

/** Generates a secure payment link staff can text/email to the client
 * (spec §13: "Allow staff to send secure payment links to customers").
 * Works today without Stripe connected — see src/lib/integrations/payments.ts. */
export async function sendPaymentLink(_prev: SimpleActionState, formData: FormData): Promise<SimpleActionState> {
  const scope = await requireScope();
  const parsed = linkSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;

  const payment = await createPaymentLink({ customerId: d.customerId, bookingId: d.bookingId || null, amount: Number(d.amount), type: d.type as "DEPOSIT" | "BALANCE" | "FULL" });
  await logActivity({ customerId: d.customerId, bookingId: d.bookingId, type: "AUTOMATION", description: `Payment link sent for $${Number(d.amount).toLocaleString()}.`, actorId: scope.userId });

  revalidateAll(d.bookingId, d.customerId);
  return { success: `Payment link created: ${payment.paymentLinkUrl}` };
}

export async function markPaymentPaidAction(paymentId: string) {
  await requireScope();
  const payment = await markPaymentSucceeded(paymentId);
  revalidateAll(payment.bookingId, payment.customerId);
}

export async function markPaymentFailedAction(paymentId: string) {
  await requireScope();
  const payment = await markPaymentFailed(paymentId);
  revalidateAll(payment.bookingId, payment.customerId);
}

export async function refundPaymentAction(paymentId: string) {
  const scope = await requireScope();
  const payment = await prisma.payment.update({ where: { id: paymentId }, data: { status: "REFUNDED" } });
  await prisma.payment.create({ data: { customerId: payment.customerId, bookingId: payment.bookingId, amount: payment.amount, type: "REFUND", method: payment.method, status: "SUCCEEDED", processedAt: new Date() } });
  if (payment.bookingId) await prisma.booking.update({ where: { id: payment.bookingId }, data: { paymentStatus: "REFUNDED" } });
  await logActivity({ customerId: payment.customerId, bookingId: payment.bookingId, type: "AUTOMATION", description: `Refunded $${payment.amount.toLocaleString()}.`, actorId: scope.userId });
  revalidateAll(payment.bookingId, payment.customerId);
}
