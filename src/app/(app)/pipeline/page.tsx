import Link from "next/link";
import { Plus } from "lucide-react";
import { requireScope } from "@/lib/queries/scope";
import { getPipelineData } from "@/lib/queries/pipeline";
import { KanbanBoard } from "@/components/pipeline/KanbanBoard";

export default async function PipelinePage() {
  const scope = await requireScope();
  const { stages, leads } = await getPipelineData(scope);

  const cardData = leads.map((l) => ({
    id: l.id,
    stageId: l.stageId,
    score: l.score,
    isVip: l.isVip,
    lastContactedAt: l.lastContactedAt ? l.lastContactedAt.toISOString() : null,
    stageEnteredAt: l.stageEnteredAt.toISOString(),
    customer: { id: l.customer.id, firstName: l.customer.firstName, lastName: l.customer.lastName, tier: l.customer.tier },
    serviceRequested: l.serviceRequested,
    vehicleRequested: l.vehicleRequested ?? l.vehicle?.name ?? null,
  }));

  return (
    <div className="space-y-5 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium text-[var(--text)]">Pipeline</h1>
          <p className="text-[13px] text-[var(--text-muted)]">Drag a card to move a lead&rsquo;s stage — automations fire automatically.</p>
        </div>
        <Link href="/leads/new" className="btn btn-primary">
          <Plus size={15} /> New Lead
        </Link>
      </div>
      <KanbanBoard stages={stages} leads={cardData} />
    </div>
  );
}
