import { requireScope } from "@/lib/queries/scope";
import { prisma } from "@/lib/prisma";
import { SettingsShell } from "@/components/settings/SettingsShell";
import { NotificationPrefsForm } from "@/components/settings/NotificationPrefsForm";
import { NotifyContactForm } from "@/components/settings/NotifyContactForm";
import { PushSubscribeButton } from "@/components/settings/PushSubscribeButton";

export default async function NotificationSettingsPage() {
  const scope = await requireScope();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: scope.userId } });
  let prefs: Record<string, { push?: boolean; sms?: boolean; email?: boolean }> = {};
  try {
    prefs = user.notificationPrefs ? JSON.parse(user.notificationPrefs) : {};
  } catch {
    prefs = {};
  }

  return (
    <SettingsShell isAdmin={scope.role === "ADMIN"} title="Notifications" subtitle="Choose exactly how you're alerted — in-app, push, text, or email — for each type of event.">
      <div className="card max-w-lg space-y-3 p-5">
        <p className="text-[13px] font-semibold text-[var(--text)]">Push Notifications</p>
        <p className="text-[12.5px] text-[var(--text-muted)]">Get a real push alert on this phone/browser, even when the CRM isn&rsquo;t open.</p>
        <PushSubscribeButton />
      </div>

      <div className="card max-w-lg p-5">
        <p className="mb-3 text-[13px] font-semibold text-[var(--text)]">Alert Destinations</p>
        <NotifyContactForm notifyPhone={user.notifyPhone ?? ""} notifyEmail={user.notifyEmail ?? ""} fallbackPhone={user.phone ?? ""} fallbackEmail={user.email} />
      </div>

      <div className="card max-w-lg p-5">
        <p className="mb-1 text-[13px] font-semibold text-[var(--text)]">Notify Me By</p>
        <p className="mb-3 text-[12.5px] text-[var(--text-muted)]">Every event always shows up in the bell — these choose which ones also push/text/email you.</p>
        <NotificationPrefsForm initial={prefs} />
      </div>
    </SettingsShell>
  );
}
