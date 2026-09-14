import { CalendarCheck, PhoneCall, type LucideIcon } from "lucide-react";
import { optionColor, BOOKING_STATUSES, FOLLOWUP_STATUSES } from "@/lib/constants";
import type { CalendarEvent } from "@/lib/queries/calendar";

export function eventColor(event: Pick<CalendarEvent, "kind" | "status">) {
  return event.kind === "followup" ? optionColor(FOLLOWUP_STATUSES, event.status) : optionColor(BOOKING_STATUSES, event.status);
}

export function eventIcon(kind: CalendarEvent["kind"]): LucideIcon {
  return kind === "followup" ? PhoneCall : CalendarCheck;
}
