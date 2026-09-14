import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { formatTimeAgo, fullName } from "@/lib/format";

export function VipLeadRow({
  lead,
  rank,
}: {
  lead: { id: string; score: number; serviceRequested: string | null; lastContactedAt: Date | null; customer: { firstName: string; lastName: string }; stage: { name: string } };
  rank: number;
}) {
  return (
    <Link href={`/leads/${lead.id}`} className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3 last:border-0 hover:bg-white/[0.03]">
      <span className="w-4 shrink-0 text-center text-xs font-bold text-[var(--text-faint)]">{rank}</span>
      <Avatar firstName={lead.customer.firstName} lastName={lead.customer.lastName} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-[var(--text)]">{fullName(lead.customer)}</p>
        <p className="truncate text-[11.5px] text-[var(--text-muted)]">{lead.serviceRequested ?? lead.stage.name}</p>
      </div>
      <div className="hidden shrink-0 text-right sm:block">
        <p className="text-[11px] text-[var(--text-faint)]">{lead.lastContactedAt ? formatTimeAgo(lead.lastContactedAt) : "Not contacted"}</p>
      </div>
      <span className="badge badge-gold shrink-0">{lead.score}</span>
    </Link>
  );
}
