import Link from "next/link";
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, isToday, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { formatTime12h } from "@/lib/format";
import { cn } from "@/lib/utils";
import { eventColor } from "@/components/calendar/eventMeta";
import type { CalendarEvent } from "@/lib/queries/calendar";

export function CalendarMonthView({ year, month, events }: { year: number; month: number; events: CalendarEvent[] }) {
  const monthStart = startOfMonth(new Date(year, month, 1));
  const monthEnd = endOfMonth(monthStart);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const byDay = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const key = format(e.date, "yyyy-MM-dd");
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(e);
  }

  const prev = subMonths(monthStart, 1);
  const next = addMonths(monthStart, 1);
  const now = new Date();

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <h2 className="text-[15px] font-semibold">{format(monthStart, "MMMM yyyy")}</h2>
        <div className="flex gap-1.5">
          <Link href={`/calendar?view=month&year=${prev.getFullYear()}&month=${prev.getMonth()}`} className="btn btn-secondary btn-sm">← Prev</Link>
          <Link href={`/calendar?view=month&year=${now.getFullYear()}&month=${now.getMonth()}`} className="btn btn-secondary btn-sm">Today</Link>
          <Link href={`/calendar?view=month&year=${next.getFullYear()}&month=${next.getMonth()}`} className="btn btn-secondary btn-sm">Next →</Link>
        </div>
      </div>
      <div className="grid grid-cols-7 border-b border-[var(--border)] text-center text-[11px] font-semibold text-[var(--text-faint)]">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="py-2">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayEvents = byDay.get(key) ?? [];
          const inMonth = isSameMonth(day, monthStart);
          return (
            <Link
              key={key}
              href={`/calendar?view=day&year=${day.getFullYear()}&month=${day.getMonth()}&day=${day.getDate()}`}
              className={cn("block min-h-[92px] border-b border-r border-[var(--border)] p-1.5 hover:bg-[var(--bg-subtle)]", !inMonth && "bg-[var(--bg-subtle)]")}
            >
              <p className={cn("text-[11px] font-semibold", isToday(day) ? "flex h-5 w-5 items-center justify-center rounded-full bg-[var(--brand)] text-white" : inMonth ? "text-[var(--text)]" : "text-[var(--text-faint)]")}>
                {format(day, "d")}
              </p>
              <div className="mt-1 space-y-0.5">
                {dayEvents.slice(0, 3).map((e) => {
                  const color = eventColor(e.type);
                  return (
                    <span
                      key={e.id}
                      className="block truncate rounded px-1 py-0.5 text-[10px] font-medium"
                      style={{ background: `${color}1a`, color }}
                      title={`${formatTime12h(e.time)} ${e.customerName}`}
                    >
                      {formatTime12h(e.time)} {e.customerName}
                    </span>
                  );
                })}
                {dayEvents.length > 3 && <p className="px-1 text-[10px] text-[var(--text-faint)]">+{dayEvents.length - 3} more</p>}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
