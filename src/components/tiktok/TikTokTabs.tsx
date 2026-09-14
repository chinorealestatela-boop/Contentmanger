"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function TikTokTabs({ pendingReview }: { pendingReview: number }) {
  const pathname = usePathname();
  const items = [
    { href: "/tiktok", label: "Inbox" },
    { href: "/tiktok/review", label: "Human Review", count: pendingReview },
    { href: "/tiktok/training", label: "Training Center" },
    { href: "/tiktok/settings", label: "Settings" },
  ];
  return (
    <div className="flex flex-wrap gap-1 border-b border-[var(--border)]">
      {items.map((item) => {
        const active = item.href === "/tiktok" ? pathname === "/tiktok" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-1.5 rounded-t-lg px-3.5 py-2.5 text-[13px] font-medium",
              active ? "border-b-2 border-[var(--brand)] text-[var(--brand)]" : "text-[var(--text-muted)] hover:text-[var(--text)]"
            )}
          >
            {item.label}
            {!!item.count && <span className="badge badge-overdue">{item.count}</span>}
          </Link>
        );
      })}
    </div>
  );
}
