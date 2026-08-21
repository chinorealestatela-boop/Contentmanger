import { requireScope } from "@/lib/queries/scope";
import { prisma } from "@/lib/prisma";
import { SettingsShell } from "@/components/settings/SettingsShell";
import { NotificationPrefsForm } from "@/components/settings/NotificationPrefsForm";

export default async function NotificationSettingsPage() {
  const scope = await requireScope();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: scope.userId } });
  let prefs: Record<string, boolean> = {};
  try {
    prefs = user.notificationPrefs ? JSON.parse(user.notificationPrefs) : {};
  } catch {
    prefs = {};
  }

  return (
    <SettingsShell isAdmin={scope.role === "ADMIN"} title="Notifications" subtitle="Choose which events notify you in-app.">
      <div className="card max-w-lg p-5"><NotificationPrefsForm initial={prefs} /></div>
    </SettingsShell>
  );
}
