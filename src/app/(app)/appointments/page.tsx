import Link from "next/link";
import { Plus } from "lucide-react";
import { requireScope } from "@/lib/queries/scope";
import { getAppointmentsForMonth, getUpcomingAppointments } from "@/lib/queries/appointments";
import { CalendarMonth } from "@/components/appointments/CalendarMonth";
import { AppointmentStatusControl } from "@/components/appointments/AppointmentStatusControl";
import { formatDate, formatTime12h } from "@/lib/format";
import { optionLabel, APPOINTMENT_TYPES } from "@/lib/constants";

export default async function AppointmentsPage({ searchParams }: { searchParams: Promise<{ year?: string; month?: string }> }) {
  const sp = await searchParams;
  const now = new Date();
  const year = sp.year ? Number(sp.year) : now.getFullYear();
  const month = sp.month ? Number(sp.month) : now.getMonth();

  const scope = await requireScope();
  const [monthAppts, upcoming] = await Promise.all([
    getAppointmentsForMonth(scope, year, month),
    getUpcomingAppointments(scope),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text)]">Appointments</h1>
          <p className="text-[13px] text-[var(--text-muted)]">Showroom visits, test drives, deliveries, and more.</p>
        </div>
        <Link href="/appointments/new" className="btn btn-primary"><Plus size={15} /> New Appointment</Link>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CalendarMonth year={year} month={month} appointments={monthAppts} />
        </div>
        <div className="card">
          <div className="border-b border-[var(--border)] px-4 py-3">
            <h2 className="text-[13.5px] font-semibold">Upcoming</h2>
          </div>
          <div className="max-h-[600px] divide-y divide-[var(--border)] overflow-y-auto">
            {upcoming.length === 0 && <p className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">No upcoming appointments.</p>}
            {upcoming.map((a) => (
              <div key={a.id} className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <Link href={`/customers/${a.customerId}`} className="text-[13px] font-semibold text-[var(--text)] hover:text-[var(--brand)]">
                    {a.customer.firstName} {a.customer.lastName}
                  </Link>
                  <AppointmentStatusControl appointmentId={a.id} status={a.status} />
                </div>
                <p className="mt-0.5 text-[11.5px] text-[var(--text-muted)]">{optionLabel(APPOINTMENT_TYPES, a.type)}{a.vehicle ? ` · ${a.vehicle.year} ${a.vehicle.make} ${a.vehicle.model}` : ""}</p>
                <p className="mt-0.5 text-[11px] text-[var(--text-faint)]">{formatDate(a.date)} at {formatTime12h(a.time)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
