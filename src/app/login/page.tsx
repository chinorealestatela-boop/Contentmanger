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
      subtitle="Log in to your Driveline CRM workspace."
      footer={
        <>
          Don&rsquo;t have an account?{" "}
          <Link href="/register" className="font-semibold text-[var(--brand)] hover:underline">
            Create one
          </Link>
        </>
      }
    >
      <form action={formAction} className="space-y-4">
        {state?.error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</div>
        )}
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" className="input" placeholder="you@dealership.com" defaultValue="sam.carter@driveline-motors.com" />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className="label" htmlFor="password">Password</label>
            <Link href="/forgot-password" className="text-xs font-medium text-[var(--brand)] hover:underline">
              Forgot password?
            </Link>
          </div>
          <input id="password" name="password" type="password" required autoComplete="current-password" className="input" placeholder="••••••••" defaultValue="Password123!" />
        </div>
        <button type="submit" disabled={pending} className="btn btn-primary w-full py-2.5">
          {pending ? "Logging in…" : "Log In"}
        </button>
      </form>
      <div className="mt-6 rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg-subtle)] p-3 text-xs text-[var(--text-muted)]">
        <p className="font-semibold text-[var(--text)]">Demo credentials pre-filled</p>
        <p className="mt-1">Salesperson: sam.carter@driveline-motors.com</p>
        <p>Manager: jordan.blake@driveline-motors.com</p>
        <p>Admin: alex.rivera@driveline-motors.com</p>
        <p className="mt-1">Password for all: Password123!</p>
      </div>
    </AuthShell>
  );
}
