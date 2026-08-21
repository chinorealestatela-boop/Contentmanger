"use client";

import { useActionState, useEffect, useState } from "react";
import { Phone, MessageSquare, Mail, StickyNote, CheckSquare, CalendarPlus, Car, ArrowLeftRight, FileEdit, Workflow, Trophy, XCircle, Gauge } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { logCommunication } from "@/lib/actions/communications";
import { addNote } from "@/lib/actions/notes";
import { createTask } from "@/lib/actions/tasks";
import { createAppointment } from "@/lib/actions/appointments";
import { logActivityManual } from "@/lib/actions/activity";
import { addVehicleInterest } from "@/lib/actions/vehicleInterests";
import { addTradeIn } from "@/lib/actions/tradeins";
import { logTestDrive } from "@/lib/actions/testdrives";
import { changeLeadStage, markSold, markLost } from "@/lib/actions/leads";
import { TASK_TYPES, TASK_PRIORITIES, APPOINTMENT_TYPES, APPRAISAL_STATUSES, FINANCE_TYPES, CUSTOMER_REACTIONS } from "@/lib/constants";

type Kind = "CALL" | "TEXT" | "EMAIL" | "NOTE" | "TASK" | "APPOINTMENT" | "VEHICLE" | "TRADE" | "TESTDRIVE" | "LOG" | "STAGE" | "SOLD" | "LOST" | null;

export function ProfileActions({
  customerId,
  leadId,
  stages,
  lostReasons,
  vehicles,
}: {
  customerId: string;
  leadId: string | null;
  stages: { id: string; name: string }[];
  lostReasons: { id: string; name: string }[];
  vehicles: { id: string; year: number; make: string; model: string; stockNumber: string }[];
}) {
  const [modal, setModal] = useState<Kind>(null);
  const btn = "btn btn-secondary btn-sm";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button className={btn} onClick={() => setModal("CALL")}><Phone size={13} /> Call</button>
      <button className={btn} onClick={() => setModal("TEXT")}><MessageSquare size={13} /> Text</button>
      <button className={btn} onClick={() => setModal("EMAIL")}><Mail size={13} /> Email</button>
      <button className={btn} onClick={() => setModal("NOTE")}><StickyNote size={13} /> Note</button>
      <button className={btn} onClick={() => setModal("TASK")}><CheckSquare size={13} /> Task</button>
      <button className={btn} onClick={() => setModal("APPOINTMENT")}><CalendarPlus size={13} /> Appointment</button>
      <button className={btn} onClick={() => setModal("VEHICLE")}><Car size={13} /> Add Vehicle</button>
      <button className={btn} onClick={() => setModal("TRADE")}><ArrowLeftRight size={13} /> Add Trade</button>
      <button className={btn} onClick={() => setModal("TESTDRIVE")}><Gauge size={13} /> Log Test Drive</button>
      <button className={btn} onClick={() => setModal("LOG")}><FileEdit size={13} /> Log Activity</button>
      {leadId && (
        <>
          <button className={btn} onClick={() => setModal("STAGE")}><Workflow size={13} /> Change Stage</button>
          <button className="btn btn-sm bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => setModal("SOLD")}><Trophy size={13} /> Mark Sold</button>
          <button className="btn btn-sm bg-slate-600 text-white hover:bg-slate-700" onClick={() => setModal("LOST")}><XCircle size={13} /> Mark Lost</button>
        </>
      )}

      {(modal === "CALL" || modal === "TEXT" || modal === "EMAIL") && <CommunicationModal type={modal} customerId={customerId} onClose={() => setModal(null)} />}
      {modal === "NOTE" && <NoteModal customerId={customerId} leadId={leadId} onClose={() => setModal(null)} />}
      {modal === "TASK" && <TaskModal customerId={customerId} leadId={leadId} onClose={() => setModal(null)} />}
      {modal === "APPOINTMENT" && <AppointmentModal customerId={customerId} leadId={leadId} vehicles={vehicles} onClose={() => setModal(null)} />}
      {modal === "VEHICLE" && <VehicleModal customerId={customerId} leadId={leadId} vehicles={vehicles} onClose={() => setModal(null)} />}
      {modal === "TRADE" && <TradeModal customerId={customerId} onClose={() => setModal(null)} />}
      {modal === "TESTDRIVE" && <TestDriveModal customerId={customerId} leadId={leadId} vehicles={vehicles} onClose={() => setModal(null)} />}
      {modal === "LOG" && <LogModal customerId={customerId} leadId={leadId} onClose={() => setModal(null)} />}
      {modal === "STAGE" && leadId && <StageModal leadId={leadId} stages={stages} onClose={() => setModal(null)} />}
      {modal === "SOLD" && leadId && <SoldModal leadId={leadId} vehicles={vehicles} onClose={() => setModal(null)} />}
      {modal === "LOST" && leadId && <LostModal leadId={leadId} lostReasons={lostReasons} onClose={() => setModal(null)} />}
    </div>
  );
}

