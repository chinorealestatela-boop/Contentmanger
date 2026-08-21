import { requireScope } from "@/lib/queries/scope";
import { getRecentNotifications } from "@/lib/actions/notifications";
import { ClientShell } from "@/components/layout/ClientShell";
import { prisma } from "@/lib/prisma";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const scope = await requireScope();
  const [notifications, user] = await Promise.all([
    getRecentNotifications(),
    prisma.user.findUnique({ where: { id: scope.userId } }),
  ]);

  return (
    <ClientShell
      user={{
        firstName: user?.firstName ?? scope.userName.split(" ")[0],
        lastName: user?.lastName ?? "",
        role: scope.role,
        avatarColor: user?.avatarColor ?? "#2563eb",
        title: user?.title ?? undefined,
      }}
      notifications={notifications.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() }))}
    >
      {children}
    </ClientShell>
  );
}
