"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { CheckCircle2, Plus, Wrench } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Field, SelectField, TextField, ErrorBox } from "@/components/ui/Form";
import { createMaintenanceRecord, completeMaintenanceRecord } from "@/lib/actions/vehicles";
import { MAINTENANCE_TYPES, MAINTENANCE_STATUSES } from "@/lib/constants";
import { StatusBadge } from "@/components/ui/Badge";
import { formatCurrency, formatDate } from "@/lib/format";

type Record_ = {
  id: string;
  type: string;
  description: string;
  status: string;
  scheduledDate: Date | null;
  completedDate: Date | null;
  cost: number | null;
  vendor: string | null;
};

export function MaintenanceSection({ vehicleId, records }: { vehicleId: string; records: Record_[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <button onClick={() => setOpen(true)} className="btn btn-secondary btn-sm"><Plus size={13} /> Schedule Maintenance</button>
      </div>
      {records.length === 0 && <p className="py-4 text-center text-[13px] text-[var(--text-faint)]">No maintenance history yet.</p>}
      <ul className="space-y-2">
        {records.map((r) => (
          <MaintenanceRow key={r.id} record={r} />
        ))}
      </ul>
      {open && <NewMaintenanceModal vehicleId={vehicleId} onClose={() => setOpen(false)} />}
    </div>
  );
}

function MaintenanceRow({ record }: { record: Record_ }) {
  const [pending, startTransition] = useTransition();
  return (
    <li className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3.5 py-2.5">
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--text)]">
          <Wrench size={12} className="text-[var(--text-faint)]" /> {record.description}
        </p>
        <p className="text-[11.5px] text-[var(--text-faint)]">
          {record.status === "COMPLETED" && record.completedDate ? `Completed ${formatDate(record.completedDate)}` : record.scheduledDate ? `Scheduled ${formatDate(record.scheduledDate)}` : "No date set"}
          {record.vendor ? ` · ${record.vendor}` : ""}
          {record.cost ? ` · ${formatCurrency(record.cost)}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <StatusBadge options={MAINTENANCE_STATUSES} value={record.status} />
        {record.status !== "COMPLETED" && (
          <button disabled={pending} onClick={() => startTransition(() => completeMaintenanceRecord(record.id))} className="btn btn-secondary btn-sm !p-1.5" title="Mark complete">
            <CheckCircle2 size={13} />
          </button>
        )}
      </div>
    </li>
  );
}

function NewMaintenanceModal({ vehicleId, onClose }: { vehicleId: string; onClose: () => void }) {
  const [state, formAction, pending] = useActionState(createMaintenanceRecord, null);
  useEffect(() => {
    if (state?.success) onClose();
  }, [state, onClose]);
  return (
    <Modal title="Schedule Maintenance" onClose={onClose}>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="vehicleId" value={vehicleId} />
        {state?.error && <ErrorBox>{state.error}</ErrorBox>}
        <SelectField label="Type" name="type" options={MAINTENANCE_TYPES} defaultValue="SERVICE" />
        <TextField label="Description" name="description" rows={2} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Scheduled Date" name="scheduledDate" type="date" />
          <Field label="Estimated Cost" name="cost" type="number" />
        </div>
        <Field label="Vendor" name="vendor" />
        <TextField label="Notes" name="notes" rows={2} />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button type="submit" disabled={pending} className="btn btn-primary">{pending ? "Saving…" : "Schedule"}</button>
        </div>
      </form>
    </Modal>
  );
}
