"use client";

import { useActionState } from "react";
import { updateNotifyContact } from "@/lib/actions/settings";
import type { SimpleActionState } from "@/lib/actions/communications";

export function NotifyContactForm({ notifyPhone, notifyEmail, fallbackPhone, fallbackEmail }: { notifyPhone: string; notifyEmail: string; fallbackPhone: string; fallbackEmail: string }) {
  const [state, formAction, pending] = useActionState<SimpleActionState, FormData>(updateNotifyContact, null);

  return (
    <form action={formAction} className="space-y-3">
      {state && "error" in state && state.error && <p className="text-[12.5px] text-[var(--danger)]">{state.error}</p>}
      {state && "success" in state && state.success && <p className="text-[12.5px] text-emerald-600">{state.success}</p>}
      <div>
        <label className="label">Alert phone number</label>
        <input name="notifyPhone" defaultValue={notifyPhone} placeholder={fallbackPhone || "702-325-3898"} className="input" />
        <p className="mt-1 text-[11.5px] text-[var(--text-faint)]">Where SMS alerts go. Leave blank to use your profile phone{fallbackPhone ? ` (${fallbackPhone})` : ""}.</p>
      </div>
      <div>
        <label className="label">Alert email</label>
        <input name="notifyEmail" type="email" defaultValue={notifyEmail} placeholder={fallbackEmail} className="input" />
        <p className="mt-1 text-[11.5px] text-[var(--text-faint)]">Where email alerts go. Leave blank to use your login email ({fallbackEmail}).</p>
      </div>
      <button type="submit" disabled={pending} className="btn btn-primary btn-sm">{pending ? "Saving…" : "Save"}</button>
    </form>
  );
}
