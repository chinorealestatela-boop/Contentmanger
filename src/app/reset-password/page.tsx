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
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.success}</div>
        <Link href="/login" className="btn btn-primary w-full py-2.5">Go to login</Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      {state?.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</div>
      )}
      {!token && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
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
        <Link href="/login" className="font-semibold text-[var(--brand)] hover:underline">
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
