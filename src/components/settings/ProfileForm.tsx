"use client";

import { useActionState } from "react";
import { updateProfile } from "@/lib/actions/settings";

const COLORS = ["#2563eb", "#0d9488", "#7c3aed", "#dc2626", "#ea580c", "#16a34a", "#db2777", "#0891b2"];

export function ProfileForm({ user }: { user: { firstName: string; lastName: string; title: string | null; phone: string | null; avatarColor: string; email: string } }) {
  const [state, formAction, pending] = useActionState(updateProfile, null);

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</div>}
      {state?.success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.success}</div>}
      <div>
        <label className="label">Email</label>
        <input value={user.email} disabled className="input bg-[var(--bg-subtle)] text-[var(--text-faint)]" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">First Name</label><input name="firstName" required defaultValue={user.firstName} className="input" /></div>
        <div><label className="label">Last Name</label><input name="lastName" required defaultValue={user.lastName} className="input" /></div>
      </div>
      <div><label className="label">Title</label><input name="title" defaultValue={user.title ?? ""} className="input" placeholder="e.g. Sales Consultant" /></div>
      <div><label className="label">Phone</label><input name="phone" defaultValue={user.phone ?? ""} className="input" /></div>
      <div>
        <label className="label">Avatar Color</label>
        <div className="flex gap-2">
          {COLORS.map((c) => (
            <label key={c}>
              <input type="radio" name="avatarColor" value={c} defaultChecked={user.avatarColor === c} className="peer sr-only" />
              <span className="block h-8 w-8 cursor-pointer rounded-full ring-offset-2 peer-checked:ring-2 peer-checked:ring-[var(--brand)]" style={{ background: c }} />
            </label>
          ))}
        </div>
      </div>
      <div className="flex justify-end"><button type="submit" disabled={pending} className="btn btn-primary">{pending ? "Saving…" : "Save Changes"}</button></div>
    </form>
  );
}
