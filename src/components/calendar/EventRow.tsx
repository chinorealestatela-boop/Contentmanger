import Link from "next/link";
import { optionLabel, APPOINTMENT_TYPES, FOLLOWUP_STATUSES } from "@/lib/constants";
import { formatDate, formatTime12h } from "@/lib/format";
import { eventColor, eventIcon } from "@/components/calendar/eventMeta";
import { AppointmentStatusControl } from "@/components/appointments/AppointmentStatusControl";
import { getPaymentDisplayStatus, PAYMENT_DISPLAY_STATUS_META } from "@/lib/payments/status";
import type { CalendarEvent } from "@/lib/queries/calendar";

export function EventRow({ event, showDate = false }: { event: CalendarEvent; showDate?: boolean }) {
  // Note: `Icon` is a component reference pulled from a static lookup
  // table (eventIcon), not a component defined here — it's referentially
  // stable across renders. eslint's react-hooks/static-components rule
  // flags this shape unconditionally (it can't distinguish a stable
  // lookup from an actual inline component definition); this pattern is
  // already used the same way throughout the app (Sidebar.tsx,
  // MobileNav.tsx, ActivityTimeline.tsx), so it's left as-is here for
  // consistency rather than special-cased in just this one file.
  const Icon = eventIcon(event.type);
  const color = eventColor(event.type);
  const typeLabel = event.kind === "followup" ? "Follow-Up Call" : event.kind === "payment" ? "Scheduled Payment" : optionLabel(APPOINTMENT_TYPES, event.type);

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-subtle)]">
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
            {typeLabel}{event.subtitle && event.kind === "appointment" ? ` · ${event.subtitle}` : ""}
          </p>
          {(event.kind === "followup" || event.kind === "payment") && event.title && <p className="truncate text-[12px] text-[var(--text-faint)]">{event.title}</p>}
        </div>
      </Link>
      <div className="shrink-0">
        {event.kind === "appointment" ? (
          <AppointmentStatusControl appointmentId={event.id} status={event.status} />
        ) : event.kind === "payment" ? (
          <span className="badge" style={{ background: `${color}1a`, color }}>{PAYMENT_DISPLAY_STATUS_META[getPaymentDisplayStatus({ status: event.status, dueDate: event.date })].label}</span>
        ) : (
          <span className="badge" style={{ background: `${color}1a`, color }}>{optionLabel(FOLLOWUP_STATUSES, event.status)}</span>
        )}
      </div>
    </div>
  );
}
