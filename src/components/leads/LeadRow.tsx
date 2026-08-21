import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { TemperatureBadge, Badge, ColorPill } from "@/components/ui/Badge";
import { formatRelativeDay, formatTimeAgo } from "@/lib/format";
import { optionLabel, PURCHASE_TIMEFRAMES } from "@/lib/constants";

type LeadWithRelations = {
  id: string;
  score: number;
  temperature: string;
  purchaseTimeframe: string | null;
  lastContactedAt: Date | null;
  nextFollowUpAt: Date | null;
  status: string;
  customer: { id: string; firstName: string; lastName: string; phone: string | null };
  stage: { name: string; color: string };
  source: { name: string } | null;
  assignee: { firstName: string; lastName: string };
  vehicleInterests: { vehicle: { year: number; make: string; model: string } | null; year: number | null; make: string | null; model: string | null }[];
};

export function LeadRow({ lead }: { lead: LeadWithRelations }) {
  const vi = lead.vehicleInterests[0];
  const vehicleLabel = vi ? (vi.vehicle ? `${vi.vehicle.year} ${vi.vehicle.make} ${vi.vehicle.model}` : [vi.year, vi.make, vi.model].filter(Boolean).join(" ")) : null;
  const overdue = lead.nextFollowUpAt && lead.nextFollowUpAt < new Date();

  return (
    <Link href={`/customers/${lead.customer.id}`} className="card flex flex-col gap-3 p-4 hover:shadow-md sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar firstName={lead.customer.firstName} lastName={lead.customer.lastName} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-[14px] font-semibold text-[var(--text)]">{lead.customer.firstName} {lead.customer.lastName}</p>
            <TemperatureBadge temperature={lead.temperature} />
            {overdue && <Badge variant="overdue">Overdue</Badge>}
          </div>
          <p className="mt-0.5 truncate text-[12.5px] text-[var(--text-muted)]">{vehicleLabel ?? "No vehicle noted"}</p>
          <p className="mt-0.5 text-[11.5px] text-[var(--text-faint)]">
            {lead.source?.name ?? "Unknown source"} · {optionLabel(PURCHASE_TIMEFRAMES, lead.purchaseTimeframe)}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 sm:justify-end">
        <ColorPill color={lead.stage.color}>{lead.stage.name}</ColorPill>
        <div className="text-right">
          <p className="text-[11px] text-[var(--text-muted)]">{lead.assignee.firstName} {lead.assignee.lastName}</p>
          <p className="text-[11px] text-[var(--text-faint)]">
            {lead.nextFollowUpAt ? `Follow-up ${formatRelativeDay(lead.nextFollowUpAt)}` : lead.lastContactedAt ? `Last contact ${formatTimeAgo(lead.lastContactedAt)}` : "No contact yet"}
          </p>
        </div>
        <span className="badge badge-neutral tabular-nums">{lead.score}</span>
      </div>
    </Link>
  );
}
