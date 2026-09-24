"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Eye, Pencil, RotateCcw, Trash2, XCircle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { updateAppointment, rescheduleAppointment, updateAppointmentStatus, deleteAppointment, type AppointmentActionState } from "@/lib/actions/appointments";
import { formatDate, formatTime12h } from "@/lib/format";
import { APPOINTMENT_TYPES, APPOINTMENT_STATUSES, FOLLOWUP_REMINDER_OPTIONS, optionLabel } from "@/lib/constants";

export type EditableAppointment = {
  id: string;
  customerId: string;
  customerName: string;
  vehicleId: string | null;
  salespersonId: string | null;
  date: Date;
  time: string;
  endTime: string | null;
  location: string | null;
  type: string;
  notes: string | null;
  status: string;
  reminderOffsetMinutes: number | null;
};

type PersonOption = { id: string; firstName: string; lastName: string };
type VehicleOption = { id: string; year: number; make: string; model: string; stockNumber: string };

function useCloseOnSuccess(state: { success?: string } | null | undefined, onClose: () => void) {
  useEffect(() => {
    if (state?.success) onClose();
  }, [state, onClose]);
}

function ErrorBox({ state, onOverride }: { state: AppointmentActionState; onOverride: () => void }) {
  if (!state?.error) return null;
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      <p>{state.error.replace(/^CONFLICT:\s*/, "")}</p>
      {state.conflict && (
        <button type="button" onClick={onOverride} className="btn btn-sm mt-2 bg-red-600 text-white hover:bg-red-700">
          Schedule anyway
        </button>
      )}
    </div>
  );
}

/** Renders the View / Edit / Reschedule / Cancel controls for a single
 * appointment. Used from the Calendar day/list views and the customer
 * profile's Appointments section — the same component so both stay
 * consistent and both write through the same in-place update, keeping the
 * calendar, customer profile, and any reminder in sync automatically. */
export function AppointmentActionButtons({
  appointment,
  customers,
  vehicles,
  teamUsers,
  compact = false,
}: {
  appointment: EditableAppointment;
  customers: PersonOption[];
  vehicles: VehicleOption[];
  teamUsers: PersonOption[];
  compact?: boolean;
}) {
  const [modal, setModal] = useState<"view" | "edit" | "reschedule" | null>(null);
  const [cancelling, startCancel] = useTransition();
  const [deleting, startDelete] = useTransition();
  const btnClass = compact ? "btn btn-secondary btn-sm !px-1.5" : "btn btn-secondary btn-sm";

  return (
    <div className="flex shrink-0 items-center gap-1">
      <button type="button" title="View" className={btnClass} onClick={() => setModal("view")}>
        <Eye size={13} />
      </button>
      <button type="button" title="Edit" className={btnClass} onClick={() => setModal("edit")}>
        <Pencil size={13} />
      </button>
      <button type="button" title="Reschedule" className={btnClass} onClick={() => setModal("reschedule")}>
        <RotateCcw size={13} />
      </button>
      {appointment.status !== "CANCELLED" && (
        <button
          type="button"
          title="Cancel"
          disabled={cancelling}
          className={`${btnClass} text-red-600`}
          onClick={() => {
            if (confirm("Cancel this appointment?")) startCancel(() => updateAppointmentStatus(appointment.id, "CANCELLED"));
          }}
        >
          <XCircle size={13} />
        </button>
      )}
      <button
        type="button"
        title="Delete"
        disabled={deleting}
        className={`${btnClass} text-red-600`}
        onClick={() => {
          if (confirm("Delete this appointment? This can't be undone.")) startDelete(() => deleteAppointment(appointment.id));
        }}
      >
        <Trash2 size={13} />
      </button>

      {modal === "view" && <ViewModal appointment={appointment} onClose={() => setModal(null)} />}
      {modal === "edit" && (
        <EditModal appointment={appointment} customers={customers} vehicles={vehicles} teamUsers={teamUsers} onClose={() => setModal(null)} />
      )}
      {modal === "reschedule" && <RescheduleModal appointment={appointment} onClose={() => setModal(null)} />}
    </div>
  );
}

function ViewModal({ appointment, onClose }: { appointment: EditableAppointment; onClose: () => void }) {
  return (
    <Modal title="Appointment Details" onClose={onClose}>
      <dl className="grid grid-cols-2 gap-4 text-[13px]">
        <Field label="Customer" value={appointment.customerName} />
        <Field label="Type" value={optionLabel(APPOINTMENT_TYPES, appointment.type)} />
        <Field label="Date" value={formatDate(appointment.date)} />
        <Field label="Time" value={`${formatTime12h(appointment.time)}${appointment.endTime ? `–${formatTime12h(appointment.endTime)}` : ""}`} />
        <Field label="Location" value={appointment.location ?? "—"} />
        <Field label="Status" value={optionLabel(APPOINTMENT_STATUSES, appointment.status)} />
        <Field label="Notes" value={appointment.notes ?? "—"} full />
      </dl>
      <div className="mt-4 flex justify-end">
        <button className="btn btn-ghost" onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}

function Field({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : undefined}>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-faint)]">{label}</dt>
      <dd className="mt-0.5 text-[var(--text)]">{value}</dd>
    </div>
  );
}

