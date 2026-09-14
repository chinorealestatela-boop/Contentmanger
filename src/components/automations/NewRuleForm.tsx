"use client";

import { useActionState, useState } from "react";
import { createAutomationRule } from "@/lib/actions/automations";
import { TRIGGER_EVENTS, TASK_TYPES, TASK_PRIORITIES, NOTIFICATION_TYPES } from "@/lib/constants";
import { ErrorBox, SuccessBox } from "@/components/ui/Form";

export function NewRuleForm({ templateKeys }: { templateKeys: string[] }) {
  const [state, formAction, pending] = useActionState(createAutomationRule, null);
  const [trigger, setTrigger] = useState("NEW_LEAD");
  const [actionType, setActionType] = useState<"CREATE_TASK" | "NOTIFY_STAFF" | "SEND_MESSAGE">("CREATE_TASK");

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && <ErrorBox>{state.error}</ErrorBox>}
      {state?.success && <SuccessBox>Rule created.</SuccessBox>}
      <div>
        <label className="label">Rule Name</label>
        <input name="name" required className="input" placeholder="e.g. Ping me when a VIP lead comes in" />
      </div>
      <div>
        <label className="label">When…</label>
        <select name="triggerEvent" className="input" value={trigger} onChange={(e) => setTrigger(e.target.value)}>
          {TRIGGER_EVENTS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>
      {trigger === "NO_CONTACT_X_HOURS" && (
        <div><label className="label">Hours without contact</label><input name="hours" type="number" defaultValue={4} className="input" /></div>
      )}
      <div>
        <label className="label">Then…</label>
        <select className="input" value={actionType} onChange={(e) => setActionType(e.target.value as typeof actionType)}>
          <option value="CREATE_TASK">Create a task</option>
          <option value="NOTIFY_STAFF">Notify staff</option>
          <option value="SEND_MESSAGE">Send a message template</option>
        </select>
        <input type="hidden" name="actionType" value={actionType} />
      </div>
      {actionType === "CREATE_TASK" && (
        <div className="space-y-3 rounded-lg border border-[var(--border)] p-3">
          <input name="taskTitle" required className="input" placeholder="Task title" />
          <div className="grid grid-cols-3 gap-2">
            <select name="taskType" className="input" defaultValue="CALL">{TASK_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
            <select name="taskPriority" className="input" defaultValue="NORMAL">{TASK_PRIORITIES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
            <input name="dueInHours" type="number" defaultValue={4} className="input" placeholder="Due in (hrs)" />
          </div>
        </div>
      )}
      {actionType === "NOTIFY_STAFF" && (
        <div className="rounded-lg border border-[var(--border)] p-3">
          <select name="notifyType" className="input" defaultValue="NEW_LEAD">{NOTIFICATION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
        </div>
      )}
      {actionType === "SEND_MESSAGE" && (
        <div className="rounded-lg border border-[var(--border)] p-3">
          <select name="templateKey" className="input" defaultValue={templateKeys[0]}>{templateKeys.map((k) => <option key={k} value={k}>{k.replace(/_/g, " ")}</option>)}</select>
        </div>
      )}
      <div className="flex justify-end">
        <button type="submit" disabled={pending} className="btn btn-primary">{pending ? "Creating…" : "Create Rule"}</button>
      </div>
    </form>
  );
}
