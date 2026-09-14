// Payments integration seam (Stripe or equivalent). No secret keys ever
// live in this file or in application code — real credentials belong in
// environment variables (STRIPE_SECRET_KEY) read only from a server
// context, and are configured from Settings → Integrations (non-secret
// metadata only is stored in the Integration table).
//
// Until a processor is connected, "creating a payment link" generates an
// internal secure-looking link staff can copy/send, and "recording a
// payment" just writes to the Payment ledger — the whole deposit/balance/
// paid-in-full flow works end-to-end without Stripe.

import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { runAutomation } from "@/lib/automation/engine";

export async function createPaymentLink(params: { bookingId?: string | null; quoteId?: string | null; customerId: string; amount: number; type: "DEPOSIT" | "BALANCE" | "FULL" }) {
  const integration = await prisma.integration.findUnique({ where: { provider: "STRIPE" } });

  const payment = await prisma.payment.create({
    data: {
      customerId: params.customerId,
      bookingId: params.bookingId ?? null,
      quoteId: params.quoteId ?? null,
      amount: params.amount,
      type: params.type,
      method: "CARD",
      status: "PENDING",
      paymentLinkUrl: `/pay/${cryptoRandom()}`,
    },
  });

  if (integration?.enabled) {
    // Real Stripe connected — this is where Stripe Checkout / Payment
    // Links API creates a real hosted payment page and the row above is
    // updated with the real processorRef + paymentLinkUrl.
    // const session = await stripe.checkout.sessions.create({ ... });
  }

  return payment;
}

/** Marks a payment succeeded (in v1, staff confirm manually or the demo
 * "Pay Deposit" button on the quote page calls this directly; once Stripe
 * webhooks are connected, this is called from the webhook handler
 * instead). Updates the related booking's payment status/balance and
 * fires the PAYMENT_RECEIVED automation. */
export async function markPaymentSucceeded(paymentId: string) {
  const payment = await prisma.payment.update({ where: { id: paymentId }, data: { status: "SUCCEEDED", processedAt: new Date() } });

  if (payment.bookingId) {
    const booking = await prisma.booking.findUnique({ where: { id: payment.bookingId } });
    if (booking) {
      const totalPaid = await prisma.payment.aggregate({ where: { bookingId: booking.id, status: "SUCCEEDED", type: { in: ["DEPOSIT", "BALANCE", "FULL"] } }, _sum: { amount: true } });
      const paid = totalPaid._sum.amount ?? 0;
      const remaining = Math.max(0, booking.totalPrice - paid);
      await prisma.booking.update({
        where: { id: booking.id },
        data: { deposit: payment.type === "DEPOSIT" ? payment.amount : booking.deposit, remainingBalance: remaining, paymentStatus: remaining <= 0 ? "PAID_IN_FULL" : "DEPOSIT_PAID" },
      });
      await logActivity({ customerId: payment.customerId, bookingId: booking.id, type: "PAYMENT_RECEIVED", description: `Payment of $${payment.amount.toLocaleString()} received (${payment.type}).` });
      await runAutomation("PAYMENT_RECEIVED", { customerId: payment.customerId, bookingId: booking.id });
    }
  }

  return payment;
}

export async function markPaymentFailed(paymentId: string) {
  const payment = await prisma.payment.update({ where: { id: paymentId }, data: { status: "FAILED" } });
  await runAutomation("PAYMENT_FAILED", { customerId: payment.customerId, bookingId: payment.bookingId });
  return payment;
}

function cryptoRandom() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
