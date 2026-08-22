import { formatDateTime } from "@/lib/format";
import {
  Phone, StickyNote, Workflow, CalendarClock, Car, ArrowLeftRight, CheckSquare,
  Trophy, XCircle, RefreshCcw, Zap, UserPlus, Repeat, Gauge, PhoneCall, CalendarX, CalendarCheck2,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  LEAD_CREATED: UserPlus,
  COMMUNICATION_LOGGED: Phone,
  NOTE_ADDED: StickyNote,
  STAGE_CHANGE: Workflow,
  TEMPERATURE_CHANGE: Zap,
  APPOINTMENT: CalendarClock,
  CALENDAR_EVENT: CalendarClock,
  VEHICLE_INTEREST_ADDED: Car,
  TRADE_ADDED: ArrowLeftRight,
  TASK_CREATED: CheckSquare,
  TASK_COMPLETED: CheckSquare,
  SOLD: Trophy,
  LOST: XCircle,
  REACTIVATED: RefreshCcw,
  AUTOMATION: Zap,
  SEQUENCE_ENROLLED: Repeat,
  MANUAL_LOG: StickyNote,
  CUSTOMER_UPDATED: StickyNote,
  LEAD_UPDATED: StickyNote,
  REASSIGNED: UserPlus,
  TEST_DRIVE_COMPLETED: Gauge,
  TEMPERATURE_CHANGE_HOT: Zap,
  FOLLOWUP_SCHEDULED: PhoneCall,
  FOLLOWUP_COMPLETED: CalendarCheck2,
  FOLLOWUP_RESCHEDULED: RefreshCcw,
  FOLLOWUP_CANCELLED: CalendarX,
  FOLLOWUP_MISSED: CalendarX,
};

export function ActivityTimeline({ activities }: { activities: { id: string; type: string; description: string; createdAt: Date; actor: { firstName: string; lastName: string } | null }[] }) {
  if (activities.length === 0) return <p className="py-6 text-center text-[13px] text-[var(--text-faint)]">No activity yet.</p>;

  return (
    <ol className="relative space-y-0">
      {activities.map((a, i) => {
        const Icon = ICONS[a.type] ?? StickyNote;
        return (
          <li key={a.id} className="relative flex gap-3 pb-5 last:pb-0">
            {i < activities.length - 1 && <span className="absolute left-[13px] top-7 h-[calc(100%-14px)] w-px bg-[var(--border)]" />}
            <span className="z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--bg-subtle)] text-[var(--text-muted)]">
              <Icon size={13} />
            </span>
            <div className="min-w-0 pt-0.5">
              <p className="text-[13px] leading-snug text-[var(--text)]">{a.description}</p>
              <p className="mt-0.5 text-[11px] text-[var(--text-faint)]">
                {formatDateTime(a.createdAt)} {a.actor ? `· ${a.actor.firstName} ${a.actor.lastName}` : "· System"}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
