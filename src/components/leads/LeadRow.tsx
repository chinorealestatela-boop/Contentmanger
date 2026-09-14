import Link from "next/link";
import { Star } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, ColorPill, TierBadge } from "@/components/ui/Badge";
import { formatRelativeDay, formatTimeAgo } from "@/lib/format";

type LeadWithRelations = {
  id: string;
  score: number;
  isVip: boolean;
  serviceRequested: string | null;
  lastContactedAt: Date | null;
  nextFollowUpAt: Date | null;
  status: string;
  customer: { id: string; firstName: string; lastName: string; phone: string | null; tier: string };
  stage: { name: string; color: string };
  source: { name: string } | null;
  assignee: { firstName: string; lastName: string } | null;
  vehicle: { name: string } | null;
  vehicleRequested: string | null;
};

export function LeadRow({ lead }: { lead: LeadWithRelations }) {
  const vehicleLabel = lead.vehicle?.name ?? lead.vehicleRequested;
  const overdue = lead.nextFollowUpAt && lead.nextFollowUpAt < new Date();

  return (
    <Link href={`/leads/${lead.id}`} className="card card-hover flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar firstName={lead.customer.firstName} lastName={lead.customer.lastName} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-[14px] font-semibold text-[var(--text)]">{lead.customer.firstName} {lead.customer.lastName}</p>
            {lead.customer.tier !== "STANDARD" && <TierBadge tier={lead.customer.tier} />}
            {lead.isVip && <Star size={13} className="text-[var(--brand-bright)]" fill="currentColor" />}
            {overdue && <Badge variant="danger">Follow-up overdue</Badge>}
          </div>
          <p className="mt-0.5 truncate text-[12.5px] text-[var(--text-muted)]">{lead.serviceRequested ?? "Inquiry"} {vehicleLabel ? `· ${vehicleLabel}` : ""}</p>
          <p className="mt-0.5 text-[11.5px] text-[var(--text-faint)]">{lead.source?.name ?? "Unknown source"}</p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 sm:justify-end">
        <ColorPill color={lead.stage.color}>{lead.stage.name}</ColorPill>
        <div className="text-right">
          <p className="text-[11px] text-[var(--text-muted)]">{lead.assignee ? `${lead.assignee.firstName} ${lead.assignee.lastName}` : "Unassigned"}</p>
          <p className="text-[11px] text-[var(--text-faint)]">
            {lead.nextFollowUpAt ? `Follow-up ${formatRelativeDay(lead.nextFollowUpAt)}` : lead.lastContactedAt ? `Last contact ${formatTimeAgo(lead.lastContactedAt)}` : "No contact yet"}
          </p>
        </div>
        <span className="badge badge-gold tabular-nums">{lead.score}</span>
      </div>
    </Link>
  );
}
