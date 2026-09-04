"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Bell, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTimeAgo } from "@/lib/format";
import { markAllNotificationsRead, markNotificationRead, deleteNotification } from "@/lib/actions/notifications";

export type NotificationDTO = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  isRead: boolean;
  createdAt: string;
};

export function NotificationBell({ initial }: { initial: NotificationDTO[] }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState(initial);
  const [, startTransition] = useTransition();
  const unread = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text)]"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="animate-fade-in absolute right-0 z-40 mt-2 w-80 max-w-[90vw] rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-lg">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
              <span className="text-sm font-semibold">Notifications</span>
              {unread > 0 && (
                <button
                  className="text-xs font-medium text-[var(--brand)] hover:underline"
                  onClick={() => {
                    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
                    startTransition(() => markAllNotificationsRead());
                  }}
                >
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 && (
                <p className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">You&rsquo;re all caught up.</p>
              )}
              {notifications.map((n) => (
                <div key={n.id} className={cn("group relative border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-subtle)]", !n.isRead && "bg-[var(--brand-soft)]/40")}>
                  <Link
                    href={n.link ?? "/dashboard"}
                    onClick={() => {
                      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
                      startTransition(() => markNotificationRead(n.id));
                      setOpen(false);
                    }}
                    className="block px-4 py-3 pr-9"
                  >
                    <div className="flex items-start gap-2">
                      {!n.isRead && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand)]" />}
                      <div className={cn("min-w-0", n.isRead && "pl-3.5")}>
                        <p className="text-[13px] font-semibold text-[var(--text)]">{n.title}</p>
                        {n.body && <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{n.body}</p>}
                        <p className="mt-1 text-[11px] text-[var(--text-faint)]">{formatTimeAgo(n.createdAt)}</p>
                      </div>
                    </div>
                  </Link>
                  <button
                    type="button"
                    aria-label="Delete notification"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setNotifications((prev) => prev.filter((x) => x.id !== n.id));
                      startTransition(() => deleteNotification(n.id));
                    }}
                    className="absolute right-2 top-3 flex h-6 w-6 items-center justify-center rounded-md text-[var(--text-faint)] opacity-0 hover:bg-[var(--bg-elevated)] hover:text-[var(--danger)] group-hover:opacity-100"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
