import { requireScope } from "@/lib/queries/scope";
import { prisma } from "@/lib/prisma";
import { SettingsShell } from "@/components/settings/SettingsShell";
import { PipelineStagesSettings } from "@/components/settings/PipelineStagesSettings";

export default async function PipelineStagesSettingsPage() {
  const scope = await requireScope();
  const stages = await prisma.pipelineStage.findMany({ orderBy: { order: "asc" } });

  return (
    <SettingsShell isAdmin={["OWNER", "ADMIN"].includes(scope.role)} title="Sales Stages" subtitle="Customize your pipeline — order, color, and closed-won/lost behavior.">
      <PipelineStagesSettings stages={stages} />
    </SettingsShell>
  );
}
