import { redirect } from "next/navigation";
import { requireScope } from "@/lib/queries/scope";
import { prisma } from "@/lib/prisma";
import { SettingsShell } from "@/components/settings/SettingsShell";
import { UserManagement } from "@/components/settings/UserManagement";

export default async function UsersSettingsPage() {
  const scope = await requireScope();
  if (scope.role !== "ADMIN") redirect("/settings");

  const [users, roles] = await Promise.all([
    prisma.user.findMany({ include: { role: true }, orderBy: { firstName: "asc" } }),
    prisma.role.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <SettingsShell isAdmin title="User Management" subtitle="Manage your team's accounts and roles.">
      <UserManagement users={users} roles={roles} />
    </SettingsShell>
  );
}
