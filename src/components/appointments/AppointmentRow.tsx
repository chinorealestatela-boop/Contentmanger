"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { AppointmentStatusControl } from "@/components/appointments/AppointmentStatusControl";
import { updateAppointment, deleteAppointment } from "@/lib/actions/appointments";
import { formatDate, formatTime12h } from "@/lib/format";
import { APPOINTMENT_TYPES, FOLLOWUP_REMINDER_OPTIONS } from "@/lib/constants";

type AppointmentData = {
  id: string;
  customerId: string;
  type: string;
  status: string;
  date: Date;
  time: string;
  endTime: string | null;
  location: string | null;
  notes: string | null;
  reminderOffsetMinutes: number | null;
  vehicle: { year: number; make: string; model: string } | null;
  salesperson: { firstName: string; lastName: string };
};

export function AppointmentRow({ appointment }: { appointment: AppointmentData }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <li className="rounded-lg border border-[var(--border)] px-3.5 py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-[var(--text)]">
            {appointment.type.replace(/_/g, " ")}{appointment.vehicle ? ` · ${appointment.vehicle.year} ${appointment.vehicle.make} ${appointment.vehicle.model}` : ""}
          </p>
          <p className="text-[11.5px] text-[var(--text-faint)]">
            {formatDate(appointment.date)} at {formatTime12h(appointment.time)}{appointment.endTime ? `–${formatTime12h(appointment.endTime)}` : ""}
            {appointment.location ? ` · ${appointment.location}` : ""} · {appointment.salesperson.firstName} {appointment.salesperson.lastName}
          </p>
          {appointment.notes && <p className="mt-1 text-[12px] text-[var(--text-muted)]">{appointment.notes}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <AppointmentStatusControl appointmentId={appointment.id} status={appointment.status} />
          <button className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]" title="Edit / Reschedule" onClick={() => setEditing(true)}>
            <Pencil size={14} />
          </button>
          <button
            disabled={pending}
            className="rounded-lg p-1.5 text-red-600 hover:bg-red-50"
            title="Delete"
            onClick={() => {
              if (confirm("Delete this appointment? This can't be undone.")) startTransition(() => deleteAppointment(appointment.id));
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {editing && <EditAppointmentModal appointment={appointment} onClose={() => setEditing(false)} />}
    </li>
  );
}

function EditAppointmentModal({ appointment, onClose }: { appointment: AppointmentData; onClose: () => void }) {
  const [state, formAction, pending] = useActionState(updateAppointment, null);
  const [reminder, setReminder] = useState(appointment.reminderOffsetMinutes === null ? "NONE" : String(appointment.reminderOffsetMinutes));
  const isCustomReminder = !FOLLOWUP_REMINDER_OPTIONS.some((o) => o.value === reminder) || reminder === "CUSTOM";
  useEffect(() => {
    if (state?.success) onClose();
  }, [state, onClose]);

  return (
    <Modal title="Edit / Reschedule Appointment" onClose={onClose}>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="appointmentId" value={appointment.id} />
        {state?.error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</div>}
        <div>
          <label className="label">Type</label>
          <select name="type" className="input" defaultValue={appointment.type}>{APPOINTMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Date</label><input type="date" name="date" required className="input" defaultValue={new Date(appointment.date).toISOString().slice(0, 10)} /></div>
          <div><label className="label">Start Time</label><input type="time" name="time" required className="input" defaultValue={appointment.time} /></div>
        </div>
        <div><label className="label">End Time (optional)</label><input type="time" name="endTime" className="input" defaultValue={appointment.endTime ?? ""} /></div>
        <div><label className="label">Location (optional)</label><input name="location" className="input" defaultValue={appointment.location ?? ""} /></div>
        <div><label className="label">Notes</label><textarea name="notes" rows={2} className="input" defaultValue={appointment.notes ?? ""} /></div>
        <div>
          <label className="label">Reminder</label>
          <select name={isCustomReminder ? undefined : "reminderOffsetMinutes"} className="input" value={isCustomReminder ? "CUSTOM" : reminder} onChange={(e) => setReminder(e.target.value)}>
            {FOLLOWUP_REMINDER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {isCustomReminder && <input name="reminderOffsetMinutes" type="number" min={0} required defaultValue={appointment.reminderOffsetMinutes ?? undefined} placeholder="Minutes before" className="input mt-2" />}
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button type="submit" disabled={pending} className="btn btn-primary">{pending ? "Saving…" : "Save Changes"}</button>
        </div>
      </form>
    </Modal>
  );
}
