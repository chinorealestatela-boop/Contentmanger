"use client";

import { useActionState, useEffect, useState } from "react";
import { Pencil, StickyNote, XCircle, CheckCircle2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { EmptyRow } from "@/components/ui/SectionCard";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatDate } from "@/lib/format";
import { computeRemainingBalance, getPaymentDisplayStatus, PAYMENT_DISPLAY_STATUS_META, type PaymentDisplayStatus } from "@/lib/payments/status";
import { markPaymentPaid, updatePayment, cancelPayment, addPaymentNote } from "@/lib/actions/payments";

type PaymentRow = {
  id: string;
  amount: number;
  dueDate: Date;
  status: string;
  amountPaid: number;
  paidAt: Date | null;
  notes: string | null;
  paidBy?: { firstName: string; lastName: string } | null;
};

type PlanRow = {
  id: string;
  totalRequired: number;
  amountPaidUpfront: number;
  status: string;
  notes: string | null;
  createdAt: Date;
  createdBy: { firstName: string; lastName: string };
  payments: PaymentRow[];
};

function StatusBadge({ status }: { status: PaymentDisplayStatus }) {
  const meta = PAYMENT_DISPLAY_STATUS_META[status];
  const variant =
    status === "PAID" ? "sold" : status === "OVERDUE" ? "overdue" : status === "DUE_TODAY" ? "warm" : status === "CANCELLED" ? "lost" : status === "PARTIALLY_PAID" ? "appointment" : "neutral";
  return <Badge variant={variant as never}>{meta.label}</Badge>;
}

export function PaymentPlanSection({ plans }: { plans: PlanRow[] }) {
  const [modalPayment, setModalPayment] = useState<{ kind: "PAID" | "EDIT" | "NOTE"; payment: PaymentRow } | null>(null);

  if (plans.length === 0) {
    return <EmptyRow>No future payment schedule on file. Use the &ldquo;Future Payment&rdquo; button above to add one.</EmptyRow>;
  }

  return (
    <div className="space-y-5">
      {plans.map((plan) => {
        const remaining = computeRemainingBalance(plan);
        return (
          <div key={plan.id} className="rounded-lg border border-[var(--border)]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[12.5px]">
                <span><span className="text-[var(--text-faint)]">Total required:</span> <span className="font-semibold text-[var(--text)]">{formatCurrency(plan.totalRequired)}</span></span>
                <span><span className="text-[var(--text-faint)]">Paid upfront:</span> <span className="font-semibold text-[var(--text)]">{formatCurrency(plan.amountPaidUpfront)}</span></span>
                <span><span className="text-[var(--text-faint)]">Remaining:</span> <span className={`font-bold ${remaining > 0 ? "text-amber-600" : "text-emerald-600"}`}>{formatCurrency(remaining)}</span></span>
              </div>
              {plan.status !== "ACTIVE" && <Badge variant={plan.status === "COMPLETED" ? "sold" : "lost"}>{plan.status}</Badge>}
            </div>
            <ul className="divide-y divide-[var(--border)]">
              {plan.payments.map((p) => {
                const display = getPaymentDisplayStatus(p);
                const isTerminal = p.status === "PAID" || p.status === "CANCELLED";
                return (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-[var(--text)]">
                        {formatCurrency(p.amount)} due {formatDate(p.dueDate)}
                        {p.status === "PARTIALLY_PAID" && <span className="ml-1.5 text-[11.5px] font-normal text-[var(--text-muted)]">({formatCurrency(p.amountPaid)} received)</span>}
                      </p>
                      {p.notes && <p className="mt-0.5 text-[11.5px] text-[var(--text-muted)]">{p.notes}</p>}
                      {p.paidAt && p.paidBy && <p className="mt-0.5 text-[11px] text-[var(--text-faint)]">Marked by {p.paidBy.firstName} {p.paidBy.lastName} on {formatDate(p.paidAt)}</p>}
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
                              if (confirm("Cancel this scheduled payment?")) cancelPayment(p.id);
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
          </div>
        );
      })}

      {modalPayment?.kind === "PAID" && <MarkPaidModal payment={modalPayment.payment} onClose={() => setModalPayment(null)} />}
      {modalPayment?.kind === "EDIT" && <EditPaymentModal payment={modalPayment.payment} onClose={() => setModalPayment(null)} />}
      {modalPayment?.kind === "NOTE" && <NoteModal payment={modalPayment.payment} onClose={() => setModalPayment(null)} />}
    </div>
  );
}

function useCloseOnSuccess(state: { success?: string } | null, onClose: () => void) {
  useEffect(() => {
    if (state?.success) onClose();
  }, [state, onClose]);
}

function MarkPaidModal({ payment, onClose }: { payment: PaymentRow; onClose: () => void }) {
  const [state, formAction, pending] = useActionState(markPaymentPaid, null);
  useCloseOnSuccess(state, onClose);
  return (
    <Modal title="Mark Payment Paid" onClose={onClose}>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="paymentId" value={payment.id} />
        {state?.error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
        <p className="text-[13px] text-[var(--text-muted)]">Scheduled: <span className="font-semibold text-[var(--text)]">{formatCurrency(payment.amount)}</span> due {formatDate(payment.dueDate)}</p>
        <div>
          <label className="label">Amount Received</label>
          <input name="amountPaid" type="number" step="0.01" required defaultValue={payment.amount} className="input" autoFocus />
          <p className="mt-1 text-[11.5px] text-[var(--text-faint)]">Less than the full amount will be marked &ldquo;Partially Paid.&rdquo;</p>
        </div>
        <div><label className="label">Notes (optional)</label><textarea name="notes" rows={2} className="input" /></div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button type="submit" disabled={pending} className="btn btn-primary">{pending ? "Saving…" : "Mark Paid"}</button>
        </div>
      </form>
    </Modal>
  );
}

function EditPaymentModal({ payment, onClose }: { payment: PaymentRow; onClose: () => void }) {
  const [state, formAction, pending] = useActionState(updatePayment, null);
  useCloseOnSuccess(state, onClose);
  const dueStr = new Date(payment.dueDate).toISOString().slice(0, 10);
  return (
    <Modal title="Edit Payment" onClose={onClose}>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="paymentId" value={payment.id} />
        {state?.error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Amount</label><input name="amount" type="number" step="0.01" required defaultValue={payment.amount} className="input" /></div>
          <div><label className="label">Due Date</label><input name="dueDate" type="date" required defaultValue={dueStr} className="input" /></div>
        </div>
        <div><label className="label">Notes</label><textarea name="notes" rows={2} defaultValue={payment.notes ?? ""} className="input" /></div>
        <p className="text-xs text-[var(--text-muted)]">Changing the amount or date resets which reminders have already gone out for this payment.</p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button type="submit" disabled={pending} className="btn btn-primary">{pending ? "Saving…" : "Save"}</button>
        </div>
      </form>
    </Modal>
  );
}

function NoteModal({ payment, onClose }: { payment: PaymentRow; onClose: () => void }) {
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
