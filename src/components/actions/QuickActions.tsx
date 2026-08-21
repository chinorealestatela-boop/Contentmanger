"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Phone, MessageSquare, Mail, StickyNote, CheckSquare, CalendarPlus, Check } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { logCommunication } from "@/lib/actions/communications";
import { addNote } from "@/lib/actions/notes";
import { createTask } from "@/lib/actions/tasks";
import { createAppointment } from "@/lib/actions/appointments";
import { completeTask } from "@/lib/actions/tasks";
import { TASK_TYPES, TASK_PRIORITIES, APPOINTMENT_TYPES } from "@/lib/constants";

type ModalKind = "CALL" | "TEXT" | "EMAIL" | "NOTE" | "TASK" | "APPOINTMENT" | null;

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
      <button className={btnClass} onClick={() => setModal("CALL")} title="Call"><Phone size={13} /> {size === "md" && "Call"}</button>
      <button className={btnClass} onClick={() => setModal("TEXT")} title="Text"><MessageSquare size={13} /> {size === "md" && "Text"}</button>
      <button className={btnClass} onClick={() => setModal("EMAIL")} title="Email"><Mail size={13} /> {size === "md" && "Email"}</button>
      <button className={btnClass} onClick={() => setModal("NOTE")} title="Note"><StickyNote size={13} /> {size === "md" && "Note"}</button>
      <button className={btnClass} onClick={() => setModal("TASK")} title="Task"><CheckSquare size={13} /> {size === "md" && "Task"}</button>
      <button className={btnClass} onClick={() => setModal("APPOINTMENT")} title="Appointment"><CalendarPlus size={13} /> {size === "md" && "Appt"}</button>
      {taskId && (
        <button
          disabled={pending || completed}
          className="btn btn-primary btn-sm"
          onClick={() => startTransition(async () => { await completeTask(taskId); setCompleted(true); })}
        >
          <Check size={13} /> {completed ? "Done" : "Complete"}
        </button>
      )}

      {(modal === "CALL" || modal === "TEXT" || modal === "EMAIL") && (
        <CommunicationModal type={modal} customerId={customerId} onClose={() => setModal(null)} />
      )}
      {modal === "NOTE" && <NoteModal customerId={customerId} leadId={leadId} onClose={() => setModal(null)} />}
      {modal === "TASK" && <TaskModal customerId={customerId} leadId={leadId} onClose={() => setModal(null)} />}
      {modal === "APPOINTMENT" && <AppointmentModal customerId={customerId} leadId={leadId} onClose={() => setModal(null)} />}
    </div>
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
        {state?.error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</div>}
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
        {state?.error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</div>}
        <textarea name="body" required rows={4} className="input" placeholder="Add sales notes, preferences, objections…" autoFocus />
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
        {state?.error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</div>}
        <div>
          <label className="label">Title</label>
          <input name="title" required className="input" placeholder="e.g. Call about financing options" autoFocus />
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

function AppointmentModal({ customerId, leadId, onClose }: { customerId: string; leadId?: string | null; onClose: () => void }) {
  const [state, formAction, pending] = useActionState(createAppointment, null);
  useEffect(() => {
    if (state?.success) onClose();
  }, [state, onClose]);
  const todayStr = new Date().toISOString().slice(0, 10);
  return (
    <Modal title="Set Appointment" onClose={onClose}>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="customerId" value={customerId} />
        {leadId && <input type="hidden" name="leadId" value={leadId} />}
        {state?.error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</div>}
        <div>
          <label className="label">Type</label>
          <select name="type" className="input" defaultValue="SHOWROOM_VISIT">
            {APPOINTMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Date</label>
            <input type="date" name="date" required className="input" defaultValue={todayStr} />
          </div>
          <div>
            <label className="label">Time</label>
            <input type="time" name="time" required className="input" defaultValue="10:00" />
          </div>
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea name="notes" rows={2} className="input" />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button type="submit" disabled={pending} className="btn btn-primary">{pending ? "Saving…" : "Schedule"}</button>
        </div>
      </form>
    </Modal>
  );
}
