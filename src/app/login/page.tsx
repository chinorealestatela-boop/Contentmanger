"use client";

import { useActionState } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { loginAction, type ActionState } from "@/lib/actions/auth";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(loginAction, null);

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to your booking &amp; leads dashboard."
      footer={
        <Link href="/" className="font-semibold text-[var(--brand)] hover:underline">
          ← Back to the booking site
        </Link>
      }
    >
      <form action={formAction} className="space-y-4">
        {state?.error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</div>
        )}
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" className="input" placeholder="you@dealership.com" />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className="label" htmlFor="password">Password</label>
            <Link href="/forgot-password" className="text-xs font-medium text-[var(--brand)] hover:underline">
              Forgot password?
            </Link>
          </div>
          <input id="password" name="password" type="password" required autoComplete="current-password" className="input" placeholder="••••••••" />
        </div>
        <button type="submit" disabled={pending} className="btn btn-primary w-full py-2.5">
          {pending ? "Logging in…" : "Log In"}
        </button>
      </form>
    </AuthShell>
  );
}
