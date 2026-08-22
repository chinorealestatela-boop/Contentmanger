"use client";

import { useActionState, useState, useTransition } from "react";
import { CheckCircle2, RotateCcw, XCircle, Clock } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { completeFollowUp, rescheduleFollowUp, cancelFollowUp } from "@/lib/actions/followups";
import { formatDate, formatTime12h } from "@/lib/format";
import { FOLLOWUP_STATUSES, TASK_PRIORITIES, optionLabel, optionColor } from "@/lib/constants";
import { EmptyRow } from "@/components/ui/SectionCard";

type FollowUp = {
  id: string;
  topic: string;
  notes: string | null;
  followUpDate: Date;
  followUpTime: string;
  priority: string;
  status: string;
  completionNotes: string | null;
  assignee: { firstName: string; lastName: string };
};

function displayStatus(f: FollowUp) {
  if (f.status === "SCHEDULED") {
    const today = new Date();
    const d = new Date(f.followUpDate);
    if (d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate()) {
      return { label: "Due Today", color: "#ea580c" };
    }
  }
  return { label: optionLabel(FOLLOWUP_STATUSES, f.status), color: optionColor(FOLLOWUP_STATUSES, f.status) };
}

export function FollowUpsSection({ followUps }: { followUps: FollowUp[] }) {
  const [action, setAction] = useState<{ kind: "complete" | "reschedule"; followUp: FollowUp } | null>(null);
  const [cancelling, startCancel] = useTransition();

  if (followUps.length === 0) return <EmptyRow>No follow-ups scheduled. Use the Follow Up button above to plan your next call.</EmptyRow>;

  return (
    <>
      <ul className="space-y-2">
        {followUps.map((f) => {
          const status = displayStatus(f);
          const priority = TASK_PRIORITIES.find((p) => p.value === f.priority);
          return (
            <li key={f.id} className="rounded-lg border border-[var(--border)] px-3.5 py-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-[var(--text)]">{f.topic}</p>
                  <p className="mt-0.5 text-[11.5px] text-[var(--text-faint)]">
                    {formatDate(f.followUpDate)} at {formatTime12h(f.followUpTime)} · {f.assignee.firstName} {f.assignee.lastName}
                    {priority && priority.value !== "NORMAL" && <> · <span style={{ color: priority.color }}>{priority.label}</span></>}
                  </p>
                  {f.notes && <p className="mt-1.5 text-[12.5px] text-[var(--text-muted)]">{f.notes}</p>}
                  {f.status === "COMPLETED" && f.completionNotes && (
                    <p className="mt-1.5 rounded-md bg-emerald-50 px-2.5 py-1.5 text-[12px] text-emerald-800">{f.completionNotes}</p>
                  )}
                </div>
                <span className="badge shrink-0" style={{ background: `${status.color}1a`, color: status.color }}>{status.label}</span>
              </div>
              {f.status === "SCHEDULED" && (
                <div className="mt-2.5 flex gap-1.5">
                  <button className="btn btn-secondary btn-sm" onClick={() => setAction({ kind: "complete", followUp: f })}>
                    <CheckCircle2 size={13} /> Complete
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setAction({ kind: "reschedule", followUp: f })}>
                    <RotateCcw size={13} /> Reschedule
                  </button>
                  <button
                    className="btn btn-secondary btn-sm text-red-600"
                    disabled={cancelling}
                    onClick={() => {
                      if (confirm("Cancel this follow-up?")) startCancel(() => cancelFollowUp(f.id));
                    }}
                  >
                    <XCircle size={13} /> Cancel
                  </button>
                </div>
              )}
              {f.status === "MISSED" && (
                <div className="mt-2.5 flex items-center gap-1.5 text-[11.5px] text-red-600">
                  <Clock size={13} /> This follow-up passed without being completed.
                  <button className="btn btn-secondary btn-sm ml-auto" onClick={() => setAction({ kind: "reschedule", followUp: f })}>
                    <RotateCcw size={13} /> Reschedule
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {action?.kind === "complete" && <CompleteModal followUp={action.followUp} onClose={() => setAction(null)} />}
      {action?.kind === "reschedule" && <RescheduleModal followUp={action.followUp} onClose={() => setAction(null)} />}
    </>
  );
}

function CompleteModal({ followUp, onClose }: { followUp: FollowUp; onClose: () => void }) {
  const [state, formAction, pending] = useActionState(completeFollowUp, null);
  if (state?.success) onClose();
  return (
    <Modal title="Complete Follow-Up" onClose={onClose}>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="followUpId" value={followUp.id} />
        {state?.error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</div>}
        <p className="text-[13px] text-[var(--text-muted)]">{followUp.topic}</p>
        <div>
          <label className="label">What happened on the call?</label>
          <textarea name="completionNotes" rows={4} required className="input" placeholder="e.g. Spoke with customer, they want to bring their spouse in this weekend to test drive." autoFocus />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button type="submit" disabled={pending} className="btn btn-primary">{pending ? "Saving…" : "Mark Completed"}</button>
        </div>
      </form>
    </Modal>
  );
}

function RescheduleModal({ followUp, onClose }: { followUp: FollowUp; onClose: () => void }) {
  const [state, formAction, pending] = useActionState(rescheduleFollowUp, null);
  if (state?.success) onClose();
  const d = new Date(followUp.followUpDate);
  d.setDate(d.getDate() + 1);
  const nextDayStr = d.toISOString().slice(0, 10);
  return (
    <Modal title="Reschedule Follow-Up" onClose={onClose}>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="followUpId" value={followUp.id} />
        {state?.error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</div>}
        <p className="text-[13px] text-[var(--text-muted)]">{followUp.topic}</p>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">New Date</label><input type="date" name="followUpDate" required className="input" defaultValue={nextDayStr} /></div>
          <div><label className="label">New Time</label><input type="time" name="followUpTime" required className="input" defaultValue={followUp.followUpTime} /></div>
        </div>
        <div><label className="label">Reason (optional)</label><input name="reason" className="input" placeholder="e.g. Customer asked to call back tomorrow" /></div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button type="submit" disabled={pending} className="btn btn-primary">{pending ? "Saving…" : "Reschedule"}</button>
        </div>
      </form>
    </Modal>
  );
}
