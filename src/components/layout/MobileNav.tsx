"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, UserPlus, CalendarCheck, Car, Menu, type LucideIcon } from "lucide-react";
import { MOBILE_NAV_ITEMS } from "@/lib/nav";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = { LayoutDashboard, UserPlus, CalendarCheck, Car, Menu };

export function MobileNav({ onMore }: { onMore: () => void }) {
  const pathname = usePathname();
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 flex pb-[env(safe-area-inset-bottom)] lg:hidden"
      style={{ background: "rgba(10,10,11,0.85)", backdropFilter: "blur(20px)", borderTop: "1px solid var(--border)" }}
    >
      {MOBILE_NAV_ITEMS.map((item) => {
        const Icon = ICONS[item.icon];
        const active = pathname === item.href;
        if (item.href === "/more") {
          return (
            <button key="more" onClick={onMore} className="flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium text-[var(--text-muted)]">
              {Icon && <Icon size={19} strokeWidth={1.75} />}
              {item.label}
            </button>
          );
        }
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn("flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium", active ? "text-[var(--brand-bright)]" : "text-[var(--text-muted)]")}
          >
            {Icon && <Icon size={19} strokeWidth={1.75} />}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
