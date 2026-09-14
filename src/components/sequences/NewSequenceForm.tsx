"use client";

import { useActionState, useRef, useEffect } from "react";
import { createSequence } from "@/lib/actions/sequences";
import { ErrorBox } from "@/components/ui/Form";

export function NewSequenceForm() {
  const [state, formAction, pending] = useActionState(createSequence, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_140px_auto]">
      {state?.error && <div className="col-span-full"><ErrorBox>{state.error}</ErrorBox></div>}
      <input name="name" required placeholder="Sequence name" className="input" />
      <input name="description" placeholder="Description (optional)" className="input" />
      <select name="trigger" className="input" defaultValue="NEW_LEAD">
        <option value="NEW_LEAD">New Lead</option>
        <option value="NO_RESPONSE">No Response</option>
        <option value="MANUAL">Manual</option>
      </select>
      <button type="submit" disabled={pending} className="btn btn-primary">{pending ? "Creating…" : "Create"}</button>
    </form>
  );
}
