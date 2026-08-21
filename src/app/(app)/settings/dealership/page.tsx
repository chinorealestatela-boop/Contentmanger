import { redirect } from "next/navigation";
import { requireScope } from "@/lib/queries/scope";
import { prisma } from "@/lib/prisma";
import { SettingsShell } from "@/components/settings/SettingsShell";
import { DealershipForm } from "@/components/settings/DealershipForm";

export default async function DealershipSettingsPage() {
  const scope = await requireScope();
  if (scope.role === "SALESPERSON") redirect("/settings");

  const setting = await prisma.setting.findUnique({ where: { key: "dealership" } });
  const initial = setting ? JSON.parse(setting.value) : { name: "" };

  return (
    <SettingsShell isAdmin={scope.role === "ADMIN"} title="Dealership" subtitle="Business profile shown across the CRM.">
      <div className="card max-w-lg p-5"><DealershipForm initial={initial} /></div>
    </SettingsShell>
  );
}