function EditModal({
  appointment,
  customers,
  vehicles,
  teamUsers,
  onClose,
}: {
  appointment: EditableAppointment;
  customers: PersonOption[];
  vehicles: VehicleOption[];
  teamUsers: PersonOption[];
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(updateAppointment, null);
  useCloseOnSuccess(state, onClose);
  const formRef = useRef<HTMLFormElement>(null);
  const overrideRef = useRef<HTMLInputElement>(null);
  const [reminder, setReminder] = useState(appointment.reminderOffsetMinutes === null ? "NONE" : String(appointment.reminderOffsetMinutes));
  const isCustomReminder = reminder === "CUSTOM";
  const dateStr = new Date(appointment.date).toISOString().slice(0, 10);

  return (
    <Modal title="Edit Appointment" onClose={onClose} width="max-w-lg">
      <form ref={formRef} action={formAction} className="space-y-4">
        <input type="hidden" name="appointmentId" value={appointment.id} />
        <input type="hidden" name="confirmOverride" defaultValue="false" ref={overrideRef} />
        <ErrorBox
          state={state}
          onOverride={() => {
            if (overrideRef.current) overrideRef.current.value = "true";
            formRef.current?.requestSubmit();
          }}
        />
        <div>
          <label className="label">Customer</label>
          <select name="customerId" required defaultValue={appointment.customerId} className="input">
            {customers.map((c) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Vehicle of Interest</label>
          <select name="vehicleId" defaultValue={appointment.vehicleId ?? ""} className="input">
            <option value="">— None —</option>
            {vehicles.map((v) => <option key={v.id} value={v.id}>{v.year} {v.make} {v.model} (#{v.stockNumber})</option>)}
          </select>
        </div>
        <div>
          <label className="label">Type</label>
          <select name="type" defaultValue={appointment.type} className="input">
            {APPOINTMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Assigned Salesperson</label>
          <select name="salespersonId" defaultValue={appointment.salespersonId ?? ""} className="input">
            {teamUsers.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Date</label><input type="date" name="date" required defaultValue={dateStr} className="input" /></div>
          <div><label className="label">Start Time</label><input type="time" name="time" required defaultValue={appointment.time} className="input" /></div>
        </div>
        <div><label className="label">End Time (optional)</label><input type="time" name="endTime" defaultValue={appointment.endTime ?? ""} className="input" /></div>
        <div><label className="label">Location (optional)</label><input name="location" defaultValue={appointment.location ?? ""} className="input" placeholder="e.g. Showroom, customer's home, phone" /></div>
        <div><label className="label">Notes</label><textarea name="notes" rows={3} defaultValue={appointment.notes ?? ""} className="input" /></div>
        <div>
          <label className="label">Reminder</label>
          <select name={isCustomReminder ? undefined : "reminderOffsetMinutes"} className="input" value={reminder} onChange={(e) => setReminder(e.target.value)}>
            {FOLLOWUP_REMINDER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {isCustomReminder && (
            <input name="reminderOffsetMinutes" type="number" min={0} required placeholder="Minutes before" className="input mt-2" />
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button type="submit" disabled={pending} className="btn btn-primary">{pending ? "Saving…" : "Save Changes"}</button>
        </div>
      </form>
    </Modal>
  );
}

function RescheduleModal({ appointment, onClose }: { appointment: EditableAppointment; onClose: () => void }) {
  const [state, formAction, pending] = useActionState(rescheduleAppointment, null);
  useCloseOnSuccess(state, onClose);
  const formRef = useRef<HTMLFormElement>(null);
  const overrideRef = useRef<HTMLInputElement>(null);
  const dateStr = new Date(appointment.date).toISOString().slice(0, 10);

  return (
    <Modal title="Reschedule Appointment" onClose={onClose}>
      <form ref={formRef} action={formAction} className="space-y-4">
        <input type="hidden" name="appointmentId" value={appointment.id} />
        <input type="hidden" name="confirmOverride" defaultValue="false" ref={overrideRef} />
        <ErrorBox
          state={state}
          onOverride={() => {
            if (overrideRef.current) overrideRef.current.value = "true";
            formRef.current?.requestSubmit();
          }}
        />
        <p className="text-[13px] text-[var(--text-muted)]">
          {appointment.customerName} · Currently {formatDate(appointment.date)} at {formatTime12h(appointment.time)}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">New Date</label><input type="date" name="date" required defaultValue={dateStr} className="input" /></div>
          <div><label className="label">New Time</label><input type="time" name="time" required defaultValue={appointment.time} className="input" /></div>
        </div>
        <div><label className="label">New End Time (optional)</label><input type="time" name="endTime" defaultValue={appointment.endTime ?? ""} className="input" /></div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button type="submit" disabled={pending} className="btn btn-primary">{pending ? "Saving…" : "Reschedule"}</button>
        </div>
      </form>
    </Modal>
  );
}
