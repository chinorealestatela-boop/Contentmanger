"use client";

import { useActionState, useRef, useEffect, useTransition } from "react";
import { Plus } from "lucide-react";
import { createUserAccount, toggleUserActive, updateUserRole } from "@/lib/actions/settings";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

type UserRow = { id: string; firstName: string; lastName: string; email: string; title: string | null; isActive: boolean; avatarColor: string; roleId: string; role: { name: string } };
type Role = { id: string; name: string; label: string };

export function UserManagement({ users, roles }: { users: UserRow[]; roles: Role[] }) {
  const [state, formAction, pending] = useActionState(createUserAccount, null);
  const [, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <div className="space-y-5">
      <div className="card divide-y divide-[var(--border)]">
        {users.map((u) => (
          <div key={u.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Avatar firstName={u.firstName} lastName={u.lastName} color={u.avatarColor} size="sm" />
              <div>
                <p className="text-[13.5px] font-semibold text-[var(--text)]">{u.firstName} {u.lastName} {!u.isActive && <Badge variant="lost">Inactive</Badge>}</p>
                <p className="text-[12px] text-[var(--text-muted)]">{u.email} {u.title ? `· ${u.title}` : ""}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <select
                defaultValue={u.roleId}
                onChange={(e) => startTransition(() => updateUserRole(u.id, e.target.value))}
                className="input !w-auto py-1.5 text-[12.5px]"
              >
                {roles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
              <button
                onClick={() => startTransition(() => toggleUserActive(u.id, !u.isActive))}
                className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", u.isActive ? "bg-emerald-500" : "bg-[var(--border)]")}
              >
                <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", u.isActive ? "translate-x-5" : "translate-x-0.5")} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="card p-5">
        <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Add Team Member</h3>
        <form ref={formRef} action={formAction} className="space-y-3">
          {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <input name="firstName" required placeholder="First name" className="input" />
            <input name="lastName" required placeholder="Last name" className="input" />
          </div>
          <input name="email" type="email" required placeholder="Email" className="input" />
          <div className="grid grid-cols-2 gap-3">
            <input name="password" type="password" required minLength={8} placeholder="Temporary password" className="input" />
            <select name="roleId" required className="input" defaultValue="">
              <option value="" disabled>Role…</option>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </div>
          <input name="title" placeholder="Title (optional)" className="input" />
          <button type="submit" disabled={pending} className="btn btn-primary"><Plus size={14} /> {pending ? "Creating…" : "Create Account"}</button>
        </form>
      </div>
    </div>
  );
}
