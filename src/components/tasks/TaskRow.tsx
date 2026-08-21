"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Check, Clock3, RotateCcw, XCircle } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { completeTask, snoozeTask, reopenTask, cancelTask } from "@/lib/actions/tasks";
import { formatDate, formatTime12h } from "@/lib/format";
import { optionLabel, TASK_TYPES } from "@/lib/constants";
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
            {overdue && <Badge variant="overdue">Overdue</Badge>}
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
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {task.status === "PENDING" && (
          <>
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
