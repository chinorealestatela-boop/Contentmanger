"use client";

// First Payment — the customer's first loan payment to their bank/lender
// (money owed to a third party, never to the dealership — see the
// paymentType comment on the Payment model in prisma/schema.prisma).
// Deliberately its own section, separate from Pick Payments below it on
// the customer profile, with its own red color and "FIRST" label so the
// two are never confused at a glance.

import { useActionState, useEffect, useState } from "react";
import { Pencil, StickyNote, XCircle, CheckCircle2, Landmark } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { EmptyRow } from "@/components/ui/SectionCard";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatDate } from "@/lib/format";
import { getPaymentDisplayStatus, PAYMENT_DISPLAY_STATUS_META, type PaymentDisplayStatus } from "@/lib/payments/status";
import { markPaymentPaid, updatePayment, cancelPayment, addPaymentNote } from "@/lib/actions/payments";

type FirstPaymentRow = {
  id: string;
  amount: number;
  dueDate: Date;
  status: string;
  amountPaid: number;
  paidAt: Date | null;
  paidToName: string | null;
  referenceNumber: string | null;
  notes: string | null;
  paidBy?: { firstName: string; lastName: string } | null;
};

function StatusBadge({ status }: { status: PaymentDisplayStatus }) {
  const meta = PAYMENT_DISPLAY_STATUS_META[status];
  const variant =
    status === "PAID" ? "sold" : status === "LATE" ? "overdue" : status === "DUE_TODAY" ? "warm" : status === "CANCELLED" || status === "WAIVED" ? "lost" : status === "PARTIALLY_PAID" ? "appointment" : "neutral";
  return <Badge variant={variant as never}>{meta.label}</Badge>;
}

