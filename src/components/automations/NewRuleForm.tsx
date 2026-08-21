"use client";

import { useActionState, useState } from "react";
import { createAutomationRule } from "@/lib/actions/automations";
import { TRIGGER_EVENTS, TASK_TYPES, TASK_PRIORITIES } from "@/lib/constants";

export function NewRuleForm() {
  const [state, formAction, pending] = useActionState(createAutomationRule, null);
  const [trigger, setTrigger] = useState("NEW_LEAD");
  const [actionType, setActionType] = useState<"CREATE_TASK" | "NOTIFY">("CREATE_TASK");

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</div>}
      {state?.success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Rule created.</div>}
      <div>
        <label className="label">Rule Name</label>
        <input name="name" required className="input" placeholder="e.g. Ping me when a deal stalls" />
      </div>
      <div>
        <label className="label">When…</label>
        <select name="triggerEvent" className="input" value={trigger} onChange={(e) => setTrigger(e.target.value)}>
          {TRIGGER_EVENTS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>
      {trigger === "NO_CONTACT_X_DAYS" && (
        <div><label className="label">Days without contact</label><input name="days" type="number" defaultValue={3} className="input" /></div>
      )}
      <div>
        <label className="label">Then…</label>
        <select className="input" value={actionType} onChange={(e) => setActionType(e.target.value as "CREATE_TASK" | "NOTIFY")}>
          <option value="CREATE_TASK">Create a task</option>
          <option value="NOTIFY">Send a notification</option>
        </select>
        <input type="hidden" name="actionType" value={actionType} />
      </div>
      {actionType === "CREATE_TASK" ? (
        <div className="space-y-3 rounded-lg border border-[var(--border)] p-3">
          <input name="taskTitle" required className="input" placeholder="Task title" />
          <div className="grid grid-cols-3 gap-2">
            <select name="taskType" className="input" defaultValue="CALL">{TASK_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
            <select name="taskPriority" className="input" defaultValue="NORMAL">{TASK_PRIORITIES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
            <input name="dueInHours" type="number" defaultValue={4} className="input" placeholder="Due in (hrs)" />
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-[var(--border)] p-3">
          <input name="notifTitle" required className="input" placeholder="Notification title" />
        </div>
      )}
      <div className="flex justify-end">
        <button type="submit" disabled={pending} className="btn btn-primary">{pending ? "Creating…" : "Create Rule"}</button>
      </div>
    </form>
  );
}
