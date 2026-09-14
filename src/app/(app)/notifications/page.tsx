import { requireScope } from "@/lib/queries/scope";
import { prisma } from "@/lib/prisma";
import { NotificationList } from "@/components/notifications/NotificationList";

export default async function NotificationsPage() {
  const scope = await requireScope();
  const notifications = await prisma.notification.findMany({ where: { userId: scope.userId }, orderBy: { createdAt: "desc" }, take: 100 });

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="font-display text-3xl font-medium text-[var(--text)]">Notifications</h1>
        <p className="text-[13px] text-[var(--text-muted)]">Every alert the CRM has surfaced for you — new leads, payments, driver and vehicle issues, follow-ups due.</p>
      </div>
      <NotificationList
        initial={notifications.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() }))}
      />
      <div className="card flex items-start gap-3 p-4 text-[12.5px] text-[var(--text-muted)]">
        <p>
          Push, SMS, and email delivery for these alerts are architected in <code className="text-[var(--text)]">src/lib/integrations/messaging.ts</code> and ready to connect once Twilio/SendGrid/a push provider is added in Settings → Integrations. In-app notifications always work without any of that.
        </p>
      </div>
    </div>
  );
}
