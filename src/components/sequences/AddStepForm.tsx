"use client";

import { useActionState, useRef, useEffect } from "react";
import { addStep } from "@/lib/actions/sequences";

const CHANNELS = [
  { value: "SMS", label: "SMS" },
  { value: "EMAIL", label: "Email" },
  { value: "CALL", label: "Call task" },
  { value: "TASK", label: "Task" },
];

export function AddStepForm({ sequenceId }: { sequenceId: string }) {
  const [state, formAction, pending] = useActionState(addStep, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="grid grid-cols-1 gap-2 sm:grid-cols-[90px_100px_1fr_auto]">
      <input type="hidden" name="sequenceId" value={sequenceId} />
      {state?.error && <p className="col-span-full text-xs text-[var(--danger)]">{state.error}</p>}
      <input name="offsetMinutes" type="number" required placeholder="Minutes" className="input" />
      <select name="channel" className="input" defaultValue="SMS">{CHANNELS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
      <input name="title" required placeholder="Step title, e.g. Next-morning follow-up" className="input" />
      <button type="submit" disabled={pending} className="btn btn-primary btn-sm">{pending ? "Adding…" : "Add Step"}</button>
    </form>
  );
}
