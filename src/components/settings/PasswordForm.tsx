"use client";

import { useActionState, useRef, useEffect } from "react";
import { changePassword } from "@/lib/actions/settings";

export function PasswordForm() {
  const [state, formAction, pending] = useActionState(changePassword, null);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={formAction} className="space-y-4">
      {state?.error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</div>}
      {state?.success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.success}</div>}
      <div><label className="label">Current Password</label><input name="currentPassword" type="password" required className="input" autoComplete="current-password" /></div>
      <div><label className="label">New Password</label><input name="newPassword" type="password" required minLength={8} className="input" autoComplete="new-password" /></div>
      <div className="flex justify-end"><button type="submit" disabled={pending} className="btn btn-primary">{pending ? "Updating…" : "Change Password"}</button></div>
    </form>
  );
}
