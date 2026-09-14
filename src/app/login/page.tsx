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
      subtitle="Sign in to the Stratos Exotics operations workspace."
      footer={
        <>
          Don&rsquo;t have an account?{" "}
          <Link href="/register" className="font-semibold text-[var(--brand-bright)] hover:underline">
            Create one
          </Link>
        </>
      }
    >
      <form action={formAction} className="space-y-4">
        {state?.error && (
          <div className="rounded-lg border border-[var(--danger)]/40 bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">{state.error}</div>
        )}
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" className="input" placeholder="you@stratoslux.com" defaultValue="chino.realestatela@gmail.com" />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className="label" htmlFor="password">Password</label>
            <Link href="/forgot-password" className="text-xs font-medium text-[var(--brand-bright)] hover:underline">
              Forgot password?
            </Link>
          </div>
          <input id="password" name="password" type="password" required autoComplete="current-password" className="input" placeholder="••••••••" defaultValue="Password123!" />
        </div>
        <button type="submit" disabled={pending} className="btn btn-primary w-full py-2.5">
          {pending ? "Signing in…" : "Sign In"}
        </button>
      </form>
      <div className="mt-6 rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg-subtle)] p-3 text-xs text-[var(--text-muted)]">
        <p className="font-semibold text-[var(--text)]">Demo credentials pre-filled</p>
        <p className="mt-1">chino.realestatela@gmail.com — Password123!</p>
        <p className="mt-1 text-[var(--text-faint)]">This page auto-redirects straight to the dashboard for the primary owner account — it only appears if that auto-login can&rsquo;t find its account.</p>
      </div>
    </AuthShell>
  );
}
