import Link from "next/link";
import { addWeeks, eachDayOfInterval, endOfWeek, format, isToday, startOfWeek, subWeeks } from "date-fns";
import { formatTime12h } from "@/lib/format";
import { cn } from "@/lib/utils";
import { eventColor, eventIcon } from "@/components/calendar/eventMeta";
import type { CalendarEvent } from "@/lib/queries/calendar";

export function CalendarWeekView({ anchor, events }: { anchor: Date; events: CalendarEvent[] }) {
  const weekStart = startOfWeek(anchor);
  const weekEnd = endOfWeek(anchor);
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const now = new Date();

  const byDay = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const key = format(e.date, "yyyy-MM-dd");
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(e);
  }
  for (const list of byDay.values()) list.sort((a, b) => a.time.localeCompare(b.time));

  const prev = subWeeks(weekStart, 1);
  const next = addWeeks(weekStart, 1);

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <h2 className="text-[15px] font-semibold">{format(weekStart, "MMM d")} – {format(weekEnd, "MMM d, yyyy")}</h2>
        <div className="flex gap-1.5">
          <Link href={`/calendar?view=week&year=${prev.getFullYear()}&month=${prev.getMonth()}&day=${prev.getDate()}`} className="btn btn-secondary btn-sm">← Prev</Link>
          <Link href={`/calendar?view=week&year=${now.getFullYear()}&month=${now.getMonth()}&day=${now.getDate()}`} className="btn btn-secondary btn-sm">Today</Link>
          <Link href={`/calendar?view=week&year=${next.getFullYear()}&month=${next.getMonth()}&day=${next.getDate()}`} className="btn btn-secondary btn-sm">Next →</Link>
        </div>
      </div>
      <div className="grid grid-cols-1 divide-y divide-[var(--border)] sm:grid-cols-7 sm:divide-x sm:divide-y-0">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayEvents = byDay.get(key) ?? [];
          return (
            <div key={key} className="min-h-[140px]">
              <Link
                href={`/calendar?view=day&year=${day.getFullYear()}&month=${day.getMonth()}&day=${day.getDate()}`}
                className={cn("flex items-center justify-between border-b border-[var(--border)] px-2 py-2 hover:bg-[var(--bg-subtle)]", isToday(day) && "bg-[var(--brand-soft)]")}
              >
                <span className="text-[11px] font-semibold text-[var(--text-faint)]">{format(day, "EEE")}</span>
                <span className={cn("flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold", isToday(day) ? "bg-[var(--brand)] text-white" : "text-[var(--text)]")}>{format(day, "d")}</span>
              </Link>
              <div className="space-y-1 p-1.5">
                {dayEvents.length === 0 && <p className="px-1 py-2 text-center text-[10.5px] text-[var(--text-faint)]">—</p>}
                {dayEvents.map((e) => {
                  const Icon = eventIcon(e.type);
                  const color = eventColor(e.type);
                  return (
                    <Link
                      key={e.id}
                      href={`/customers/${e.customerId}`}
                      className="flex items-start gap-1 rounded px-1.5 py-1 text-[10.5px] leading-tight hover:opacity-80"
                      style={{ background: `${color}1a`, color }}
                    >
                      <Icon size={11} className="mt-0.5 shrink-0" />
                      <span className="min-w-0">
                        <span className="block font-semibold">{formatTime12h(e.time)}</span>
                        <span className="block truncate">{e.customerName}</span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
