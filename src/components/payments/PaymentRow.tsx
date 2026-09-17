"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { Phone, MessageSquare, User, CheckCircle2, Pencil, StickyNote } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatDate } from "@/lib/format";
import { getPaymentDisplayStatus, PAYMENT_DISPLAY_STATUS_META, type PaymentDisplayStatus } from "@/lib/payments/status";
import { markPaymentPaid, updatePayment, addPaymentNote } from "@/lib/actions/payments";
import type { PaymentListItem } from "@/lib/queries/payments";

function StatusBadge({ status }: { status: PaymentDisplayStatus }) {
  const meta = PAYMENT_DISPLAY_STATUS_META[status];
  const variant = status === "OVERDUE" ? "overdue" : status === "DUE_TODAY" ? "warm" : status === "DUE_SOON" ? "cold" : "neutral";
  return <Badge variant={variant as never}>{meta.label}</Badge>;
}

export function PaymentRow({ item }: { item: PaymentListItem }) {
  const [modal, setModal] = useState<"PAID" | "EDIT" | "NOTE" | null>(null);
  const display = getPaymentDisplayStatus(item);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <Link href={`/customers/${item.customerId}`} className="text-[13.5px] font-semibold text-[var(--text)] hover:text-[var(--brand)] hover:underline">{item.customerName}</Link>
        <p className="text-[11.5px] text-[var(--text-muted)]">{formatCurrency(item.amount)} due {formatDate(item.dueDate)} · {item.salespersonName}</p>
        {item.notes && <p className="mt-0.5 text-[11px] text-[var(--text-faint)]">{item.notes}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <StatusBadge status={display} />
        {item.customerPhone && (
          <>
            <a href={`tel:${item.customerPhone}`} title="Call" className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]"><Phone size={14} /></a>
            <a href={`sms:${item.customerPhone}`} title="Text" className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]"><MessageSquare size={14} /></a>
          </>
        )}
        <Link href={`/customers/${item.customerId}`} title="View Customer" className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]"><User size={14} /></Link>
        <button title="Mark Paid" onClick={() => setModal("PAID")} className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50"><CheckCircle2 size={15} /></button>
        <button title="Edit" onClick={() => setModal("EDIT")} className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]"><Pencil size={14} /></button>
        <button title="Add Note" onClick={() => setModal("NOTE")} className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]"><StickyNote size={14} /></button>
      </div>

      {modal === "PAID" && <PaidModal item={item} onClose={() => setModal(null)} />}
      {modal === "EDIT" && <EditModal item={item} onClose={() => setModal(null)} />}
      {modal === "NOTE" && <NoteModal item={item} onClose={() => setModal(null)} />}
    </div>
  );
}

function useCloseOnSuccess(state: { success?: string } | null, onClose: () => void) {
  useEffect(() => {
    if (state?.success) onClose();
  }, [state, onClose]);
}

function PaidModal({ item, onClose }: { item: PaymentListItem; onClose: () => void }) {
  const [state, formAction, pending] = useActionState(markPaymentPaid, null);
  useCloseOnSuccess(state, onClose);
  return (
    <Modal title={`Mark Paid — ${item.customerName}`} onClose={onClose}>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="paymentId" value={item.id} />
        {state?.error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
        <div>
          <label className="label">Amount Received</label>
          <input name="amountPaid" type="number" step="0.01" required defaultValue={item.amount} className="input" autoFocus />
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

function EditModal({ item, onClose }: { item: PaymentListItem; onClose: () => void }) {
  const [state, formAction, pending] = useActionState(updatePayment, null);
  useCloseOnSuccess(state, onClose);
  const dueStr = new Date(item.dueDate).toISOString().slice(0, 10);
  return (
    <Modal title={`Edit Payment — ${item.customerName}`} onClose={onClose}>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="paymentId" value={item.id} />
        {state?.error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Amount</label><input name="amount" type="number" step="0.01" required defaultValue={item.amount} className="input" /></div>
          <div><label className="label">Due Date</label><input name="dueDate" type="date" required defaultValue={dueStr} className="input" /></div>
        </div>
        <div><label className="label">Notes</label><textarea name="notes" rows={2} defaultValue={item.notes ?? ""} className="input" /></div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button type="submit" disabled={pending} className="btn btn-primary">{pending ? "Saving…" : "Save"}</button>
        </div>
      </form>
    </Modal>
  );
}

function NoteModal({ item, onClose }: { item: PaymentListItem; onClose: () => void }) {
  const [state, formAction, pending] = useActionState(addPaymentNote, null);
  useCloseOnSuccess(state, onClose);
  return (
    <Modal title={`Add Note — ${item.customerName}`} onClose={onClose}>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="paymentId" value={item.id} />
        {state?.error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
        <textarea name="notes" required rows={3} defaultValue={item.notes ?? ""} className="input" autoFocus />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button type="submit" disabled={pending} className="btn btn-primary">{pending ? "Saving…" : "Save Note"}</button>
        </div>
      </form>
    </Modal>
  );
}
