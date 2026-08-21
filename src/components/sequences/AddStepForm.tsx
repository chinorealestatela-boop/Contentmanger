"use client";

import { useActionState, useRef, useEffect } from "react";
import { addStep } from "@/lib/actions/sequences";
import { TASK_TYPES } from "@/lib/constants";

export function AddStepForm({ sequenceId }: { sequenceId: string }) {
  const [state, formAction, pending] = useActionState(addStep, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="grid grid-cols-1 gap-2 sm:grid-cols-[80px_120px_1fr_auto]">
      <input type="hidden" name="sequenceId" value={sequenceId} />
      {state?.error && <p className="col-span-full text-xs text-red-600">{state.error}</p>}
      <input name="dayOffset" type="number" required placeholder="Day #" className="input" />
      <select name="type" className="input" defaultValue="CALL">{TASK_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
      <input name="title" required placeholder="Step title, e.g. Day 4 — follow-up call" className="input" />
      <button type="submit" disabled={pending} className="btn btn-primary btn-sm">{pending ? "Adding…" : "Add Step"}</button>
    </form>
  );
}
