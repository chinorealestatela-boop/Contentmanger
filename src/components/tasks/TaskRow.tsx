"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Check, Clock3, RotateCcw, XCircle, Pencil, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { completeTask, snoozeTask, reopenTask, cancelTask, updateTask, deleteTask } from "@/lib/actions/tasks";
import { formatDate, formatTime12h, daysBetween } from "@/lib/format";
import { optionLabel, TASK_TYPES, TASK_PRIORITIES } from "@/lib/constants";
import { cn } from "@/lib/utils";

type TaskData = {
  id: string;
  title: string;
  type: string;
  priority: string;
  status: string;
  dueDate: Date;
  dueTime: string | null;
  notes: string | null;
  source: string;
  customer: { id: string; firstName: string; lastName: string } | null;
  lead: { stage: { name: string } } | null;
};

export function TaskRow({ task, overdue }: { task: TaskData; overdue?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const daysOverdue = overdue ? Math.max(1, daysBetween(task.dueDate)) : 0;

  return (
    <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        {task.customer && <Avatar firstName={task.customer.firstName} lastName={task.customer.lastName} size="sm" />}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className={cn("text-[13.5px] font-semibold text-[var(--text)]", task.status === "COMPLETED" && "line-through opacity-60")}>{task.title}</p>
            <Badge variant="neutral">{optionLabel(TASK_TYPES, task.type)}</Badge>
            {task.priority === "URGENT" && <Badge variant="hot">Urgent</Badge>}
            {task.priority === "HIGH" && <Badge variant="warm">High</Badge>}
            {overdue && <Badge variant="overdue">{daysOverdue} {daysOverdue === 1 ? "day" : "days"} overdue</Badge>}
            {task.source === "AUTOMATION" && <Badge variant="neutral">Auto</Badge>}
            {task.source === "SEQUENCE" && <Badge variant="neutral">Sequence</Badge>}
          </div>
          <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">
            {task.customer ? (
              <Link href={`/customers/${task.customer.id}`} className="hover:text-[var(--brand)] hover:underline">
                {task.customer.firstName} {task.customer.lastName}
              </Link>
            ) : "No customer linked"}
            {task.lead ? ` · ${task.lead.stage.name}` : ""}
          </p>
          <p className="mt-0.5 text-[11.5px] text-[var(--text-faint)]">
            Due {formatDate(task.dueDate)}{task.dueTime ? ` at ${formatTime12h(task.dueTime)}` : ""}
          </p>
          {task.notes && <p className="mt-1 text-[12px] text-[var(--text-muted)]">{task.notes}</p>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {task.status === "PENDING" && (
          <>
            <button disabled={pending} className="btn btn-secondary btn-sm" onClick={() => setEditing(true)} title="Edit">
              <Pencil size={13} />
            </button>
            <button disabled={pending} className="btn btn-secondary btn-sm" onClick={() => startTransition(() => snoozeTask(task.id, 1))}>
              <Clock3 size={13} /> Snooze
            </button>
            <button disabled={pending} className="btn btn-secondary btn-sm text-red-600" onClick={() => startTransition(() => cancelTask(task.id))} title="Cancel">
              <XCircle size={13} />
            </button>
            <button disabled={pending} className="btn btn-primary btn-sm" onClick={() => startTransition(() => completeTask(task.id))}>
              <Check size={13} /> Complete
            </button>
          </>
        )}
        {task.status !== "PENDING" && task.status !== "CANCELLED" && (
          <button disabled={pending} className="btn btn-secondary btn-sm" onClick={() => startTransition(() => reopenTask(task.id))}>
            <RotateCcw size={13} /> Mark Incomplete
          </button>
        )}
        <button
          disabled={pending}
          className="btn btn-secondary btn-sm text-red-600"
          title="Delete"
          onClick={() => {
            if (confirm(`Delete task "${task.title}"? This can't be undone.`)) startTransition(() => deleteTask(task.id));
          }}
        >
          <Trash2 size={13} />
        </button>
      </div>

      {editing && <EditTaskModal task={task} onClose={() => setEditing(false)} />}
    </div>
  );
}

function EditTaskModal({ task, onClose }: { task: TaskData; onClose: () => void }) {
  const [state, formAction, pending] = useActionState(updateTask, null);
  useEffect(() => {
    if (state?.success) onClose();
  }, [state, onClose]);

  return (
    <Modal title="Edit Task" onClose={onClose}>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="taskId" value={task.id} />
        {task.customer && <input type="hidden" name="customerId" value={task.customer.id} />}
        {state?.error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</div>}
        <div>
          <label className="label">Title</label>
          <input name="title" required defaultValue={task.title} className="input" autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Type</label>
            <select name="type" className="input" defaultValue={task.type}>{TASK_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
          </div>
          <div>
            <label className="label">Priority</label>
            <select name="priority" className="input" defaultValue={task.priority}>{TASK_PRIORITIES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Due Date</label><input type="date" name="dueDate" required defaultValue={new Date(task.dueDate).toISOString().slice(0, 10)} className="input" /></div>
          <div><label className="label">Due Time</label><input type="time" name="dueTime" defaultValue={task.dueTime ?? ""} className="input" /></div>
        </div>
        <div><label className="label">Notes</label><textarea name="notes" rows={3} defaultValue={task.notes ?? ""} className="input" /></div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button type="submit" disabled={pending} className="btn btn-primary">{pending ? "Saving…" : "Save Changes"}</button>
        </div>
      </form>
    </Modal>
  );
}
