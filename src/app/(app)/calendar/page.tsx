import Link from "next/link";
import { Plus } from "lucide-react";
import { startOfDay, endOfDay, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays } from "date-fns";
import { requireScope } from "@/lib/queries/scope";
import { ensureFollowUpsFresh } from "@/lib/queries/followups";
import { getCalendarEvents, getPastEvents } from "@/lib/queries/calendar";
import { CalendarMonthView } from "@/components/calendar/CalendarMonthView";
import { CalendarWeekView } from "@/components/calendar/CalendarWeekView";
import { CalendarDayView } from "@/components/calendar/CalendarDayView";
import { EventRow } from "@/components/calendar/EventRow";
import { cn } from "@/lib/utils";

type View = "month" | "week" | "day" | "upcoming" | "today" | "past";

const VIEWS: { value: View; label: string }[] = [
  { value: "month", label: "Month" },
  { value: "week", label: "Week" },
  { value: "day", label: "Day" },
  { value: "today", label: "Today" },
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past" },
];

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; year?: string; month?: string; day?: string }>;
}) {
  const sp = await searchParams;
  const scope = await requireScope();
  await ensureFollowUpsFresh();

  const now = new Date();
  const year = sp.year ? Number(sp.year) : now.getFullYear();
  const month = sp.month ? Number(sp.month) : now.getMonth();
  const day = sp.day ? Number(sp.day) : now.getDate();
  const anchor = new Date(year, month, day);
  const view: View = (VIEWS.find((v) => v.value === sp.view)?.value ?? "month");

  let content: React.ReactNode;

  if (view === "month") {
    const events = await getCalendarEvents(scope, { start: startOfWeek(startOfMonth(anchor)), end: endOfWeek(endOfMonth(anchor)) });
    content = <CalendarMonthView year={year} month={month} events={events} />;
  } else if (view === "week") {
    const events = await getCalendarEvents(scope, { start: startOfWeek(anchor), end: endOfWeek(anchor) });
    content = <CalendarWeekView anchor={anchor} events={events} />;
  } else if (view === "day") {
    const events = await getCalendarEvents(scope, { start: startOfDay(anchor), end: endOfDay(anchor) });
    content = <CalendarDayView day={anchor} events={events} />;
  } else if (view === "today") {
    const events = await getCalendarEvents(scope, { start: startOfDay(now), end: endOfDay(now) });
    content = <ListCard title="Today's Activities" empty="Nothing scheduled for today." events={events} />;
  } else if (view === "upcoming") {
    const events = await getCalendarEvents(scope, { start: startOfDay(now), end: endOfDay(addDays(now, 90)) });
    content = <ListCard title="Upcoming Activities" empty="Nothing scheduled in the next 90 days." events={events} showDate />;
  } else {
    const events = await getPastEvents(scope, 50);
    content = <ListCard title="Past Activities" empty="No past activity yet." events={events} showDate />;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text)]">Calendar</h1>
          <p className="text-[13px] text-[var(--text-muted)]">Every follow-up call, test drive, and appointment in one place.</p>
        </div>
        <Link href="/appointments/new" className="btn btn-primary"><Plus size={15} /> Add to Calendar</Link>
      </div>

      <div className="flex flex-wrap gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-1">
        {VIEWS.map((v) => (
          <Link
            key={v.value}
            href={`/calendar?view=${v.value}&year=${year}&month=${month}&day=${day}`}
            className={cn(
              "rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors",
              view === v.value ? "bg-[var(--brand)] text-white" : "text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]"
            )}
          >
            {v.label}
          </Link>
        ))}
      </div>

      {content}
    </div>
  );
}

function ListCard({ title, empty, events, showDate }: { title: string; empty: string; events: Awaited<ReturnType<typeof getCalendarEvents>>; showDate?: boolean }) {
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-[var(--border)] px-4 py-3">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        <p className="text-[12px] text-[var(--text-muted)]">{events.length} {events.length === 1 ? "activity" : "activities"}</p>
      </div>
      <div className="divide-y divide-[var(--border)]">
        {events.length === 0 && <p className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">{empty}</p>}
        {events.map((e) => <EventRow key={e.id} event={e} showDate={showDate} />)}
      </div>
    </div>
  );
}
