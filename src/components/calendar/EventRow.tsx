import Link from "next/link";
import { optionLabel, APPOINTMENT_TYPES, FOLLOWUP_STATUSES, TASK_TYPES } from "@/lib/constants";
import { formatDate, formatTime12h } from "@/lib/format";
import { eventColor, eventIcon } from "@/components/calendar/eventMeta";
import { AppointmentStatusControl } from "@/components/appointments/AppointmentStatusControl";
import { AppointmentActionButtons } from "@/components/appointments/AppointmentEditControls";
import { TaskEventStatus } from "@/components/calendar/TaskEventStatus";
import { getPaymentDisplayStatus, PAYMENT_DISPLAY_STATUS_META } from "@/lib/payments/status";
import type { CalendarEvent } from "@/lib/queries/calendar";

export type AppointmentPickers = {
  customers: { id: string; firstName: string; lastName: string }[];
  vehicles: { id: string; year: number; make: string; model: string; stockNumber: string }[];
  teamUsers: { id: string; firstName: string; lastName: string }[];
};

export function EventRow({ event, showDate = false, pickers }: { event: CalendarEvent; showDate?: boolean; pickers?: AppointmentPickers }) {
  // Note: `Icon` is a component reference pulled from a static lookup
  // table (eventIcon), not a component defined here — it's referentially
  // stable across renders. eslint's react-hooks/static-components rule
  // flags this shape unconditionally (it can't distinguish a stable
  // lookup from an actual inline component definition); this pattern is
  // already used the same way throughout the app (Sidebar.tsx,
  // MobileNav.tsx, ActivityTimeline.tsx), so it's left as-is here for
  // consistency rather than special-cased in just this one file.
  const Icon = eventIcon(event.type, event.kind);
  const color = eventColor(event.type, event.kind);
  const typeLabel =
    event.kind === "followup" ? "Follow-Up Call" :
    event.kind === "payment" ? "Scheduled Payment" :
    event.kind === "task" ? optionLabel(TASK_TYPES, event.type) :
    optionLabel(APPOINTMENT_TYPES, event.type);

  return (
    <div className="flex flex-col gap-2 px-4 py-3 hover:bg-[var(--bg-subtle)] sm:flex-row sm:items-center">
      <Link href={`/customers/${event.customerId}`} className="flex min-w-0 flex-1 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: `${color}1a`, color }}>
          {/* eslint-disable-next-line react-hooks/static-components -- Icon is a stable reference from a static lookup table (eventIcon), not a component defined here; the rule can't tell the difference. Same pattern used throughout the app (Sidebar.tsx, MobileNav.tsx, ActivityTimeline.tsx). */}
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
            {typeLabel}{event.subtitle && (event.kind === "appointment" || event.kind === "task") ? ` · ${event.subtitle}` : ""}
          </p>
          {(event.kind === "followup" || event.kind === "payment" || event.kind === "task") && event.title && (
            <p className="truncate text-[12px] text-[var(--text-faint)]">{event.title}</p>
          )}
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
        ) : event.kind === "task" ? (
          <TaskEventStatus taskId={event.id} status={event.status} />
        ) : event.kind === "payment" ? (
          <span className="badge" style={{ background: `${color}1a`, color }}>{PAYMENT_DISPLAY_STATUS_META[getPaymentDisplayStatus({ status: event.status, dueDate: event.date })].label}</span>
        ) : (
          <span className="badge" style={{ background: `${color}1a`, color }}>{optionLabel(FOLLOWUP_STATUSES, event.status)}</span>
        )}
      </div>
    </div>
  );
}
