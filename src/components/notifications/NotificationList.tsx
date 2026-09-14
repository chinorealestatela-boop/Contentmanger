"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/actions/notifications";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type NotificationDTO = { id: string; type: string; title: string; body: string | null; link: string | null; isRead: boolean; createdAt: string };

export function NotificationList({ initial }: { initial: NotificationDTO[] }) {
  const [notifications, setNotifications] = useState(initial);
  const [, startTransition] = useTransition();
  const unread = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <span className="text-[13px] font-semibold text-[var(--text)]">{unread} unread</span>
        {unread > 0 && (
          <button
            className="text-xs font-medium text-[var(--brand-bright)] hover:underline"
            onClick={() => {
              setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
              startTransition(() => markAllNotificationsRead());
            }}
          >
            Mark all read
          </button>
        )}
      </div>
      <div className="divide-y divide-[var(--border)]">
        {notifications.length === 0 && <p className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">Nothing here yet.</p>}
        {notifications.map((n) => (
          <Link
            key={n.id}
            href={n.link ?? "/dashboard"}
            onClick={() => {
              setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
              startTransition(() => markNotificationRead(n.id));
            }}
            className={cn("flex items-start gap-2 px-4 py-3 hover:bg-white/[0.03]", !n.isRead && "bg-[var(--brand-soft)]/40")}
          >
            {!n.isRead && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand-bright)]" />}
            <div className={cn("min-w-0", n.isRead && "pl-3.5")}>
              <p className="text-[13.5px] font-semibold text-[var(--text)]">{n.title}</p>
              {n.body && <p className="mt-0.5 text-[12.5px] text-[var(--text-muted)]">{n.body}</p>}
              <p className="mt-1 text-[11px] text-[var(--text-faint)]">{formatDateTime(n.createdAt)}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
