"use client";

import { useActionState } from "react";
import { createSequence } from "@/lib/actions/sequences";

export default function NewSequencePage() {
  const [state, formAction, pending] = useActionState(createSequence, null);

  return (
    <div className="mx-auto max-w-lg space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text)]">New Follow-Up Sequence</h1>
        <p className="text-[13px] text-[var(--text-muted)]">Give it a name — you&rsquo;ll add the day-by-day steps next.</p>
      </div>
      <div className="card p-5">
        <form action={formAction} className="space-y-4">
          {state?.error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</div>}
          <div><label className="label">Name</label><input name="name" required className="input" placeholder="e.g. Service Customer Win-Back" /></div>
          <div><label className="label">Description</label><textarea name="description" rows={2} className="input" /></div>
          <div>
            <label className="label">Runs When…</label>
            <select name="trigger" className="input" defaultValue="MANUAL">
              <option value="NEW_LEAD">A new lead is created</option>
              <option value="REACTIVATION">A customer is reactivated</option>
              <option value="MANUAL">Manually enrolled only</option>
            </select>
          </div>
          <div className="flex justify-end"><button type="submit" disabled={pending} className="btn btn-primary">{pending ? "Creating…" : "Create & Add Steps"}</button></div>
        </form>
      </div>
    </div>
  );
}
