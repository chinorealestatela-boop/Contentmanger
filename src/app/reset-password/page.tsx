"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { resetPasswordAction, type ActionState } from "@/lib/actions/auth";

function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, formAction, pending] = useActionState<ActionState, FormData>(resetPasswordAction, null);

  if (state?.success) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-[var(--success)]/40 bg-[var(--success-soft)] px-3 py-2 text-sm text-[var(--success)]">{state.success}</div>
        <Link href="/login" className="btn btn-primary w-full py-2.5">Go to login</Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      {state?.error && (
        <div className="rounded-lg border border-[var(--danger)]/40 bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">{state.error}</div>
      )}
      {!token && (
        <div className="rounded-lg border border-[var(--warning)]/40 bg-[var(--warning-soft)] px-3 py-2 text-sm text-[var(--warning)]">
          Missing reset token — use the link from the forgot password page.
        </div>
      )}
      <div>
        <label className="label" htmlFor="password">New password</label>
        <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className="input" placeholder="At least 8 characters" />
      </div>
      <button type="submit" disabled={pending || !token} className="btn btn-primary w-full py-2.5">
        {pending ? "Updating…" : "Update Password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Set a new password"
      subtitle="Choose a new password for your account."
      footer={
        <Link href="/login" className="font-semibold text-[var(--brand-bright)] hover:underline">
          Back to log in
        </Link>
      }
    >
      <Suspense fallback={null}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
