"use client";

import { useTransition } from "react";
import { CheckCircle2, XCircle, Send, ArrowRightCircle, CreditCard } from "lucide-react";
import { sendQuoteAction, acceptQuoteAction, declineQuoteAction, convertQuoteToBooking } from "@/lib/actions/quotes";
import { recordPayment } from "@/lib/actions/payments";

export function QuoteStaffActions({ quoteId, status }: { quoteId: string; status: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-wrap gap-2">
      {status === "DRAFT" && (
        <button disabled={pending} onClick={() => startTransition(() => sendQuoteAction(quoteId))} className="btn btn-primary btn-sm">
          <Send size={13} /> Send to Client
        </button>
      )}
      {(status === "SENT" || status === "VIEWED") && (
        <>
          <button disabled={pending} onClick={() => startTransition(() => acceptQuoteAction(quoteId))} className="btn btn-secondary btn-sm">
            <CheckCircle2 size={13} /> Mark Accepted
          </button>
          <button disabled={pending} onClick={() => startTransition(() => declineQuoteAction(quoteId))} className="btn btn-secondary btn-sm !text-[var(--danger)]">
            <XCircle size={13} /> Mark Declined
          </button>
        </>
      )}
      {status === "ACCEPTED" && (
        <button
          disabled={pending}
          onClick={() =>
            startTransition(() => {
              convertQuoteToBooking(quoteId);
            })
          }
          className="btn btn-primary btn-sm"
        >
          <ArrowRightCircle size={13} /> Convert to Booking
        </button>
      )}
    </div>
  );
}

/** The client-facing "Accept Quote" / "Pay Deposit" buttons on the
 * luxury proposal view. Accepting works standalone; paying the deposit
 * records the payment (through the same seam Stripe will use once
 * connected) and accepts the quote in one step. */
export function QuoteClientActions({ quoteId, customerId, depositAmount, status }: { quoteId: string; customerId: string; depositAmount: number; status: string }) {
  const [pending, startTransition] = useTransition();

  if (status === "ACCEPTED" || status === "CONVERTED") {
    return <p className="text-center text-[13px] font-medium text-[var(--success)]">✓ Quote accepted — our concierge team will confirm your reservation shortly.</p>;
  }
  if (status === "DECLINED") {
    return <p className="text-center text-[13px] text-[var(--text-muted)]">This quote was declined.</p>;
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <button disabled={pending} onClick={() => startTransition(() => acceptQuoteAction(quoteId))} className="btn btn-secondary flex-1 py-3">
        <CheckCircle2 size={15} /> Accept Quote
      </button>
      <form
        action={async (formData) => {
          startTransition(async () => {
            await recordPayment(null, formData);
            await acceptQuoteAction(quoteId);
          });
        }}
        className="flex-1"
      >
        <input type="hidden" name="customerId" value={customerId} />
        <input type="hidden" name="amount" value={depositAmount} />
        <input type="hidden" name="type" value="DEPOSIT" />
        <input type="hidden" name="method" value="CARD" />
        <button type="submit" disabled={pending} className="btn btn-primary w-full py-3">
          <CreditCard size={15} /> Pay Deposit
        </button>
      </form>
    </div>
  );
}
