import Link from "next/link";
import { Plus } from "lucide-react";
import { startOfDay, endOfDay, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays } from "date-fns";
import { requireScope } from "@/lib/queries/scope";
import { ensureFollowUpsFresh } from "@/lib/queries/followups";
import { getCalendarEvents } from "@/lib/queries/calendar";
import { prisma } from "@/lib/prisma";
import { CalendarMonthView } from "@/components/calendar/CalendarMonthView";
import { CalendarWeekView } from "@/components/calendar/CalendarWeekView";
import { CalendarDayView } from "@/components/calendar/CalendarDayView";
import { EventRow } from "@/components/calendar/EventRow";
import { cn } from "@/lib/utils";

type View = "month" | "week" | "day" | "today" | "upcoming";

const VIEWS: { value: View; label: string }[] = [
  { value: "month", label: "Month" },
  { value: "week", label: "Week" },
  { value: "day", label: "Day" },
  { value: "today", label: "Today" },
  { value: "upcoming", label: "Upcoming" },
];

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; year?: string; month?: string; day?: string; vehicleId?: string; driverId?: string }>;
}) {
  const sp = await searchParams;
  const scope = await requireScope();
  await ensureFollowUpsFresh();

  const [vehicles, drivers] = await Promise.all([
    prisma.vehicle.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.driver.findMany({ where: { isActive: true }, orderBy: { firstName: "asc" }, select: { id: true, firstName: true, lastName: true } }),
  ]);

  const now = new Date();
  const year = sp.year ? Number(sp.year) : now.getFullYear();
  const month = sp.month ? Number(sp.month) : now.getMonth();
  const day = sp.day ? Number(sp.day) : now.getDate();
  const anchor = new Date(year, month, day);
  const view: View = VIEWS.find((v) => v.value === sp.view)?.value ?? "month";
  const filters = { vehicleId: sp.vehicleId, driverId: sp.driverId };

  const qs = (extra: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { view: sp.view, year: String(year), month: String(month), day: String(day), vehicleId: sp.vehicleId, driverId: sp.driverId, ...extra };
    Object.entries(merged).forEach(([k, v]) => v && params.set(k, v));
    return `/calendar?${params.toString()}`;
  };

  let content: React.ReactNode;

  if (view === "month") {
    const events = await getCalendarEvents(scope, { start: startOfWeek(startOfMonth(anchor)), end: endOfWeek(endOfMonth(anchor)) }, filters);
    content = <CalendarMonthView year={year} month={month} events={events} />;
  } else if (view === "week") {
    const events = await getCalendarEvents(scope, { start: startOfWeek(anchor), end: endOfWeek(anchor) }, filters);
    content = <CalendarWeekView anchor={anchor} events={events} />;
  } else if (view === "day") {
    const events = await getCalendarEvents(scope, { start: startOfDay(anchor), end: endOfDay(anchor) }, filters);
    content = <CalendarDayView day={anchor} events={events} />;
  } else if (view === "today") {
    const events = await getCalendarEvents(scope, { start: startOfDay(now), end: endOfDay(now) }, filters);
    content = <ListCard title="Today's Activities" empty="Nothing scheduled for today." events={events} />;
  } else {
    const events = await getCalendarEvents(scope, { start: startOfDay(now), end: endOfDay(addDays(now, 90)) }, filters);
    content = <ListCard title="Upcoming Activities" empty="Nothing scheduled in the next 90 days." events={events} showDate />;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium text-[var(--text)]">Calendar</h1>
          <p className="text-[13px] text-[var(--text-muted)]">Every reservation and follow-up call in one place — filter by fleet vehicle or chauffeur.</p>
        </div>
        <Link href="/bookings/new" className="btn btn-primary"><Plus size={15} /> New Booking</Link>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5 rounded-lg border border-[var(--border)] bg-white/[0.02] p-1">
          {VIEWS.map((v) => (
            <Link
              key={v.value}
              href={qs({ view: v.value })}
              className={cn("rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors", view === v.value ? "bg-[var(--brand)] text-[#14120a]" : "text-[var(--text-muted)] hover:bg-white/[0.05]")}
            >
              {v.label}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {sp.vehicleId && <Link href={qs({ vehicleId: undefined })} className="badge badge-gold">Vehicle filter ×</Link>}
          {sp.driverId && <Link href={qs({ driverId: undefined })} className="badge badge-gold">Driver filter ×</Link>}
          {!sp.vehicleId && !sp.driverId && <span className="text-[12px] text-[var(--text-faint)]">Showing all fleet &amp; drivers</span>}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)] self-center mr-1">Fleet:</span>
        {vehicles.slice(0, 6).map((v) => (
          <Link key={v.id} href={qs({ vehicleId: v.id })} className={cn("badge", sp.vehicleId === v.id ? "badge-gold" : "badge-neutral")}>{v.name}</Link>
        ))}
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)] self-center mx-1">Driver:</span>
        {drivers.map((d) => (
          <Link key={d.id} href={qs({ driverId: d.id })} className={cn("badge", sp.driverId === d.id ? "badge-gold" : "badge-neutral")}>{d.firstName}</Link>
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
