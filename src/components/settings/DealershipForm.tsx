"use client";

import { useActionState } from "react";
import { updateDealershipSettings } from "@/lib/actions/settings";

export function DealershipForm({ initial }: { initial: { name: string; address?: string; phone?: string; timezone?: string } }) {
  const [state, formAction, pending] = useActionState(updateDealershipSettings, null);

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</div>}
      {state?.success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.success}</div>}
      <div><label className="label">Dealership Name</label><input name="name" required defaultValue={initial.name} className="input" /></div>
      <div><label className="label">Address</label><input name="address" defaultValue={initial.address ?? ""} className="input" /></div>
      <div><label className="label">Phone</label><input name="phone" defaultValue={initial.phone ?? ""} className="input" /></div>
      <div>
        <label className="label">Timezone</label>
        <select name="timezone" defaultValue={initial.timezone ?? "America/Chicago"} className="input">
          <option value="America/New_York">Eastern</option>
          <option value="America/Chicago">Central</option>
          <option value="America/Denver">Mountain</option>
          <option value="America/Los_Angeles">Pacific</option>
        </select>
      </div>
      <div className="flex justify-end"><button type="submit" disabled={pending} className="btn btn-primary">{pending ? "Saving…" : "Save"}</button></div>
    </form>
  );
}