function useCloseOnSuccess(state: { success?: string } | null, onClose: () => void) {
  useEffect(() => {
    if (state?.success) onClose();
  }, [state, onClose]);
}

function CommunicationModal({ type, customerId, onClose }: { type: "CALL" | "TEXT" | "EMAIL"; customerId: string; onClose: () => void }) {
  const [state, formAction, pending] = useActionState(logCommunication, null);
  useCloseOnSuccess(state, onClose);
  const label = type === "CALL" ? "Log a Call" : type === "TEXT" ? "Log a Text" : "Log an Email";
  return (
    <Modal title={label} onClose={onClose}>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="customerId" value={customerId} />
        <input type="hidden" name="type" value={type} />
        {state?.error && <ErrorBox msg={state.error} />}
        <div>
          <label className="label">Direction</label>
          <select name="direction" className="input" defaultValue="OUTBOUND">
            <option value="OUTBOUND">Outbound</option>
            <option value="INBOUND">Inbound</option>
          </select>
        </div>
        <div>
          <label className="label">Summary</label>
          <textarea name="summary" required rows={3} className="input" autoFocus />
        </div>
        <FormFooter pending={pending} onClose={onClose} label="Log It" />
      </form>
    </Modal>
  );
}

function NoteModal({ customerId, leadId, onClose }: { customerId: string; leadId: string | null; onClose: () => void }) {
  const [state, formAction, pending] = useActionState(addNote, null);
  useCloseOnSuccess(state, onClose);
  return (
    <Modal title="Add Note" onClose={onClose}>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="customerId" value={customerId} />
        {leadId && <input type="hidden" name="leadId" value={leadId} />}
        {state?.error && <ErrorBox msg={state.error} />}
        <textarea name="body" required rows={4} className="input" autoFocus />
        <FormFooter pending={pending} onClose={onClose} label="Save Note" />
      </form>
    </Modal>
  );
}

