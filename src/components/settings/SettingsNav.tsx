"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type Item = { href: string; label: string; adminOnly?: boolean };

const ITEMS: Item[] = [
  { href: "/settings/profile", label: "My Profile" },
  { href: "/settings/password", label: "Password" },
  { href: "/settings/notifications", label: "Notification Prefs" },
  { href: "/settings/company", label: "Company", adminOnly: true },
  { href: "/settings/users", label: "Employees", adminOnly: true },
  { href: "/settings/roles", label: "Roles & Permissions", adminOnly: true },
  { href: "/settings/services", label: "Services & Pricing" },
  { href: "/settings/pipeline-stages", label: "Pipeline Stages" },
  { href: "/settings/lead-sources", label: "Lead Sources" },
  { href: "/settings/lost-reasons", label: "Lost Reasons" },
  { href: "/follow-ups", label: "Follow-Ups & Templates" },
  { href: "/automations", label: "Automation Rules" },
  { href: "/settings/integrations", label: "Integrations" },
];

export function SettingsNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  return (
    <nav className="card p-2">
      {ITEMS.filter((i) => !i.adminOnly || isAdmin).map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "block rounded-lg px-3 py-2 text-[13px] font-medium",
            pathname === item.href ? "bg-[var(--brand)] text-[#14120a]" : "text-[var(--text-muted)] hover:bg-white/[0.05] hover:text-[var(--text)]"
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
