import Link from "next/link";
import { CalendarCheck, PhoneCall } from "lucide-react";
import { optionLabel, BOOKING_STATUSES, FOLLOWUP_STATUSES } from "@/lib/constants";
import { formatDate, formatTime12h } from "@/lib/format";
import { eventColor } from "@/components/calendar/eventMeta";
import type { CalendarEvent } from "@/lib/queries/calendar";

export function EventRow({ event, showDate = false }: { event: CalendarEvent; showDate?: boolean }) {
  const color = eventColor(event);
  const statusLabel = event.kind === "followup" ? optionLabel(FOLLOWUP_STATUSES, event.status) : optionLabel(BOOKING_STATUSES, event.status);
  const href = event.kind === "booking" ? `/bookings/${event.id}` : `/customers/${event.customerId}`;

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03]">
      <Link href={href} className="flex min-w-0 flex-1 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: `${color}22`, color }}>
          {event.kind === "followup" ? <PhoneCall size={16} /> : <CalendarCheck size={16} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-[13.5px] font-semibold text-[var(--text)]">{event.customerName}</p>
            <span className="shrink-0 text-[12px] font-semibold tabular-nums text-[var(--text)]">
              {showDate ? `${formatDate(event.date, "MMM d")} · ` : ""}{formatTime12h(event.time)}{event.endTime ? `–${formatTime12h(event.endTime)}` : ""}
            </span>
          </div>
          <p className="truncate text-[12px] text-[var(--text-muted)]">
            {event.title}{event.subtitle ? ` · ${event.subtitle}` : ""}
          </p>
        </div>
      </Link>
      <div className="shrink-0">
        <span className="badge" style={{ background: `${color}22`, color }}>{statusLabel}</span>
      </div>
    </div>
  );
}