function TaskModal({ customerId, leadId, onClose }: { customerId: string; leadId: string | null; onClose: () => void }) {
  const [state, formAction, pending] = useActionState(createTask, null);
  useCloseOnSuccess(state, onClose);
  const todayStr = new Date().toISOString().slice(0, 10);
  return (
    <Modal title="Create Task" onClose={onClose}>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="customerId" value={customerId} />
        {leadId && <input type="hidden" name="leadId" value={leadId} />}
        {state?.error && <ErrorBox msg={state.error} />}
        <div>
          <label className="label">Title</label>
          <input name="title" required className="input" autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Type</label>
            <select name="type" className="input" defaultValue="CALL">{TASK_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
          </div>
          <div>
            <label className="label">Priority</label>
            <select name="priority" className="input" defaultValue="NORMAL">{TASK_PRIORITIES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Due Date</label><input type="date" name="dueDate" required className="input" defaultValue={todayStr} /></div>
          <div><label className="label">Due Time</label><input type="time" name="dueTime" className="input" /></div>
        </div>
        <div><label className="label">Notes</label><textarea name="notes" rows={2} className="input" /></div>
        <FormFooter pending={pending} onClose={onClose} label="Create Task" />
      </form>
    </Modal>
  );
}

function AppointmentModal({ customerId, leadId, vehicles, onClose }: { customerId: string; leadId: string | null; vehicles: { id: string; year: number; make: string; model: string; stockNumber: string }[]; onClose: () => void }) {
  const [state, formAction, pending] = useActionState(createAppointment, null);
  useCloseOnSuccess(state, onClose);
  const todayStr = new Date().toISOString().slice(0, 10);
  return (
    <Modal title="Set Appointment" onClose={onClose}>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="customerId" value={customerId} />
        {leadId && <input type="hidden" name="leadId" value={leadId} />}
        {state?.error && <ErrorBox msg={state.error} />}
        <div>
          <label className="label">Type</label>
          <select name="type" className="input" defaultValue="SHOWROOM_VISIT">{APPOINTMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
        </div>
        <div>
          <label className="label">Vehicle (optional)</label>
          <select name="vehicleId" className="input" defaultValue="">
            <option value="">— None —</option>
            {vehicles.map((v) => <option key={v.id} value={v.id}>{v.year} {v.make} {v.model} (#{v.stockNumber})</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Date</label><input type="date" name="date" required className="input" defaultValue={todayStr} /></div>
          <div><label className="label">Time</label><input type="time" name="time" required className="input" defaultValue="10:00" /></div>
        </div>
        <div><label className="label">Notes</label><textarea name="notes" rows={2} className="input" /></div>
        <FormFooter pending={pending} onClose={onClose} label="Schedule" />
      </form>
    </Modal>
  );
}

function VehicleModal({ customerId, leadId, vehicles, onClose }: { customerId: string; leadId: string | null; vehicles: { id: string; year: number; make: string; model: string; stockNumber: string }[]; onClose: () => void }) {
  const [state, formAction, pending] = useActionState(addVehicleInterest, null);
  useCloseOnSuccess(state, onClose);
  const [useInventory, setUseInventory] = useState(true);
  return (
    <Modal title="Add Vehicle of Interest" onClose={onClose}>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="customerId" value={customerId} />
        {leadId && <input type="hidden" name="leadId" value={leadId} />}
        {state?.error && <ErrorBox msg={state.error} />}
        <div className="flex gap-2 text-xs">
          <button type="button" onClick={() => setUseInventory(true)} className={`btn btn-sm ${useInventory ? "btn-primary" : "btn-secondary"}`}>From Inventory</button>
          <button type="button" onClick={() => setUseInventory(false)} className={`btn btn-sm ${!useInventory ? "btn-primary" : "btn-secondary"}`}>Custom</button>
        </div>
        {useInventory ? (
          <div>
            <label className="label">Vehicle</label>
            <select name="vehicleId" className="input">
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.year} {v.make} {v.model} (#{v.stockNumber})</option>)}
            </select>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <input name="year" placeholder="Year" className="input" />
            <input name="make" placeholder="Make" className="input" />
            <input name="model" placeholder="Model" className="input" />
            <input name="trim" placeholder="Trim" className="input" />
          </div>
        )}
        <div>
          <label className="label">Interest Level</label>
          <select name="interestLevel" className="input" defaultValue="INTERESTED">
            <option value="INTERESTED">Interested</option>
            <option value="STRONG">Strong Interest</option>
          </select>
        </div>
        <FormFooter pending={pending} onClose={onClose} label="Add Vehicle" />
      </form>
    </Modal>
  );
}

function TradeModal({ customerId, onClose }: { customerId: string; onClose: () => void }) {
  const [state, formAction, pending] = useActionState(addTradeIn, null);
  useCloseOnSuccess(state, onClose);
  return (
    <Modal title="Add Trade-In" onClose={onClose} width="max-w-lg">
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="customerId" value={customerId} />
        {state?.error && <ErrorBox msg={state.error} />}
        <div className="grid grid-cols-2 gap-3">
          <input name="year" placeholder="Year" className="input" />
          <input name="make" placeholder="Make" className="input" />
          <input name="model" placeholder="Model" className="input" />
          <input name="trim" placeholder="Trim" className="input" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input name="vin" placeholder="VIN" className="input" />
          <input name="mileage" type="number" placeholder="Mileage" className="input" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div><label className="label">Payoff</label><input name="payoff" type="number" className="input" /></div>
          <div><label className="label">Est. Value</label><input name="estimatedValue" type="number" className="input" /></div>
          <div><label className="label">Desired</label><input name="desiredValue" type="number" className="input" /></div>
        </div>
        <div>
          <label className="label">Appraisal Status</label>
          <select name="appraisalStatus" className="input" defaultValue="PENDING">{APPRAISAL_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
        </div>
        <div><label className="label">Notes</label><textarea name="notes" rows={2} className="input" /></div>
        <FormFooter pending={pending} onClose={onClose} label="Add Trade-In" />
      </form>
    </Modal>
  );
}

function TestDriveModal({ customerId, leadId, vehicles, onClose }: { customerId: string; leadId: string | null; vehicles: { id: string; year: number; make: string; model: string; stockNumber: string }[]; onClose: () => void }) {
  const [state, formAction, pending] = useActionState(logTestDrive, null);
  useCloseOnSuccess(state, onClose);
  return (
    <Modal title="Log Test Drive" onClose={onClose}>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="customerId" value={customerId} />
        {leadId && <input type="hidden" name="leadId" value={leadId} />}
        {state?.error && <ErrorBox msg={state.error} />}
        <div>
          <label className="label">Vehicle</label>
          <select name="vehicleId" required className="input">
            <option value="">Select vehicle…</option>
            {vehicles.map((v) => <option key={v.id} value={v.id}>{v.year} {v.make} {v.model} (#{v.stockNumber})</option>)}
          </select>
        </div>
        <div>
          <label className="label">Customer Reaction</label>
          <select name="customerReaction" className="input" defaultValue="POSITIVE">{CUSTOMER_REACTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select>
        </div>
        <div><label className="label">Objections</label><textarea name="objections" rows={2} className="input" /></div>
        <div><label className="label">Next Step</label><textarea name="nextStep" rows={2} className="input" placeholder="e.g. Send pricing worksheet, follow up tomorrow" /></div>
        <p className="text-xs text-[var(--text-muted)]">A follow-up task is created automatically once you log this.</p>
        <FormFooter pending={pending} onClose={onClose} label="Log Test Drive" />
      </form>
    </Modal>
  );
}

function LogModal({ customerId, leadId, onClose }: { customerId: string; leadId: string | null; onClose: () => void }) {
  const [state, formAction, pending] = useActionState(logActivityManual, null);
  useCloseOnSuccess(state, onClose);
  return (
    <Modal title="Log Activity" onClose={onClose}>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="customerId" value={customerId} />
        {leadId && <input type="hidden" name="leadId" value={leadId} />}
        {state?.error && <ErrorBox msg={state.error} />}
        <div>
          <label className="label">What happened?</label>
          <textarea name="description" required rows={3} className="input" placeholder="e.g. Stopped by the lot unannounced, walked the SUV row." autoFocus />
        </div>
        <FormFooter pending={pending} onClose={onClose} label="Log It" />
      </form>
    </Modal>
  );
}

function StageModal({ leadId, stages, onClose }: { leadId: string; stages: { id: string; name: string }[]; onClose: () => void }) {
  const [pending, setPending] = useState(false);
  return (
    <Modal title="Change Pipeline Stage" onClose={onClose}>
      <form
        className="space-y-4"
        action={async (formData) => {
          setPending(true);
          await changeLeadStage(leadId, String(formData.get("stageId")));
          onClose();
        }}
      >
        <div>
          <label className="label">New Stage</label>
          <select name="stageId" className="input" required>
            {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <FormFooter pending={pending} onClose={onClose} label="Update Stage" />
      </form>
    </Modal>
  );
}

function SoldModal({ leadId, vehicles, onClose }: { leadId: string; vehicles: { id: string; year: number; make: string; model: string; stockNumber: string; sellingPrice?: number | null }[]; onClose: () => void }) {
  const [state, formAction, pending] = useActionState(markSold, null);
  return (
    <Modal title="Mark Sold 🎉" onClose={onClose}>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="leadId" value={leadId} />
        {state?.error && <ErrorBox msg={state.error} />}
        <div>
          <label className="label">Vehicle Sold</label>
          <select name="vehicleId" required className="input">
            <option value="">Select vehicle…</option>
            {vehicles.map((v) => <option key={v.id} value={v.id}>{v.year} {v.make} {v.model} (#{v.stockNumber})</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Sale Price</label><input name="salePrice" type="number" required className="input" /></div>
          <div>
            <label className="label">Finance Type</label>
            <select name="financeType" className="input" defaultValue="FINANCE">{FINANCE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
          </div>
        </div>
        <div><label className="label">Notes</label><textarea name="notes" rows={2} className="input" /></div>
        <FormFooter pending={pending} onClose={onClose} label="Confirm Sale" />
      </form>
    </Modal>
  );
}

function LostModal({ leadId, lostReasons, onClose }: { leadId: string; lostReasons: { id: string; name: string }[]; onClose: () => void }) {
  const [state, formAction, pending] = useActionState(markLost, null);
  return (
    <Modal title="Mark Lost" onClose={onClose}>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="leadId" value={leadId} />
        {state?.error && <ErrorBox msg={state.error} />}
        <div>
          <label className="label">Reason</label>
          <select name="lostReasonId" required className="input">
            <option value="">Select reason…</option>
            {lostReasons.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <div><label className="label">Notes</label><textarea name="lostNotes" rows={2} className="input" /></div>
        <p className="text-xs text-[var(--text-muted)]">This customer will move to Lost Leads and stay eligible for reactivation later — nothing is ever deleted.</p>
        <FormFooter pending={pending} onClose={onClose} label="Mark Lost" danger />
      </form>
    </Modal>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{msg}</div>;
}

function FormFooter({ pending, onClose, label, danger }: { pending: boolean; onClose: () => void; label: string; danger?: boolean }) {
  return (
    <div className="flex justify-end gap-2">
      <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
      <button type="submit" disabled={pending} className={danger ? "btn btn-danger" : "btn btn-primary"}>{pending ? "Saving…" : label}</button>
    </div>
  );
}
