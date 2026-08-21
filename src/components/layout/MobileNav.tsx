"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Kanban, CheckSquare, Users, Menu, type LucideIcon } from "lucide-react";
import { MOBILE_NAV_ITEMS } from "@/lib/nav";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = { LayoutDashboard, Kanban, CheckSquare, Users, Menu };

export function MobileNav({ onMore }: { onMore: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 flex border-t border-[var(--border)] bg-[var(--bg-elevated)] pb-[env(safe-area-inset-bottom)] lg:hidden">
      {MOBILE_NAV_ITEMS.map((item) => {
        const Icon = ICONS[item.icon];
        const active = pathname === item.href;
        if (item.href === "/more") {
          return (
            <button key="more" onClick={onMore} className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium text-[var(--text-muted)]">
              {Icon && <Icon size={20} />}
              {item.label}
            </button>
          );
        }
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn("flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium", active ? "text-[var(--brand)]" : "text-[var(--text-muted)]")}
          >
            {Icon && <Icon size={20} />}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
