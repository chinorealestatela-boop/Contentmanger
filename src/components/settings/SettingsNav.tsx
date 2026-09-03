"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type Item = { href: string; label: string; adminOnly?: boolean };

const ITEMS: Item[] = [
  { href: "/settings/profile", label: "My Profile" },
  { href: "/settings/password", label: "Password" },
  { href: "/settings/notifications", label: "Notifications" },
  { href: "/settings/pipeline-stages", label: "Sales Stages" },
  { href: "/settings/lead-sources", label: "Lead Sources" },
  { href: "/settings/lost-reasons", label: "Lost Reasons" },
  { href: "/follow-up-sequences", label: "Follow-Up Sequences" },
  { href: "/automations", label: "Automation Rules" },
  { href: "/settings/dealership", label: "Dealership", adminOnly: true },
  { href: "/settings/booking", label: "Booking & Hours", adminOnly: true },
  { href: "/settings/users", label: "User Management", adminOnly: true },
  { href: "/settings/roles", label: "Roles & Permissions", adminOnly: true },
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
            pathname === item.href ? "bg-[var(--brand)] text-white" : "text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text)]"
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
