"use client";

import { useActionState } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { registerAction, type ActionState } from "@/lib/actions/auth";

export default function RegisterPage() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(registerAction, null);

  return (
    <AuthShell
      title="Create your account"
      subtitle="Set up a Driveline CRM account. New accounts start as Salesperson."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-[var(--brand)] hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form action={formAction} className="space-y-4">
        {state?.error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="firstName">First name</label>
            <input id="firstName" name="firstName" required className="input" placeholder="Jamie" />
          </div>
          <div>
            <label className="label" htmlFor="lastName">Last name</label>
            <input id="lastName" name="lastName" required className="input" placeholder="Rivera" />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="title">Title (optional)</label>
          <input id="title" name="title" className="input" placeholder="Sales Consultant" />
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" className="input" placeholder="you@dealership.com" />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className="input" placeholder="At least 8 characters" />
        </div>
        <button type="submit" disabled={pending} className="btn btn-primary w-full py-2.5">
          {pending ? "Creating account…" : "Create Account"}
        </button>
      </form>
    </AuthShell>
  );
}
