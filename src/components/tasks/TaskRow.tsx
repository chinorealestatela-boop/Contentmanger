"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, Clock3, RotateCcw, XCircle, Phone, MessageSquare, CalendarClock } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { completeTask, snoozeTask, reopenTask, cancelTask, rescheduleTask } from "@/lib/actions/tasks";
import { formatDate, formatTime12h } from "@/lib/format";
import { optionLabel, optionColor, TASK_TYPES } from "@/lib/constants";
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
  customer: { id: string; firstName: string; lastName: string; phone: string | null } | null;
  lead: {
    stage: { name: string };
    vehicleInterests: { vehicle: { year: number; make: string; model: string } | null; year: number | null; make: string | null; model: string | null }[];
  } | null;
};

function toDateInputValue(d: Date) {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

export function TaskRow({ task, overdue }: { task: TaskData; overdue?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [rescheduling, setRescheduling] = useState(false);
  const vi = task.lead?.vehicleInterests[0];
  const vehicleLabel = vi ? (vi.vehicle ? `${vi.vehicle.year} ${vi.vehicle.make} ${vi.vehicle.model}` : [vi.year, vi.make, vi.model].filter(Boolean).join(" ")) : null;
  const requested = task.notes?.split("\n").find((l) => l.trim().length > 0) ?? null;

  return (
    <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span className="mt-1 h-2 w-2 shrink-0 self-start rounded-full" style={{ backgroundColor: optionColor(TASK_TYPES, task.type) }} aria-hidden />
        {task.customer && <Avatar firstName={task.customer.firstName} lastName={task.customer.lastName} size="sm" />}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className={cn("text-[13.5px] font-semibold text-[var(--text)]", task.status === "COMPLETED" && "line-through opacity-60")}>{task.title}</p>
            <Badge variant="neutral">{optionLabel(TASK_TYPES, task.type)}</Badge>
            {task.priority === "URGENT" && <Badge variant="hot">Urgent</Badge>}
            {task.priority === "HIGH" && <Badge variant="warm">High</Badge>}
            {overdue && <Badge variant="overdue">Overdue</Badge>}
            {task.source === "AUTOMATION" && <Badge variant="neutral">Auto</Badge>}
            {task.source === "SEQUENCE" && <Badge variant="neutral">Sequence</Badge>}
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[12px] text-[var(--text-muted)]">
            {task.customer ? (
              <Link href={`/customers/${task.customer.id}`} className="hover:text-[var(--brand)] hover:underline">
                {task.customer.firstName} {task.customer.lastName}
              </Link>
            ) : "No customer linked"}
            {task.lead ? ` · ${task.lead.stage.name}` : ""}
            {task.customer?.phone && (
              <>
                <a href={`tel:${task.customer.phone}`} className="flex items-center gap-0.5 text-[var(--text-faint)] hover:text-[var(--brand)]" aria-label="Call customer">
                  <Phone size={11} /> Call
                </a>
                <a href={`sms:${task.customer.phone}`} className="flex items-center gap-0.5 text-[var(--text-faint)] hover:text-[var(--brand)]" aria-label="Text customer">
                  <MessageSquare size={11} /> Text
                </a>
              </>
            )}
          </p>
          {vehicleLabel && <p className="mt-0.5 truncate text-[12px] text-[var(--text-muted)]">{vehicleLabel}</p>}
          {requested && <p className="mt-0.5 truncate text-[11.5px] italic text-[var(--text-faint)]">&ldquo;{requested}&rdquo;</p>}
          <p className="mt-0.5 text-[11.5px] text-[var(--text-faint)]">
            Due {formatDate(task.dueDate)}{task.dueTime ? ` at ${formatTime12h(task.dueTime)}` : ""}
          </p>
          {rescheduling && (
            <form
              className="mt-2 flex flex-wrap items-center gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const date = formData.get("dueDate") as string;
                const time = formData.get("dueTime") as string;
                startTransition(async () => {
                  await rescheduleTask(task.id, date, time || undefined);
                  setRescheduling(false);
                });
              }}
            >
              <input type="date" name="dueDate" defaultValue={toDateInputValue(task.dueDate)} required className="input w-auto py-1 text-[12.5px]" />
              <input type="time" name="dueTime" defaultValue={task.dueTime ?? ""} className="input w-auto py-1 text-[12.5px]" />
              <button type="submit" disabled={pending} className="btn btn-primary btn-sm">Save</button>
              <button type="button" disabled={pending} className="btn btn-secondary btn-sm" onClick={() => setRescheduling(false)}>Cancel</button>
            </form>
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
        {task.status === "PENDING" && !rescheduling && (
          <>
            <button disabled={pending} className="btn btn-secondary btn-sm" onClick={() => setRescheduling(true)}>
              <CalendarClock size={13} /> Reschedule
            </button>
            <button disabled={pending} className="btn btn-secondary btn-sm" onClick={() => startTransition(() => snoozeTask(task.id, 1))}>
              <Clock3 size={13} /> Snooze
            </button>
            <button disabled={pending} className="btn btn-secondary btn-sm text-red-600" onClick={() => startTransition(() => cancelTask(task.id))}>
              <XCircle size={13} />
            </button>
            <button disabled={pending} className="btn btn-primary btn-sm" onClick={() => startTransition(() => completeTask(task.id))}>
              <Check size={13} /> Complete
            </button>
          </>
        )}
        {task.status !== "PENDING" && task.status !== "CANCELLED" && (
          <button disabled={pending} className="btn btn-secondary btn-sm" onClick={() => startTransition(() => reopenTask(task.id))}>
            <RotateCcw size={13} /> Reopen
          </button>
        )}
      </div>
    </div>
  );
}
