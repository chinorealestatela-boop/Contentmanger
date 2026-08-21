import { requireScope } from "@/lib/queries/scope";
import { prisma } from "@/lib/prisma";
import { SettingsShell } from "@/components/settings/SettingsShell";
import { ProfileForm } from "@/components/settings/ProfileForm";

export default async function ProfileSettingsPage() {
  const scope = await requireScope();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: scope.userId } });

  return (
    <SettingsShell isAdmin={scope.role === "ADMIN"} title="My Profile" subtitle="Update your personal information.">
      <div className="card max-w-lg p-5"><ProfileForm user={user} /></div>
    </SettingsShell>
  );
}
