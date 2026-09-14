"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Phone, MessageSquare, Mail, StickyNote, CheckSquare, CalendarPlus, PhoneCall, Check } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { logCommunication } from "@/lib/actions/communications";
import { addNote } from "@/lib/actions/notes";
import { createTask } from "@/lib/actions/tasks";
import { createFollowUp } from "@/lib/actions/followups";
import { completeTask } from "@/lib/actions/tasks";
import { TASK_TYPES, TASK_PRIORITIES, FOLLOWUP_REMINDER_OPTIONS } from "@/lib/constants";

type ModalKind = "CALL" | "TEXT" | "EMAIL" | "NOTE" | "TASK" | "FOLLOWUP" | null;

export function QuickActions({
  customerId,
  leadId,
  taskId,
  size = "md",
  className,
}: {
  customerId: string;
  leadId?: string | null;
  taskId?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const [modal, setModal] = useState<ModalKind>(null);
  const [pending, startTransition] = useTransition();
  const [completed, setCompleted] = useState(false);

  const btnClass = size === "sm" ? "btn btn-secondary btn-sm !px-2" : "btn btn-secondary btn-sm";

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className ?? ""}`}>
      <button className={`${btnClass} !border-[var(--brand-line)] !bg-[var(--brand-soft)] !text-[var(--brand-bright)]`} onClick={() => setModal("FOLLOWUP")} title="Follow Up"><PhoneCall size={13} /> {size === "md" && "Follow Up"}</button>
      <button className={btnClass} onClick={() => setModal("CALL")} title="Call"><Phone size={13} /> {size === "md" && "Call"}</button>
      <button className={btnClass} onClick={() => setModal("TEXT")} title="Text"><MessageSquare size={13} /> {size === "md" && "Text"}</button>
      <button className={btnClass} onClick={() => setModal("EMAIL")} title="Email"><Mail size={13} /> {size === "md" && "Email"}</button>
      <button className={btnClass} onClick={() => setModal("NOTE")} title="Note"><StickyNote size={13} /> {size === "md" && "Note"}</button>
      <button className={btnClass} onClick={() => setModal("TASK")} title="Task"><CheckSquare size={13} /> {size === "md" && "Task"}</button>
      <Link href={`/bookings/new?customerId=${customerId}${leadId ? `&leadId=${leadId}` : ""}`} className={btnClass} title="New Booking"><CalendarPlus size={13} /> {size === "md" && "Book"}</Link>
      {taskId && (
        <button
          disabled={pending || completed}
          className="btn btn-primary btn-sm"
          onClick={() => startTransition(async () => { await completeTask(taskId); setCompleted(true); })}
        >
          <Check size={13} /> {completed ? "Done" : "Complete"}
        </button>
      )}

      {modal === "FOLLOWUP" && <FollowUpModal customerId={customerId} leadId={leadId} onClose={() => setModal(null)} />}
      {(modal === "CALL" || modal === "TEXT" || modal === "EMAIL") && (
        <CommunicationModal type={modal} customerId={customerId} onClose={() => setModal(null)} />
      )}
      {modal === "NOTE" && <NoteModal customerId={customerId} leadId={leadId} onClose={() => setModal(null)} />}
      {modal === "TASK" && <TaskModal customerId={customerId} leadId={leadId} onClose={() => setModal(null)} />}
    </div>
  );
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-[var(--danger)]/40 bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">{children}</div>;
}

function FollowUpModal({ customerId, leadId, onClose }: { customerId: string; leadId?: string | null; onClose: () => void }) {
  const [state, formAction, pending] = useActionState(createFollowUp, null);
  const [reminder, setReminder] = useState("0");
  const isCustomReminder = reminder === "CUSTOM";
  useEffect(() => {
    if (state?.success) onClose();
  }, [state, onClose]);
  const todayStr = new Date().toISOString().slice(0, 10);
  return (
    <Modal title="Schedule Follow-Up" onClose={onClose}>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="customerId" value={customerId} />
        {leadId && <input type="hidden" name="leadId" value={leadId} />}
        {state?.error && <ErrorBox>{state.error}</ErrorBox>}
        <div>
          <label className="label">Conversation Topic / Reason</label>
          <input name="topic" required className="input" placeholder="e.g. Confirm pickup time for Friday reservation" autoFocus />
        </div>
        <div>
          <label className="label">Detailed Follow-Up Notes</label>
          <textarea name="notes" rows={3} className="input" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Date</label><input type="date" name="followUpDate" required className="input" defaultValue={todayStr} /></div>
          <div><label className="label">Time</label><input type="time" name="followUpTime" required className="input" defaultValue="10:00" /></div>
        </div>
        <div>
          <label className="label">Priority</label>
          <select name="priority" className="input" defaultValue="NORMAL">{TASK_PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select>
        </div>
        <div>
          <label className="label">Reminder</label>
          <select name={isCustomReminder ? undefined : "reminderOffsetMinutes"} className="input" value={reminder} onChange={(e) => setReminder(e.target.value)}>
            {FOLLOWUP_REMINDER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {isCustomReminder && <input name="reminderOffsetMinutes" type="number" min={0} required placeholder="Minutes before" className="input mt-2" />}
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button type="submit" disabled={pending} className="btn btn-primary">{pending ? "Saving…" : "Schedule Follow-Up"}</button>
        </div>
      </form>
    </Modal>
  );
}

function CommunicationModal({ type, customerId, onClose }: { type: "CALL" | "TEXT" | "EMAIL"; customerId: string; onClose: () => void }) {
  const [state, formAction, pending] = useActionState(logCommunication, null);
  const label = type === "CALL" ? "Log a Call" : type === "TEXT" ? "Log a Text" : "Log an Email";

  useEffect(() => {
    if (state?.success) onClose();
  }, [state, onClose]);

  return (
    <Modal title={label} onClose={onClose}>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="customerId" value={customerId} />
        <input type="hidden" name="type" value={type} />
        {state?.error && <ErrorBox>{state.error}</ErrorBox>}
        <div>
          <label className="label">Direction</label>
          <select name="direction" className="input" defaultValue="OUTBOUND">
            <option value="OUTBOUND">Outbound (you contacted them)</option>
            <option value="INBOUND">Inbound (they contacted you)</option>
          </select>
        </div>
        <div>
          <label className="label">Summary</label>
          <textarea name="summary" required rows={3} className="input" placeholder="What was discussed?" />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button type="submit" disabled={pending} className="btn btn-primary">{pending ? "Saving…" : "Log It"}</button>
        </div>
      </form>
    </Modal>
  );
}

function NoteModal({ customerId, leadId, onClose }: { customerId: string; leadId?: string | null; onClose: () => void }) {
  const [state, formAction, pending] = useActionState(addNote, null);
  useEffect(() => {
    if (state?.success) onClose();
  }, [state, onClose]);
  return (
    <Modal title="Add Note" onClose={onClose}>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="customerId" value={customerId} />
        {leadId && <input type="hidden" name="leadId" value={leadId} />}
        {state?.error && <ErrorBox>{state.error}</ErrorBox>}
        <textarea name="body" required rows={4} className="input" placeholder="Add notes, preferences, special requests…" autoFocus />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button type="submit" disabled={pending} className="btn btn-primary">{pending ? "Saving…" : "Save Note"}</button>
        </div>
      </form>
    </Modal>
  );
}

function TaskModal({ customerId, leadId, onClose }: { customerId: string; leadId?: string | null; onClose: () => void }) {
  const [state, formAction, pending] = useActionState(createTask, null);
  useEffect(() => {
    if (state?.success) onClose();
  }, [state, onClose]);
  const todayStr = new Date().toISOString().slice(0, 10);
  return (
    <Modal title="Create Task" onClose={onClose}>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="customerId" value={customerId} />
        {leadId && <input type="hidden" name="leadId" value={leadId} />}
        {state?.error && <ErrorBox>{state.error}</ErrorBox>}
        <div>
          <label className="label">Title</label>
          <input name="title" required className="input" placeholder="e.g. Confirm flight details" autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Type</label>
            <select name="type" className="input" defaultValue="CALL">
              {TASK_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Priority</label>
            <select name="priority" className="input" defaultValue="NORMAL">
              {TASK_PRIORITIES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Due Date</label>
            <input type="date" name="dueDate" required className="input" defaultValue={todayStr} />
          </div>
          <div>
            <label className="label">Due Time</label>
            <input type="time" name="dueTime" className="input" />
          </div>
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea name="notes" rows={2} className="input" />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button type="submit" disabled={pending} className="btn btn-primary">{pending ? "Saving…" : "Create Task"}</button>
        </div>
      </form>
    </Modal>
  );
}
