import { redirect } from "next/navigation";
import { requireScope } from "@/lib/queries/scope";
import { prisma } from "@/lib/prisma";
import { SettingsShell } from "@/components/settings/SettingsShell";
import { RolePermissionsForm } from "@/components/settings/RolePermissionsForm";

export default async function RolesSettingsPage() {
  const scope = await requireScope();
  if (scope.role !== "ADMIN") redirect("/settings");

  const roles = await prisma.role.findMany({ orderBy: { name: "asc" } });

  return (
    <SettingsShell isAdmin title="Roles & Permissions" subtitle="Control what each role can see and do. New roles can be added later without code changes.">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {roles.map((r) => <RolePermissionsForm key={r.id} role={r} />)}
      </div>
    </SettingsShell>
  );
}
