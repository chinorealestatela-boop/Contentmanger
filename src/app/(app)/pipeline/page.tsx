import Link from "next/link";
import { Plus } from "lucide-react";
import { requireScope } from "@/lib/queries/scope";
import { getPipelineData } from "@/lib/queries/pipeline";
import { KanbanBoard } from "@/components/pipeline/KanbanBoard";

export default async function PipelinePage() {
  const scope = await requireScope();
  const { stages, leads } = await getPipelineData(scope);

  const cardData = leads.map((l) => {
    const vi = l.vehicleInterests[0];
    return {
      id: l.id,
      stageId: l.stageId,
      score: l.score,
      temperature: l.temperature,
      lastContactedAt: l.lastContactedAt ? l.lastContactedAt.toISOString() : null,
      nextFollowUpAt: l.nextFollowUpAt ? l.nextFollowUpAt.toISOString() : null,
      stageEnteredAt: l.stageEnteredAt.toISOString(),
      customer: { id: l.customer.id, firstName: l.customer.firstName, lastName: l.customer.lastName },
      vehicle: vi ? (vi.vehicle ? `${vi.vehicle.year} ${vi.vehicle.make} ${vi.vehicle.model}` : [vi.year, vi.make, vi.model].filter(Boolean).join(" ")) : null,
      hasAppointment: l.customer.appointments.length > 0,
    };
  });

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text)]">Pipeline</h1>
          <p className="text-[13px] text-[var(--text-muted)]">Drag a card to move a customer&rsquo;s stage — automations fire automatically.</p>
        </div>
        <Link href="/leads/new" className="btn btn-primary">
          <Plus size={15} /> New Lead
        </Link>
      </div>
      <KanbanBoard stages={stages} leads={cardData} />
    </div>
  );
}
