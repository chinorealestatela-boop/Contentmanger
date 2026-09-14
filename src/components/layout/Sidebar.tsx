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
  CalendarCheck,
  Car,
  MapPin,
  IdCard,
  CreditCard,
  FileText,
  Radar,
  Workflow,
  BarChart3,
  Zap,
  Settings as SettingsIcon,
  Sparkles,
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
  CalendarCheck,
  Car,
  MapPin,
  IdCard,
  CreditCard,
  FileText,
  Radar,
  Workflow,
  BarChart3,
  Zap,
  Settings: SettingsIcon,
};

export function Sidebar({ onNavigate, onOpenAssistant }: { onNavigate?: () => void; onOpenAssistant?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex h-full flex-col text-[var(--sidebar-text)]" style={{ background: "var(--sidebar-bg)", backdropFilter: "blur(24px)", borderRight: "1px solid var(--sidebar-border)" }}>
      <Link href="/dashboard" className="flex items-center gap-3 px-5 py-6">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--brand-line)] font-display text-base text-[var(--brand-bright)]">S</div>
        <div className="min-w-0 leading-tight">
          <div className="font-display text-[15px] tracking-wide text-[var(--sidebar-text-active)]">STRATOS EXOTICS</div>
          <div className="text-[9px] font-medium uppercase tracking-[0.2em] text-[var(--text-faint)]">&amp; Lifestyle</div>
        </div>
      </Link>

      <div className="hairline mx-5" />

      <div className="flex-1 overflow-y-auto scrollbar-none px-3 py-3">
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
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
                    active
                      ? "bg-[var(--brand-soft)] text-[var(--brand-bright)] border border-[var(--brand-line)]"
                      : "border border-transparent text-[var(--sidebar-text)] hover:bg-white/[0.04] hover:text-[var(--sidebar-text-active)]"
                  )}
                >
                  {Icon && <Icon size={16} strokeWidth={1.75} className="shrink-0" />}
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
          className="flex w-full items-center gap-3 rounded-lg border border-[var(--brand-line)] bg-[var(--brand-soft)] px-3 py-2.5 text-[13px] font-medium text-[var(--brand-bright)] transition-colors hover:bg-[var(--brand-soft)]/80"
        >
          <Sparkles size={16} className="shrink-0" />
          Ask the AI Assistant
        </button>
      </div>
    </nav>
  );
}
