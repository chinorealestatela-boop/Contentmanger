"use client";

import { useTransition } from "react";
import { Check, RotateCcw } from "lucide-react";
import { completeTask, reopenTask } from "@/lib/actions/tasks";
import { optionColor, optionLabel, TASK_STATUSES } from "@/lib/constants";

/** Compact complete/reopen control for a Task shown on the Calendar grid —
 * the same status transitions TaskRow.tsx offers on the Tasks list, sized
 * for a single calendar row rather than a full card. */
export function TaskEventStatus({ taskId, status }: { taskId: string; status: string }) {
  const [pending, startTransition] = useTransition();
  const color = optionColor(TASK_STATUSES, status);

  if (status === "PENDING") {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={(e) => {
          e.preventDefault();
          startTransition(() => completeTask(taskId));
        }}
        className="btn btn-secondary btn-sm"
      >
        <Check size={13} /> Complete
      </button>
    );
  }

  if (status === "SNOOZED") {
    return <span className="badge" style={{ background: `${color}1a`, color }}>Snoozed</span>;
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={(e) => {
        e.preventDefault();
        startTransition(() => reopenTask(taskId));
      }}
      className="badge cursor-pointer border-0"
      style={{ background: `${color}1a`, color }}
    >
      {optionLabel(TASK_STATUSES, status)}
      <RotateCcw size={11} className="ml-1 inline" />
    </button>
  );
}
