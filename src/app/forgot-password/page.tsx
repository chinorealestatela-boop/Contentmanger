"use client";

import { useActionState } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { forgotPasswordAction, type ActionState } from "@/lib/actions/auth";

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(forgotPasswordAction, null);

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your email and we'll generate a reset link."
      footer={
        <Link href="/login" className="font-semibold text-[var(--brand)] hover:underline">
          Back to log in
        </Link>
      }
    >
      {state?.success ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.success}</div>
          {state.resetLink && (
            <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg-subtle)] p-3 text-xs">
              <p className="font-semibold text-[var(--text)]">No email provider is connected yet</p>
              <p className="mt-1 text-[var(--text-muted)]">
                In v1, reset links are shown here instead of emailed. Connect an email integration later in Settings to send this automatically.
              </p>
              <Link href={state.resetLink} className="mt-2 inline-block break-all font-medium text-[var(--brand)] hover:underline">
                {state.resetLink}
              </Link>
            </div>
          )}
        </div>
      ) : (
        <form action={formAction} className="space-y-4">
          {state?.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</div>
          )}
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required autoComplete="email" className="input" placeholder="you@dealership.com" />
          </div>
          <button type="submit" disabled={pending} className="btn btn-primary w-full py-2.5">
            {pending ? "Sending…" : "Send Reset Link"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
