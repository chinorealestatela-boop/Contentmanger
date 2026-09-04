"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  UserPlus,
  Users,
  Kanban,
  CheckSquare,
  CalendarClock,
  Car,
  ArrowLeftRight,
  MessageSquare,
  Workflow,
  XCircle,
  RefreshCcw,
  BarChart3,
  Zap,
  Settings as SettingsIcon,
  Sparkles,
  Inbox,
  type LucideIcon,
} from "lucide-react";
import { NAV_ITEMS } from "@/lib/nav";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  UserPlus,
  Users,
  Kanban,
  CheckSquare,
  CalendarClock,
  Car,
  ArrowLeftRight,
  MessageSquare,
  Workflow,
  XCircle,
  RefreshCcw,
  BarChart3,
  Zap,
  Settings: SettingsIcon,
  Inbox,
};

export function Sidebar({ onNavigate, onOpenAssistant }: { onNavigate?: () => void; onOpenAssistant?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex h-full flex-col bg-[var(--sidebar-bg)] text-[var(--sidebar-text)]">
      <Link href="/dashboard" className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--brand)] font-bold text-white">D</div>
        <span className="text-[15px] font-semibold text-[var(--sidebar-text-active)]">Driveline CRM</span>
      </Link>

      <div className="flex-1 overflow-y-auto scrollbar-none px-3 pb-3">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const Icon = ICONS[item.icon];
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors",
                    active
                      ? "bg-[var(--brand)] text-white"
                      : "text-[var(--sidebar-text)] hover:bg-[var(--sidebar-bg-hover)] hover:text-[var(--sidebar-text-active)]"
                  )}
                >
                  {Icon && <Icon size={17} strokeWidth={2} className="shrink-0" />}
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="border-t border-[var(--sidebar-border)] p-3">
        <button
          onClick={onOpenAssistant}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium text-[var(--sidebar-text)] transition-colors hover:bg-[var(--sidebar-bg-hover)] hover:text-[var(--sidebar-text-active)]"
        >
          <Sparkles size={17} className="shrink-0 text-amber-400" />
          Ask AI Assistant
        </button>
      </div>
    </nav>
  );
}
