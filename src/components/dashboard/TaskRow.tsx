"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { completeTask } from "@/lib/actions/tasks";
import { StatusBadge } from "@/components/ui/Badge";
import { TASK_PRIORITIES, optionLabel, TASK_TYPES } from "@/lib/constants";
import { formatRelativeDay, formatTime12h } from "@/lib/format";

export function TaskRow({
  task,
}: {
  task: {
    id: string;
    title: string;
    type: string;
    priority: string;
    dueDate: Date;
    dueTime: string | null;
    customerId: string | null;
    customer: { firstName: string; lastName: string } | null;
    bookingId: string | null;
  };
}) {
  const [pending, startTransition] = useTransition();
  const overdue = new Date(task.dueDate) < new Date();

  return (
    <div className="animate-fade-in flex items-center gap-3 rounded-xl border border-transparent px-3 py-3 transition-colors hover:border-[var(--border)] hover:bg-white/[0.03]">
      <button
        disabled={pending}
        onClick={() => startTransition(() => completeTask(task.id))}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-transparent transition-colors hover:border-[var(--success)] hover:text-[var(--success)]"
        aria-label="Complete task"
      >
        <Check size={13} />
      </button>
      <div className="min-w-0 flex-1">
        <Link href={task.customerId ? `/customers/${task.customerId}` : task.bookingId ? `/bookings/${task.bookingId}` : "/tasks"} className="truncate text-[13px] font-medium text-[var(--text)] hover:text-[var(--brand-bright)]">
          {task.title}
        </Link>
        <p className="mt-0.5 truncate text-[11.5px] text-[var(--text-muted)]">
          {task.customer ? `${task.customer.firstName} ${task.customer.lastName} · ` : ""}
          {optionLabel(TASK_TYPES, task.type)} · due {formatRelativeDay(task.dueDate)}{task.dueTime ? ` at ${formatTime12h(task.dueTime)}` : ""}
        </p>
      </div>
      {overdue && <StatusBadge options={[{ value: "OVERDUE", label: "Overdue", color: "#c9605c" }]} value="OVERDUE" className="shrink-0" />}
      <StatusBadge options={TASK_PRIORITIES} value={task.priority} className="shrink-0" />
    </div>
  );
}
