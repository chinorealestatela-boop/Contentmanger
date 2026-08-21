import { requireScope } from "@/lib/queries/scope";
import { prisma } from "@/lib/prisma";
import { SettingsShell } from "@/components/settings/SettingsShell";
import { ToggleListSettings } from "@/components/settings/ToggleListSettings";
import { createLeadSource, toggleLeadSource } from "@/lib/actions/settings";

export default async function LeadSourcesSettingsPage() {
  const scope = await requireScope();
  const sources = await prisma.leadSource.findMany({ orderBy: { order: "asc" } });

  return (
    <SettingsShell isAdmin={scope.role === "ADMIN"} title="Lead Sources" subtitle="Where your leads come from. Inactive sources are hidden from new-lead forms but stay on historical records.">
      <ToggleListSettings items={sources} createAction={createLeadSource} toggleAction={toggleLeadSource} placeholder="New lead source name" />
    </SettingsShell>
  );
}
