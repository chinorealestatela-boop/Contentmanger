import { redirect } from "next/navigation";
import { requireScope } from "@/lib/queries/scope";
import { prisma } from "@/lib/prisma";
import { SettingsShell } from "@/components/settings/SettingsShell";
import { CompanyForm } from "@/components/settings/CompanyForm";

export default async function CompanySettingsPage() {
  const scope = await requireScope();
  if (!["OWNER", "ADMIN", "MANAGER"].includes(scope.role)) redirect("/settings");

  const setting = await prisma.setting.findUnique({ where: { key: "company" } });
  const initial = setting ? JSON.parse(setting.value) : { name: "Stratos Exotics & Lifestyle" };

  return (
    <SettingsShell isAdmin={["OWNER", "ADMIN"].includes(scope.role)} title="Company" subtitle="Business profile, policies, and terms shown across the CRM and on client-facing quotes.">
      <div className="card max-w-xl p-5"><CompanyForm initial={initial} /></div>
    </SettingsShell>
  );
}