export function FirstPaymentSection({ payments }: { payments: FirstPaymentRow[] }) {
  const [modalPayment, setModalPayment] = useState<{ kind: "PAID" | "EDIT" | "NOTE"; payment: FirstPaymentRow } | null>(null);

  if (payments.length === 0) {
    return <EmptyRow>No First Payment on file. Use the &ldquo;Add First Payment&rdquo; button above once financing is confirmed.</EmptyRow>;
  }

  return (
    <div className="space-y-2">
      <ul className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
        {payments.map((p) => {
          const display = getPaymentDisplayStatus(p);
          const isTerminal = p.status === "PAID" || p.status === "CANCELLED" || p.status === "WAIVED";
          return (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white" style={{ background: "#DC2626" }}>First</span>
                  <p className="text-[13px] font-medium" style={{ color: "#DC2626" }}>
                    {formatCurrency(p.amount)} due {formatDate(p.dueDate)}
                    {p.status === "PARTIALLY_PAID" && <span className="ml-1.5 text-[11.5px] font-normal text-[var(--text-muted)]">({formatCurrency(p.amountPaid)} received)</span>}
                  </p>
                </div>
                <p className="mt-0.5 flex items-center gap-1 text-[11.5px] text-[var(--text-muted)]"><Landmark size={11} /> Paid to {p.paidToName || "—"}</p>
                {p.notes && <p className="mt-0.5 text-[11.5px] text-[var(--text-muted)]">{p.notes}</p>}
                {p.paidAt && p.paidBy && (
                  <p className="mt-0.5 text-[11px] text-[var(--text-faint)]">
                    Confirmed by {p.paidBy.firstName} {p.paidBy.lastName} on {formatDate(p.paidAt)}{p.referenceNumber ? ` · Ref #${p.referenceNumber}` : ""}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <StatusBadge status={display} />
                {!isTerminal && (
                  <>
                    <button title="Mark Paid" onClick={() => setModalPayment({ kind: "PAID", payment: p })} className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50"><CheckCircle2 size={15} /></button>
                    <button title="Edit" onClick={() => setModalPayment({ kind: "EDIT", payment: p })} className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]"><Pencil size={14} /></button>
                    <button title="Add Note" onClick={() => setModalPayment({ kind: "NOTE", payment: p })} className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]"><StickyNote size={14} /></button>
                    <button
                      title="Cancel"
                      onClick={() => {
                        if (confirm("Cancel this First Payment record?")) cancelPayment(p.id);
                      }}
                      className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                    >
                      <XCircle size={15} />
                    </button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {modalPayment?.kind === "PAID" && <MarkPaidModal payment={modalPayment.payment} onClose={() => setModalPayment(null)} />}
      {modalPayment?.kind === "EDIT" && <EditFirstPaymentModal payment={modalPayment.payment} onClose={() => setModalPayment(null)} />}
      {modalPayment?.kind === "NOTE" && <NoteModal payment={modalPayment.payment} onClose={() => setModalPayment(null)} />}
    </div>
  );
}

function useCloseOnSuccess(state: { success?: string } | null, onClose: () => void) {
  useEffect(() => {
    if (state?.success) onClose();
  }, [state, onClose]);
}

function MarkPaidModal({ payment, onClose }: { payment: FirstPaymentRow; onClose: () => void }) {
  const [state, formAction, pending] = useActionState(markPaymentPaid, null);
  useCloseOnSuccess(state, onClose);
  return (
    <Modal title="Confirm First Payment" onClose={onClose}>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="paymentId" value={payment.id} />
        {state?.error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
        <p className="text-[13px] text-[var(--text-muted)]">Scheduled: <span className="font-semibold text-[var(--text)]">{formatCurrency(payment.amount)}</span> due {formatDate(payment.dueDate)} to {payment.paidToName}</p>
        <div>
          <label className="label">Amount Confirmed Paid</label>
          <input name="amountPaid" type="number" step="0.01" required defaultValue={payment.amount} className="input" autoFocus />
        </div>
        <div><label className="label">Confirmation / Reference # (optional)</label><input name="referenceNumber" className="input" placeholder="e.g. lender confirmation #" /></div>
        <div><label className="label">Notes (optional)</label><textarea name="notes" rows={2} className="input" /></div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button type="submit" disabled={pending} className="btn btn-primary">{pending ? "Saving…" : "Confirm Paid"}</button>
        </div>
      </form>
    </Modal>
  );
}

function EditFirstPaymentModal({ payment, onClose }: { payment: FirstPaymentRow; onClose: () => void }) {
  const [state, formAction, pending] = useActionState(updatePayment, null);
  useCloseOnSuccess(state, onClose);
  const dueStr = new Date(payment.dueDate).toISOString().slice(0, 10);
  return (
    <Modal title="Edit First Payment" onClose={onClose}>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="paymentId" value={payment.id} />
        {state?.error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
        <div><label className="label">Bank / Lender Name</label><input name="paidToName" required defaultValue={payment.paidToName ?? ""} className="input" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Amount</label><input name="amount" type="number" step="0.01" required defaultValue={payment.amount} className="input" /></div>
          <div><label className="label">Due Date</label><input name="dueDate" type="date" required defaultValue={dueStr} className="input" /></div>
        </div>
        <div><label className="label">Notes</label><textarea name="notes" rows={2} defaultValue={payment.notes ?? ""} className="input" /></div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button type="submit" disabled={pending} className="btn btn-primary">{pending ? "Saving…" : "Save"}</button>
        </div>
      </form>
    </Modal>
  );
}

function NoteModal({ payment, onClose }: { payment: FirstPaymentRow; onClose: () => void }) {
  const [state, formAction, pending] = useActionState(addPaymentNote, null);
  useCloseOnSuccess(state, onClose);
  return (
    <Modal title="Add Note" onClose={onClose}>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="paymentId" value={payment.id} />
        {state?.error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
        <textarea name="notes" required rows={3} defaultValue={payment.notes ?? ""} className="input" autoFocus />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button type="submit" disabled={pending} className="btn btn-primary">{pending ? "Saving…" : "Save Note"}</button>
        </div>
      </form>
    </Modal>
  );
}
