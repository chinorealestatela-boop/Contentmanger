import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { TemperatureBadge, Badge } from "@/components/ui/Badge";
import { QuickActions } from "@/components/actions/QuickActions";
import { formatRelativeDay, formatTimeAgo, formatTime12h } from "@/lib/format";
import type { ActionItem } from "@/lib/queries/dashboard";

export function ActionCard({ item }: { item: ActionItem }) {
  const [firstName, ...rest] = item.customerName.split(" ");
  return (
    <div className="card flex flex-col gap-3 p-4 animate-fade-in sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <Avatar firstName={firstName} lastName={rest.join(" ")} size="md" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Link href={`/customers/${item.customerId}`} className="text-[14px] font-semibold text-[var(--text)] hover:text-[var(--brand)]">
              {item.customerName}
            </Link>
            <TemperatureBadge temperature={item.temperature} />
            {item.overdue && <Badge variant="overdue">Overdue</Badge>}
            <span className="text-[11px] font-bold text-[var(--text-faint)]">score {item.score}</span>
          </div>
          <p className="mt-0.5 truncate text-[12.5px] text-[var(--text-muted)]">
            {item.vehicle ?? "No vehicle noted"} {item.stage && <>· {item.stage}</>}
          </p>
          <p className="mt-1 text-[12.5px] font-medium text-[var(--text)]">
            {item.nextAction}
            <span className="ml-1.5 font-normal text-[var(--text-muted)]">
              — due {formatRelativeDay(item.dueDate)}{item.dueTime ? ` at ${formatTime12h(item.dueTime)}` : ""}
            </span>
          </p>
          <p className="mt-0.5 text-[11px] text-[var(--text-faint)]">Last contact: {item.lastContact ? formatTimeAgo(item.lastContact) : "Never"}</p>
        </div>
      </div>
      <QuickActions customerId={item.customerId} leadId={item.leadId} taskId={item.source === "task" ? item.id : undefined} className="sm:justify-end" />
    </div>
  );
}
