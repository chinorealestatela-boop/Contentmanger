"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Star, Sparkles, FileText, CalendarCheck, XOctagon, RefreshCcw } from "lucide-react";
import { changeLeadStage, toggleLeadVip, markLost, reactivateLead } from "@/lib/actions/leads";
import { applyAiExtraction } from "@/lib/actions/leads";
import { Modal } from "@/components/ui/Modal";
import { ErrorBox } from "@/components/ui/Form";

export function LeadStageSelect({ leadId, stageId, stages }: { leadId: string; stageId: string; stages: { id: string; name: string }[] }) {
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(stageId);
  return (
    <select
      className="input !w-auto"
      value={value}
      disabled={pending}
      onChange={(e) => {
        setValue(e.target.value);
        startTransition(() => changeLeadStage(leadId, e.target.value));
      }}
    >
      {stages.map((s) => (
        <option key={s.id} value={s.id}>{s.name}</option>
      ))}
    </select>
  );
}

export function VipToggleButton({ leadId, isVip }: { leadId: string; isVip: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => startTransition(() => toggleLeadVip(leadId))}
      className={`btn btn-sm ${isVip ? "btn-primary" : "btn-secondary"}`}
    >
      <Star size={13} fill={isVip ? "currentColor" : "none"} /> {isVip ? "VIP Flagged" : "Flag VIP"}
    </button>
  );
}

export function ParseWithAiButton({ leadId, hasRawInquiry }: { leadId: string; hasRawInquiry: boolean }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  if (!hasRawInquiry) return null;
  return (
    <button
      disabled={pending}
      onClick={() => startTransition(async () => { await applyAiExtraction(leadId); router.refresh(); })}
      className="btn btn-secondary btn-sm !border-[var(--brand-line)] !text-[var(--brand-bright)]"
    >
      <Sparkles size={13} /> {pending ? "Parsing…" : "Parse With AI"}
    </button>
  );
}

export function LeadHeaderActions({ leadId, customerId, status, lostReasons }: { leadId: string; customerId: string; status: string; lostReasons: { id: string; name: string }[] }) {
  const [lostOpen, setLostOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={`/quotes/new?leadId=${leadId}&customerId=${customerId}`} className="btn btn-secondary btn-sm"><FileText size={13} /> Create Quote</Link>
      <Link href={`/bookings/new?leadId=${leadId}&customerId=${customerId}`} className="btn btn-primary btn-sm"><CalendarCheck size={13} /> Create Booking</Link>
      {status === "ACTIVE" && (
        <button onClick={() => setLostOpen(true)} className="btn btn-secondary btn-sm !text-[var(--danger)]"><XOctagon size={13} /> Mark Lost</button>
      )}
      {status === "LOST" && (
        <button disabled={pending} onClick={() => startTransition(() => reactivateLead(leadId))} className="btn btn-secondary btn-sm">
          <RefreshCcw size={13} /> Reactivate
        </button>
      )}
      {lostOpen && <MarkLostModal leadId={leadId} reasons={lostReasons} onClose={() => setLostOpen(false)} />}
    </div>
  );
}

function MarkLostModal({ leadId, reasons, onClose }: { leadId: string; reasons: { id: string; name: string }[]; onClose: () => void }) {
  const [state, formAction, pending] = useActionState(markLost, null);

  useEffect(() => {
    if (state?.success) onClose();
  }, [state, onClose]);

  return (
    <Modal title="Mark Lead Lost" onClose={onClose}>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="leadId" value={leadId} />
        {state?.error && <ErrorBox>{state.error}</ErrorBox>}
        <div>
          <label className="label">Reason</label>
          <select name="lostReasonId" required className="input">
            <option value="">Select a reason…</option>
            {reasons.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea name="lostNotes" rows={3} className="input" />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button type="submit" disabled={pending} className="btn btn-danger">{pending ? "Saving…" : "Mark Lost"}</button>
        </div>
      </form>
    </Modal>
  );
}
