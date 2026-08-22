import Link from "next/link";
import { addDays, format, subDays } from "date-fns";
import { EventRow } from "@/components/calendar/EventRow";
import type { CalendarEvent } from "@/lib/queries/calendar";

export function CalendarDayView({ day, events }: { day: Date; events: CalendarEvent[] }) {
  const sorted = [...events].sort((a, b) => a.time.localeCompare(b.time));
  const prev = subDays(day, 1);
  const next = addDays(day, 1);
  const now = new Date();

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <h2 className="text-[15px] font-semibold">{format(day, "EEEE, MMMM d, yyyy")}</h2>
        <div className="flex gap-1.5">
          <Link href={`/calendar?view=day&year=${prev.getFullYear()}&month=${prev.getMonth()}&day=${prev.getDate()}`} className="btn btn-secondary btn-sm">← Prev</Link>
          <Link href={`/calendar?view=day&year=${now.getFullYear()}&month=${now.getMonth()}&day=${now.getDate()}`} className="btn btn-secondary btn-sm">Today</Link>
          <Link href={`/calendar?view=day&year=${next.getFullYear()}&month=${next.getMonth()}&day=${next.getDate()}`} className="btn btn-secondary btn-sm">Next →</Link>
        </div>
      </div>
      <div className="divide-y divide-[var(--border)]">
        {sorted.length === 0 && <p className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">Nothing scheduled for this day.</p>}
        {sorted.map((e) => <EventRow key={e.id} event={e} />)}
      </div>
    </div>
  );
}
