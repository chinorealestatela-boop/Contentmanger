"use client";

import { useTransition } from "react";
import { updateRolePermissions } from "@/lib/actions/settings";
import { parsePermissions, type Permissions } from "@/lib/permissions";
import { cn } from "@/lib/utils";

const BOOL_FIELDS: { key: keyof Permissions; label: string }[] = [
  { key: "viewAllCustomers", label: "View all customers (not just own)" },
  { key: "manageTeam", label: "Manage team / assign leads" },
  { key: "manageUsers", label: "Manage users & roles" },
  { key: "manageSettings", label: "Manage settings (stages, sources, automations)" },
  { key: "manageInventory", label: "Manage vehicle inventory" },
];

export function RolePermissionsForm({ role }: { role: { id: string; label: string; permissions: string } }) {
  const [pending, startTransition] = useTransition();
  const perms = parsePermissions(role.permissions);

  function update(next: Permissions) {
    startTransition(() => updateRolePermissions(role.id, next));
  }

  return (
    <div className="card p-5">
      <h3 className="mb-3 text-[13.5px] font-semibold text-[var(--text)]">{role.label}</h3>
      <div className="space-y-2.5">
        {BOOL_FIELDS.map((f) => (
          <label key={f.key} className="flex items-center justify-between">
            <span className="text-[13px] text-[var(--text-muted)]">{f.label}</span>
            <button
              disabled={pending}
              onClick={() => update({ ...perms, [f.key]: !perms[f.key] })}
              className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", perms[f.key] ? "bg-emerald-500" : "bg-[var(--border)]")}
            >
              <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", perms[f.key] ? "translate-x-5" : "translate-x-0.5")} />
            </button>
          </label>
        ))}
        <div className="flex items-center justify-between pt-1">
          <span className="text-[13px] text-[var(--text-muted)]">Reports visibility</span>
          <select
            defaultValue={perms.viewReports}
            onChange={(e) => update({ ...perms, viewReports: e.target.value as Permissions["viewReports"] })}
            className="input !w-auto py-1 text-[12.5px]"
          >
            <option value="own">Own only</option>
            <option value="team">Team</option>
            <option value="all">All</option>
          </select>
        </div>
      </div>
    </div>
  );
}
