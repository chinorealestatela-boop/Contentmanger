import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { formatTimeAgo } from "@/lib/format";
import { optionLabel, PURCHASE_TIMEFRAMES } from "@/lib/constants";
import type { HotLeadItem } from "@/lib/queries/dashboard";

export function HotLeadRow({ item, rank }: { item: HotLeadItem; rank: number }) {
  const [firstName, ...rest] = item.customerName.split(" ");
  return (
    <Link
      href={`/customers/${item.customerId}`}
      className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3 last:border-0 hover:bg-[var(--bg-subtle)]"
    >
      <span className="w-4 shrink-0 text-center text-xs font-bold text-[var(--text-faint)]">{rank}</span>
      <Avatar firstName={firstName} lastName={rest.join(" ")} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-[var(--text)]">{item.customerName}</p>
        <p className="truncate text-[11.5px] text-[var(--text-muted)]">{item.vehicle ?? "No vehicle noted"}</p>
      </div>
      <div className="hidden shrink-0 text-right sm:block">
        <p className="text-[11px] text-[var(--text-muted)]">{optionLabel(PURCHASE_TIMEFRAMES, item.purchaseTimeframe)}</p>
        <p className="text-[11px] text-[var(--text-faint)]">{item.lastContact ? formatTimeAgo(item.lastContact) : "Never contacted"}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {item.hasAppointment && <Badge variant="appointment">Appt</Badge>}
        {item.hasTrade && <Badge variant="neutral">Trade</Badge>}
        <span className="badge badge-hot">{item.score}</span>
      </div>
    </Link>
  );
}
