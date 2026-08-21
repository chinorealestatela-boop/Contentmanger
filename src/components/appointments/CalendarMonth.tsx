import Link from "next/link";
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, isToday, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { formatTime12h } from "@/lib/format";
import { cn } from "@/lib/utils";

type Appt = { id: string; customerId: string; date: Date; time: string; type: string; status: string; customer: { firstName: string; lastName: string } };

export function CalendarMonth({ year, month, appointments }: { year: number; month: number; appointments: Appt[] }) {
  const monthStart = startOfMonth(new Date(year, month, 1));
  const monthEnd = endOfMonth(monthStart);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const byDay = new Map<string, Appt[]>();
  for (const a of appointments) {
    const key = format(a.date, "yyyy-MM-dd");
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(a);
  }

  const prev = subMonths(monthStart, 1);
  const next = addMonths(monthStart, 1);

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <h2 className="text-[15px] font-semibold">{format(monthStart, "MMMM yyyy")}</h2>
        <div className="flex gap-1.5">
          <Link href={`/appointments?year=${prev.getFullYear()}&month=${prev.getMonth()}`} className="btn btn-secondary btn-sm">← Prev</Link>
          <Link href={`/appointments?year=${new Date().getFullYear()}&month=${new Date().getMonth()}`} className="btn btn-secondary btn-sm">Today</Link>
          <Link href={`/appointments?year=${next.getFullYear()}&month=${next.getMonth()}`} className="btn btn-secondary btn-sm">Next →</Link>
        </div>
      </div>
      <div className="grid grid-cols-7 border-b border-[var(--border)] text-center text-[11px] font-semibold text-[var(--text-faint)]">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="py-2">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayAppts = byDay.get(key) ?? [];
          const inMonth = isSameMonth(day, monthStart);
          return (
            <div key={key} className={cn("min-h-[92px] border-b border-r border-[var(--border)] p-1.5", !inMonth && "bg-[var(--bg-subtle)]")}>
              <p className={cn("text-[11px] font-semibold", isToday(day) ? "flex h-5 w-5 items-center justify-center rounded-full bg-[var(--brand)] text-white" : inMonth ? "text-[var(--text)]" : "text-[var(--text-faint)]")}>
                {format(day, "d")}
              </p>
              <div className="mt-1 space-y-0.5">
                {dayAppts.slice(0, 3).map((a) => (
                  <Link
                    key={a.id}
                    href={`/customers/${a.customerId}`}
                    className="block truncate rounded px-1 py-0.5 text-[10px] font-medium"
                    style={{ background: a.status === "NO_SHOW" ? "var(--overdue-soft)" : "var(--appointment-soft)", color: a.status === "NO_SHOW" ? "var(--overdue)" : "var(--appointment)" }}
                    title={`${formatTime12h(a.time)} ${a.customer.firstName} ${a.customer.lastName}`}
                  >
                    {formatTime12h(a.time)} {a.customer.firstName}
                  </Link>
                ))}
                {dayAppts.length > 3 && <p className="px-1 text-[10px] text-[var(--text-faint)]">+{dayAppts.length - 3} more</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
