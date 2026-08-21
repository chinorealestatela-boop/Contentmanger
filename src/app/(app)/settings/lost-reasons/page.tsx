import { requireScope } from "@/lib/queries/scope";
import { prisma } from "@/lib/prisma";
import { SettingsShell } from "@/components/settings/SettingsShell";
import { ToggleListSettings } from "@/components/settings/ToggleListSettings";
import { createLostReason, toggleLostReason } from "@/lib/actions/settings";

export default async function LostReasonsSettingsPage() {
  const scope = await requireScope();
  const reasons = await prisma.lostReason.findMany({ orderBy: { order: "asc" } });

  return (
    <SettingsShell isAdmin={scope.role === "ADMIN"} title="Lost Reasons" subtitle="Reasons available when marking a lead lost.">
      <ToggleListSettings items={reasons} createAction={createLostReason} toggleAction={toggleLostReason} placeholder="New lost reason" />
    </SettingsShell>
  );
}
