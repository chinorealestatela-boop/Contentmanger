"use server";

// Future / down-payment tracking (Feature 1 + 5). Follows the same shape
// as the rest of src/lib/actions/*: zod-validated form actions bound via
// useActionState, requireScope() for auth, logActivity() for the audit
// trail, revalidatePath() to refresh server-rendered views.

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireScope } from "@/lib/queries/scope";
import { logActivity } from "@/lib/activity";
import { recordFollowUpAction } from "@/lib/followup";
import { revalidatePath } from "next/cache";
import type { SimpleActionState } from "@/lib/actions/communications";

const createPlanSchema = z.object({
  customerId: z.string().min(1),
  leadId: z.string().optional(),
  totalRequired: z.coerce.number().positive("Total required must be greater than $0."),
  amountPaidUpfront: z.coerce.number().min(0).default(0),
  notes: z.string().optional(),
  // Installments, submitted as parallel arrays from repeated "Payment #N"
  // rows in the form (see PaymentPlanModal) — FormData.getAll() reads
  // these back in the same order they were appended in.
  paymentAmounts: z.array(z.coerce.number().positive()).min(1, "Add at least one payment."),
  paymentDueDates: z.array(z.string().min(1)),
});

export async function createPaymentPlan(_prev: SimpleActionState, formData: FormData): Promise<SimpleActionState> {
  const scope = await requireScope();

  const parsed = createPlanSchema.safeParse({
    customerId: formData.get("customerId"),
    leadId: formData.get("leadId") || undefined,
    totalRequired: formData.get("totalRequired"),
    amountPaidUpfront: formData.get("amountPaidUpfront") || 0,
    notes: formData.get("notes") || undefined,
    paymentAmounts: formData.getAll("paymentAmount"),
    paymentDueDates: formData.getAll("paymentDueDate"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;

  if (d.paymentAmounts.length !== d.paymentDueDates.length || d.paymentDueDates.some((v) => !v)) {
    return { error: "Every payment needs both an amount and a due date." };
  }

  const plan = await prisma.paymentPlan.create({
    data: {
      customerId: d.customerId,
      leadId: d.leadId,
      totalRequired: d.totalRequired,
      amountPaidUpfront: d.amountPaidUpfront,
      notes: d.notes,
      createdById: scope.userId,
      payments: {
        create: d.paymentAmounts.map((amount, i) => ({
          customerId: d.customerId,
          leadId: d.leadId,
          amount,
          dueDate: new Date(`${d.paymentDueDates[i]}T00:00:00`),
        })),
      },
    },
  });

  await logActivity({
    customerId: d.customerId,
    leadId: d.leadId,
    type: "PAYMENT_PLAN_CREATED",
    description: `Future payment schedule created: ${d.paymentAmounts.length} payment${d.paymentAmounts.length === 1 ? "" : "s"} totaling $${d.paymentAmounts.reduce((a, b) => a + b, 0).toLocaleString()}.`,
    actorId: scope.userId,
    metadata: { planId: plan.id },
  });
  await recordFollowUpAction({ customerId: d.customerId, leadId: d.leadId, actorId: scope.userId, taskTypes: ["FOLLOW_UP", "OTHER", "CREDIT"], source: "Down payment schedule created" });

  revalidatePath(`/customers/${d.customerId}`);
  revalidatePath("/payments");
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  return { success: "Payment schedule created." };
}

const markPaidSchema = z.object({
  paymentId: z.string().min(1),
  amountPaid: z.coerce.number().positive("Enter the amount received."),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
});

/** Marks a payment PAID (amountPaid >= amount) or PARTIALLY_PAID
 * (amountPaid < amount) — either way the plan's remaining balance is
 * recomputed automatically the next time it's read (it's derived, never
 * stored — see computeRemainingBalance). Once paid, the reminder sweep
 * stops touching this payment entirely (it only ever looks at PENDING/
 * LATE rows), so no future reminder can go out for it — "if a payment is
 * marked Paid before its due date, do not send future reminders." This
 * requires the payment to already exist and be confirmed here by an
 * authorized (logged-in) user — nothing marks a payment paid on its own. */
export async function markPaymentPaid(_prev: SimpleActionState, formData: FormData): Promise<SimpleActionState> {
  const scope = await requireScope();
  const parsed = markPaidSchema.safeParse({
    paymentId: formData.get("paymentId"),
    amountPaid: formData.get("amountPaid"),
    referenceNumber: formData.get("referenceNumber") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { paymentId, amountPaid, referenceNumber, notes } = parsed.data;

  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) return { error: "Payment not found." };

  const newStatus = amountPaid >= payment.amount ? "PAID" : "PARTIALLY_PAID";
  await prisma.payment.update({
    where: { id: paymentId },
    data: { status: newStatus, amountPaid, paidAt: new Date(), paidById: scope.userId, referenceNumber: referenceNumber ?? payment.referenceNumber, notes: notes ?? payment.notes },
  });

  await logActivity({
    customerId: payment.customerId,
    leadId: payment.leadId,
    type: "PAYMENT_RECEIVED",
    description: `Payment ${newStatus === "PAID" ? "marked paid" : "marked partially paid"} — $${amountPaid.toLocaleString()} of $${payment.amount.toLocaleString()} due ${new Date(payment.dueDate).toLocaleDateString()}${referenceNumber ? ` (ref #${referenceNumber})` : ""}.`,
    actorId: scope.userId,
    metadata: { paymentId },
  });
  await recordFollowUpAction({ customerId: payment.customerId, leadId: payment.leadId, actorId: scope.userId, taskTypes: ["FOLLOW_UP", "OTHER", "CREDIT"], source: "Payment recorded" });

  revalidatePath(`/customers/${payment.customerId}`);
  revalidatePath("/payments");
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  return { success: "Payment updated." };
}

/** Waives a payment — the customer is no longer expected to pay it, but
 * (unlike Cancel, which implies the schedule itself was a mistake) this
 * is a deliberate business decision to let the amount go. Either way,
 * future reminders stop immediately since the sweep only ever touches
 * PENDING/LATE rows. */
export async function markPaymentWaived(paymentId: string) {
  const scope = await requireScope();
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) return;

  await prisma.payment.update({ where: { id: paymentId }, data: { status: "WAIVED" } });
  await logActivity({
    customerId: payment.customerId,
    leadId: payment.leadId,
    type: "PAYMENT_UPDATED",
    description: `Payment waived — $${payment.amount.toLocaleString()} originally due ${new Date(payment.dueDate).toLocaleDateString()}.`,
    actorId: scope.userId,
    metadata: { paymentId },
  });

  revalidatePath(`/customers/${payment.customerId}`);
  revalidatePath("/payments");
  revalidatePath("/calendar");
}

const editPaymentSchema = z.object({
  paymentId: z.string().min(1),
  amount: z.coerce.number().positive(),
  dueDate: z.string().min(1),
  notes: z.string().optional(),
});

export async function updatePayment(_prev: SimpleActionState, formData: FormData): Promise<SimpleActionState> {
  const scope = await requireScope();
  const parsed = editPaymentSchema.safeParse({
    paymentId: formData.get("paymentId"),
    amount: formData.get("amount"),
    dueDate: formData.get("dueDate"),
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { paymentId, amount, dueDate, notes } = parsed.data;

  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) return { error: "Payment not found." };

  const newDueDate = new Date(`${dueDate}T00:00:00`);
  // Editing the amount or date re-opens the reminder window for stages
  // that haven't fired yet relative to the new date, but never re-sends
  // one that already went out for the old date — clearing remindersSent
  // is the correct, simple behavior here since the whole point of a due
  // date changing is that the old schedule no longer applies. If the
  // payment had been auto-marked Late and the new date is in the future,
  // it's no longer late — "if a due date is changed, update the reminder
  // schedule accordingly."
  const revertToPending = payment.status === "LATE" && newDueDate >= new Date(new Date().toDateString());
  await prisma.payment.update({
    where: { id: paymentId },
    data: { amount, dueDate: newDueDate, notes, remindersSent: "[]", status: revertToPending ? "PENDING" : payment.status },
  });

  await logActivity({
    customerId: payment.customerId,
    leadId: payment.leadId,
    type: "PAYMENT_UPDATED",
    description: `Payment updated — $${amount.toLocaleString()} due ${new Date(dueDate).toLocaleDateString()}.`,
    actorId: scope.userId,
    metadata: { paymentId },
  });

  revalidatePath(`/customers/${payment.customerId}`);
  revalidatePath("/payments");
  revalidatePath("/calendar");
  return { success: "Payment updated." };
}

export async function cancelPayment(paymentId: string) {
  const scope = await requireScope();
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) return;

  await prisma.payment.update({ where: { id: paymentId }, data: { status: "CANCELLED" } });
  await logActivity({
    customerId: payment.customerId,
    leadId: payment.leadId,
    type: "PAYMENT_CANCELLED",
    description: `Payment cancelled — $${payment.amount.toLocaleString()} due ${new Date(payment.dueDate).toLocaleDateString()}.`,
    actorId: scope.userId,
    metadata: { paymentId },
  });

  revalidatePath(`/customers/${payment.customerId}`);
  revalidatePath("/payments");
  revalidatePath("/calendar");
}

const addNoteSchema = z.object({ paymentId: z.string().min(1), notes: z.string().min(1) });

export async function addPaymentNote(_prev: SimpleActionState, formData: FormData): Promise<SimpleActionState> {
  const scope = await requireScope();
  const parsed = addNoteSchema.safeParse({ paymentId: formData.get("paymentId"), notes: formData.get("notes") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const payment = await prisma.payment.findUnique({ where: { id: parsed.data.paymentId } });
  if (!payment) return { error: "Payment not found." };

  await prisma.payment.update({ where: { id: parsed.data.paymentId }, data: { notes: parsed.data.notes } });
  await logActivity({
    customerId: payment.customerId,
    leadId: payment.leadId,
    type: "PAYMENT_UPDATED",
    description: `Note added to payment due ${new Date(payment.dueDate).toLocaleDateString()}: ${parsed.data.notes.slice(0, 120)}`,
    actorId: scope.userId,
    metadata: { paymentId: payment.id },
  });

  revalidatePath(`/customers/${payment.customerId}`);
  revalidatePath("/payments");
  return { success: "Note added." };
}
