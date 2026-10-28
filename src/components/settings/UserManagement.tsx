"use client";

import { useActionState, useRef, useEffect, useState, useTransition } from "react";
import { Plus, Pencil, KeyRound } from "lucide-react";
import { createUserAccount, toggleUserActive, updateUserRole, updateUserAccount, resetUserPassword } from "@/lib/actions/settings";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/utils";
import type { SimpleActionState } from "@/lib/actions/communications";

type UserRow = { id: string; firstName: string; lastName: string; email: string; title: string | null; isActive: boolean; avatarColor: string; roleId: string; role: { name: string } };
type Role = { id: string; name: string; label: string };

function useCloseOnSuccess(state: SimpleActionState, onClose: () => void) {
  useEffect(() => {
    if (state?.success) onClose();
  }, [state, onClose]);
}

function EditUserModal({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const [state, formAction, pending] = useActionState(updateUserAccount, null);
  useCloseOnSuccess(state, onClose);
  return (
    <Modal title={`Edit — ${user.firstName} ${user.lastName}`} onClose={onClose}>
      <form action={formAction} className="space-y-3">
        <input type="hidden" name="userId" value={user.id} />
        {state?.error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">First name</label><input name="firstName" required defaultValue={user.firstName} className="input" autoFocus /></div>
          <div><label className="label">Last name</label><input name="lastName" required defaultValue={user.lastName} className="input" /></div>
        </div>
        <div><label className="label">Email</label><input name="email" type="email" required defaultValue={user.email} className="input" /></div>
        <div><label className="label">Title (optional)</label><input name="title" defaultValue={user.title ?? ""} className="input" /></div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button type="submit" disabled={pending} className="btn btn-primary">{pending ? "Saving…" : "Save Changes"}</button>
        </div>
      </form>
    </Modal>
  );
}

function ResetPasswordModal({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const [state, formAction, pending] = useActionState(resetUserPassword, null);
  useCloseOnSuccess(state, onClose);
  return (
    <Modal title={`Reset Password — ${user.firstName} ${user.lastName}`} onClose={onClose}>
      <form action={formAction} className="space-y-3">
        <input type="hidden" name="userId" value={user.id} />
        {state?.error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
        <div>
          <label className="label">New Password</label>
          <input name="password" type="password" required minLength={8} placeholder="At least 8 characters" className="input" autoFocus />
        </div>
        <p className="text-[12px] text-[var(--text-faint)]">This replaces their current password immediately — share the new one with them directly, it won&rsquo;t be emailed.</p>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button type="submit" disabled={pending} className="btn btn-primary">{pending ? "Resetting…" : "Reset Password"}</button>
        </div>
      </form>
    </Modal>
  );
}

function TeamMemberRow({ user, roles }: { user: UserRow; roles: Role[] }) {
  const [modal, setModal] = useState<"EDIT" | "PASSWORD" | null>(null);
  const [, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <Avatar firstName={user.firstName} lastName={user.lastName} color={user.avatarColor} size="sm" />
        <div>
          <p className="text-[13.5px] font-semibold text-[var(--text)]">{user.firstName} {user.lastName} {!user.isActive && <Badge variant="lost">Inactive</Badge>}</p>
          <p className="text-[12px] text-[var(--text-muted)]">{user.email} {user.title ? `· ${user.title}` : ""}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button title="Edit info" onClick={() => setModal("EDIT")} className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]"><Pencil size={14} /></button>
        <button title="Reset password" onClick={() => setModal("PASSWORD")} className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]"><KeyRound size={14} /></button>
        <select
          defaultValue={user.roleId}
          onChange={(e) => startTransition(() => updateUserRole(user.id, e.target.value))}
          className="input !w-auto py-1.5 text-[12.5px]"
        >
          {roles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
        <button
          onClick={() => startTransition(() => toggleUserActive(user.id, !user.isActive))}
          className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", user.isActive ? "bg-emerald-500" : "bg-[var(--border)]")}
        >
          <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", user.isActive ? "translate-x-5" : "translate-x-0.5")} />
        </button>
      </div>

      {modal === "EDIT" && <EditUserModal user={user} onClose={() => setModal(null)} />}
      {modal === "PASSWORD" && <ResetPasswordModal user={user} onClose={() => setModal(null)} />}
    </div>
  );
}

export function UserManagement({ users, roles }: { users: UserRow[]; roles: Role[] }) {
  const [state, formAction, pending] = useActionState(createUserAccount, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <div className="space-y-5">
      <div className="card divide-y divide-[var(--border)]">
        {users.map((u) => (
          <TeamMemberRow key={u.id} user={u} roles={roles} />
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
