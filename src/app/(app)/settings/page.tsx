import Link from "next/link";
import { User, Lock, Bell, Workflow, Tag, XCircle, Repeat, Zap, Building2, Users, Shield, Plug, Car } from "lucide-react";
import { requireScope } from "@/lib/queries/scope";
import { SettingsShell } from "@/components/settings/SettingsShell";

export default async function SettingsIndexPage() {
  const scope = await requireScope();
  const isAdmin = ["OWNER", "ADMIN"].includes(scope.role);

  const cards = [
    { href: "/settings/profile", icon: User, label: "My Profile", desc: "Name, title, contact info." },
    { href: "/settings/password", icon: Lock, label: "Password", desc: "Change your password." },
    { href: "/settings/notifications", icon: Bell, label: "Notifications", desc: "Choose what you get notified about." },
    { href: "/settings/services", icon: Car, label: "Services & Pricing", desc: "Base rates for the quote builder." },
    { href: "/settings/pipeline-stages", icon: Workflow, label: "Pipeline Stages", desc: "Customize your lead pipeline." },
    { href: "/settings/lead-sources", icon: Tag, label: "Lead Sources", desc: "Manage where leads come from." },
    { href: "/settings/lost-reasons", icon: XCircle, label: "Lost Reasons", desc: "Manage lost lead reasons." },
    { href: "/follow-ups", icon: Repeat, label: "Follow-Ups & Templates", desc: "Automated cadences and messages." },
    { href: "/automations", icon: Zap, label: "Automation Rules", desc: "Configure trigger-based automations." },
    { href: "/settings/integrations", icon: Plug, label: "Integrations", desc: "Optional external connections." },
    ...(isAdmin
      ? [
          { href: "/settings/company", icon: Building2, label: "Company", desc: "Business profile & policies." },
          { href: "/settings/users", icon: Users, label: "Employees", desc: "Manage team accounts." },
          { href: "/settings/roles", icon: Shield, label: "Roles & Permissions", desc: "Configure access levels." },
        ]
      : []),
  ];

  return (
    <SettingsShell isAdmin={isAdmin} title="Settings" subtitle="Manage your account and company configuration.">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {cards.map((c) => (
          <Link key={c.href} href={c.href} className="card card-hover flex items-start gap-3 p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand-bright)]"><c.icon size={17} /></span>
            <div>
              <p className="text-[13.5px] font-semibold text-[var(--text)]">{c.label}</p>
              <p className="text-[12px] text-[var(--text-muted)]">{c.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </SettingsShell>
  );
}
