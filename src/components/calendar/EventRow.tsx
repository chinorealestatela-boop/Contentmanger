import Link from "next/link";
import { optionLabel, APPOINTMENT_TYPES, FOLLOWUP_STATUSES } from "@/lib/constants";
import { formatDate, formatTime12h } from "@/lib/format";
import { eventColor, eventIcon } from "@/components/calendar/eventMeta";
import { AppointmentStatusControl } from "@/components/appointments/AppointmentStatusControl";
import { AppointmentActionButtons } from "@/components/appointments/AppointmentEditControls";
import type { CalendarEvent } from "@/lib/queries/calendar";

export type AppointmentPickers = {
  customers: { id: string; firstName: string; lastName: string }[];
  vehicles: { id: string; year: number; make: string; model: string; stockNumber: string }[];
  teamUsers: { id: string; firstName: string; lastName: string }[];
};

export function EventRow({ event, showDate = false, pickers }: { event: CalendarEvent; showDate?: boolean; pickers?: AppointmentPickers }) {
  const Icon = eventIcon(event.type);
  const color = eventColor(event.type);
  const typeLabel = event.kind === "followup" ? "Follow-Up Call" : optionLabel(APPOINTMENT_TYPES, event.type);

  return (
    <div className="flex flex-col gap-2 px-4 py-3 hover:bg-[var(--bg-subtle)] sm:flex-row sm:items-center">
      <Link href={`/customers/${event.customerId}`} className="flex min-w-0 flex-1 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: `${color}1a`, color }}>
          <Icon size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-[13.5px] font-semibold text-[var(--text)]">{event.customerName}</p>
            <span className="shrink-0 text-[12px] font-semibold tabular-nums text-[var(--text)]">
              {showDate ? `${formatDate(event.date, "MMM d")} · ` : ""}{formatTime12h(event.time)}{event.endTime ? `–${formatTime12h(event.endTime)}` : ""}
            </span>
          </div>
          <p className="truncate text-[12px] text-[var(--text-muted)]">
            {typeLabel}{event.subtitle && event.kind === "appointment" ? ` · ${event.subtitle}` : ""}
          </p>
          {event.kind === "followup" && event.title && <p className="truncate text-[12px] text-[var(--text-faint)]">{event.title}</p>}
        </div>
      </Link>
      <div className="flex shrink-0 items-center justify-end gap-2">
        {event.kind === "appointment" ? (
          <>
            <AppointmentStatusControl appointmentId={event.id} status={event.status} />
            {pickers && (
              <AppointmentActionButtons
                compact
                appointment={{
                  id: event.id,
                  customerId: event.customerId,
                  customerName: event.customerName,
                  vehicleId: event.vehicleId,
                  salespersonId: event.salespersonId,
                  date: event.date,
                  time: event.time,
                  endTime: event.endTime,
                  location: event.location,
                  type: event.type,
                  notes: event.notes,
                  status: event.status,
                  reminderOffsetMinutes: event.reminderOffsetMinutes,
                }}
                customers={pickers.customers}
                vehicles={pickers.vehicles}
                teamUsers={pickers.teamUsers}
              />
            )}
          </>
        ) : (
          <span className="badge" style={{ background: `${color}1a`, color }}>{optionLabel(FOLLOWUP_STATUSES, event.status)}</span>
        )}
      </div>
    </div>
  );
}
