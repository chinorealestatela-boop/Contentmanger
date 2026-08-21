import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { TemperatureBadge, Badge } from "@/components/ui/Badge";
import { formatTimeAgo } from "@/lib/format";
import { ColorPill } from "@/components/ui/Badge";

type CustomerWithLead = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  updatedAt: Date;
  owner: { firstName: string; lastName: string };
  leads: { temperature: string; score: number; status: string; stage: { name: string; color: string }; nextFollowUpAt: Date | null; lastContactedAt: Date | null }[];
  vehicleInterests: { vehicle: { year: number; make: string; model: string } | null; year: number | null; make: string | null; model: string | null }[];
};

export function CustomerRow({ customer }: { customer: CustomerWithLead }) {
  const lead = customer.leads[0];
  const vi = customer.vehicleInterests[0];
  const vehicleLabel = vi ? (vi.vehicle ? `${vi.vehicle.year} ${vi.vehicle.make} ${vi.vehicle.model}` : [vi.year, vi.make, vi.model].filter(Boolean).join(" ")) : null;
  const overdue = lead?.nextFollowUpAt && lead.nextFollowUpAt < new Date() && lead.status === "ACTIVE";

  return (
    <Link href={`/customers/${customer.id}`} className="card flex flex-col gap-3 p-4 hover:shadow-md sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar firstName={customer.firstName} lastName={customer.lastName} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-[14px] font-semibold text-[var(--text)]">{customer.firstName} {customer.lastName}</p>
            {lead && <TemperatureBadge temperature={lead.temperature} />}
            {lead?.status === "SOLD" && <Badge variant="sold">Sold</Badge>}
            {lead?.status === "LOST" && <Badge variant="lost">Lost</Badge>}
            {overdue && <Badge variant="overdue">Overdue</Badge>}
          </div>
          <p className="mt-0.5 truncate text-[12.5px] text-[var(--text-muted)]">
            {customer.phone ?? "—"} {customer.email ? `· ${customer.email}` : ""}
          </p>
          <p className="mt-0.5 truncate text-[12px] text-[var(--text-faint)]">{vehicleLabel ?? "No vehicle noted"}</p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 sm:justify-end">
        {lead && <ColorPill color={lead.stage.color}>{lead.stage.name}</ColorPill>}
        <div className="text-right">
          <p className="text-[11px] text-[var(--text-muted)]">{customer.owner.firstName} {customer.owner.lastName}</p>
          <p className="text-[11px] text-[var(--text-faint)]">Updated {formatTimeAgo(customer.updatedAt)}</p>
        </div>
        {lead && <span className="badge badge-neutral tabular-nums">{lead.score}</span>}
      </div>
    </Link>
  );
}
