"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { createTask } from "@/lib/actions/tasks";
import { TASK_TYPES, TASK_PRIORITIES } from "@/lib/constants";

export function NewTaskButton({ customers }: { customers: { id: string; firstName: string; lastName: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn btn-primary" onClick={() => setOpen(true)}>
        <Plus size={15} /> New Task
      </button>
      {open && <NewTaskModal customers={customers} onClose={() => setOpen(false)} />}
    </>
  );
}

export function NewTaskModal({ customers, defaultCustomerId, onClose }: { customers: { id: string; firstName: string; lastName: string }[]; defaultCustomerId?: string; onClose: () => void }) {
  const [state, formAction, pending] = useActionState(createTask, null);
  useEffect(() => {
    if (state?.success) onClose();
  }, [state, onClose]);
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <Modal title="New Task" onClose={onClose}>
      <form action={formAction} className="space-y-4">
        {state?.error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</div>}
        <div>
          <label className="label">Title</label>
          <input name="title" required className="input" placeholder="e.g. Call John Smith about financing" autoFocus />
        </div>
        <div>
          <label className="label">Lead / Customer (optional)</label>
          <select name="customerId" className="input" defaultValue={defaultCustomerId ?? ""}>
            <option value="">— Not linked to a customer —</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
          </select>
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
        <div><label className="label">Notes</label><textarea name="notes" rows={3} className="input" /></div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button type="submit" disabled={pending} className="btn btn-primary">{pending ? "Saving…" : "Create Task"}</button>
        </div>
      </form>
    </Modal>
  );
}
