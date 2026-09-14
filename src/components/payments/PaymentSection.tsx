"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { CreditCard, Link2, RefreshCcw } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Field, SelectField, ErrorBox, SuccessBox } from "@/components/ui/Form";
import { recordPayment, sendPaymentLink, refundPaymentAction } from "@/lib/actions/payments";
import { StatusBadge } from "@/components/ui/Badge";
import { PAYMENT_RECORD_STATUSES, PAYMENT_TYPES, PAYMENT_METHODS } from "@/lib/constants";
import { formatCurrency, formatTimeAgo } from "@/lib/format";

type Payment = {
  id: string;
  amount: number;
  type: string;
  method: string;
  status: string;
  createdAt: Date;
  paymentLinkUrl: string | null;
};

export function PaymentSection({ customerId, bookingId, payments }: { customerId: string; bookingId?: string; payments: Payment[] }) {
  const [modal, setModal] = useState<"RECORD" | "LINK" | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex justify-end gap-2">
        <button onClick={() => setModal("LINK")} className="btn btn-secondary btn-sm"><Link2 size={13} /> Send Payment Link</button>
        <button onClick={() => setModal("RECORD")} className="btn btn-secondary btn-sm"><CreditCard size={13} /> Record Payment</button>
      </div>
      {payments.length === 0 && <p className="py-4 text-center text-[13px] text-[var(--text-faint)]">No payments on file yet.</p>}
      <ul className="space-y-2">
        {payments.map((p) => (
          <PaymentRow key={p.id} payment={p} />
        ))}
      </ul>
      {modal === "RECORD" && <RecordModal customerId={customerId} bookingId={bookingId} onClose={() => setModal(null)} />}
      {modal === "LINK" && <LinkModal customerId={customerId} bookingId={bookingId} onClose={() => setModal(null)} />}
    </div>
  );
}

function PaymentRow({ payment }: { payment: Payment }) {
  const [pending, startTransition] = useTransition();
  return (
    <li className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3.5 py-2.5">
      <div>
        <p className="text-[13px] font-medium text-[var(--text)]">{payment.type} · {formatCurrency(payment.amount)}</p>
        <p className="text-[11.5px] text-[var(--text-faint)]">{formatTimeAgo(payment.createdAt)} · {payment.method}</p>
      </div>
      <div className="flex items-center gap-2">
        <StatusBadge options={PAYMENT_RECORD_STATUSES} value={payment.status} />
        {payment.status === "SUCCEEDED" && (
          <button disabled={pending} onClick={() => startTransition(() => refundPaymentAction(payment.id))} className="btn btn-secondary btn-sm !p-1.5" title="Refund">
            <RefreshCcw size={12} />
          </button>
        )}
      </div>
    </li>
  );
}

function RecordModal({ customerId, bookingId, onClose }: { customerId: string; bookingId?: string; onClose: () => void }) {
  const [state, formAction, pending] = useActionState(recordPayment, null);
  useEffect(() => {
    if (state?.success) onClose();
  }, [state, onClose]);
  return (
    <Modal title="Record Payment" onClose={onClose}>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="customerId" value={customerId} />
        {bookingId && <input type="hidden" name="bookingId" value={bookingId} />}
        {state?.error && <ErrorBox>{state.error}</ErrorBox>}
        <Field label="Amount" name="amount" type="number" required />
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Type" name="type" options={PAYMENT_TYPES} defaultValue="DEPOSIT" />
          <SelectField label="Method" name="method" options={PAYMENT_METHODS} defaultValue="CARD" />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button type="submit" disabled={pending} className="btn btn-primary">{pending ? "Saving…" : "Record Payment"}</button>
        </div>
      </form>
    </Modal>
  );
}

function LinkModal({ customerId, bookingId, onClose }: { customerId: string; bookingId?: string; onClose: () => void }) {
  const [state, formAction, pending] = useActionState(sendPaymentLink, null);
  return (
    <Modal title="Send Payment Link" onClose={onClose}>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="customerId" value={customerId} />
        {bookingId && <input type="hidden" name="bookingId" value={bookingId} />}
        {state?.error && <ErrorBox>{state.error}</ErrorBox>}
        {state?.success && <SuccessBox>{state.success}</SuccessBox>}
        <Field label="Amount" name="amount" type="number" required />
        <SelectField label="Type" name="type" options={PAYMENT_TYPES} defaultValue="DEPOSIT" />
        <p className="text-xs text-[var(--text-muted)]">Once Stripe is connected in Settings → Integrations, this generates a real hosted payment page. Until then it creates an internal secure link you can copy to the client.</p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost">Close</button>
          <button type="submit" disabled={pending} className="btn btn-primary">{pending ? "Creating…" : "Create Link"}</button>
        </div>
      </form>
    </Modal>
  );
}
