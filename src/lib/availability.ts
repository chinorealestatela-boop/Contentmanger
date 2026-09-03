// Test-drive appointment availability engine. Pure, framework-free
// functions so slot math can be unit-tested without a database — the only
// DB access in this file is getBookingSettings()/saveBookingSettings(),
// which read/write a single JSON blob in the existing Setting table (key
// "booking"), the same pattern already used for dealership info (see
// src/components/settings/DealershipForm.tsx).

import { prisma } from "@/lib/prisma";

export type DayHours = { enabled: boolean; start: string; end: string }; // "HH:mm" 24h

export type BookingSettings = {
  timezone: string; // IANA tz — appointment times are stored/interpreted in this zone
  agentName: string; // used in SMS/email templates ("Hey Jordan, this is Chino...")
  location: string; // shown on the confirmation page / in messages
  hours: Record<string, DayHours>; // "0" (Sun) .. "6" (Sat)
  appointmentDurationMinutes: number;
  bufferMinutes: number; // gap kept clear between back-to-back appointments
  breaks: { start: string; end: string }[]; // daily breaks (e.g. lunch), applied every working day
  blackoutDates: string[]; // "YYYY-MM-DD" — holidays / days off, no slots offered
  maxAppointmentsPerDay: number | null; // null = unlimited (bounded only by hours/duration)
  minLeadTimeHours: number; // can't book a slot starting sooner than this from now
  maxBookingWindowDays: number; // can't book more than this many days out
  reminders: {
    sendImmediateConfirmation: boolean;
    send24HourReminder: boolean;
    send2HourReminder: boolean;
  };
};

export const DEFAULT_BOOKING_SETTINGS: BookingSettings = {
  timezone: "America/Los_Angeles",
  agentName: "Chino",
  location: "AutoMax LV, Las Vegas, NV",
  hours: {
    "0": { enabled: false, start: "10:00", end: "17:00" }, // Sunday — closed by default
    "1": { enabled: true, start: "09:00", end: "19:00" },
    "2": { enabled: true, start: "09:00", end: "19:00" },
    "3": { enabled: true, start: "09:00", end: "19:00" },
    "4": { enabled: true, start: "09:00", end: "19:00" },
    "5": { enabled: true, start: "09:00", end: "19:00" },
    "6": { enabled: true, start: "09:00", end: "18:00" },
  },
  appointmentDurationMinutes: 30,
  bufferMinutes: 0,
  breaks: [{ start: "13:00", end: "13:30" }],
  blackoutDates: [],
  maxAppointmentsPerDay: null,
  minLeadTimeHours: 2,
  maxBookingWindowDays: 30,
  reminders: {
    sendImmediateConfirmation: true,
    send24HourReminder: true,
    send2HourReminder: true,
  },
};

function mergeSettings(stored: Partial<BookingSettings> | null): BookingSettings {
  if (!stored) return DEFAULT_BOOKING_SETTINGS;
  return {
    ...DEFAULT_BOOKING_SETTINGS,
    ...stored,
    hours: { ...DEFAULT_BOOKING_SETTINGS.hours, ...(stored.hours ?? {}) },
    reminders: { ...DEFAULT_BOOKING_SETTINGS.reminders, ...(stored.reminders ?? {}) },
  };
}

export async function getBookingSettings(): Promise<BookingSettings> {
  const row = await prisma.setting.findUnique({ where: { key: "booking" } });
  if (!row) return DEFAULT_BOOKING_SETTINGS;
  try {
    return mergeSettings(JSON.parse(row.value));
  } catch {
    return DEFAULT_BOOKING_SETTINGS;
  }
}

export async function saveBookingSettings(settings: BookingSettings) {
  await prisma.setting.upsert({
    where: { key: "booking" },
    update: { value: JSON.stringify(settings) },
    create: { key: "booking", value: JSON.stringify(settings) },
  });
}

// ── Pure slot math ───────────────────────────────────────────────────────

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function toHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

/** "YYYY-MM-DD" -> weekday index (0 = Sunday), interpreted as a calendar
 * date with no time-of-day/timezone ambiguity (parsed as UTC noon so it
 * can never roll to the adjacent day under any local offset). */
function weekdayOf(dateStr: string): number {
  const d = new Date(`${dateStr}T12:00:00Z`);
  return d.getUTCDay();
}

export function isBlackoutDate(dateStr: string, settings: BookingSettings): boolean {
  return settings.blackoutDates.includes(dateStr);
}

export function isWorkingDay(dateStr: string, settings: BookingSettings): boolean {
  if (isBlackoutDate(dateStr, settings)) return false;
  const day = settings.hours[String(weekdayOf(dateStr))];
  return !!day?.enabled;
}

export function isWithinBookingWindow(dateStr: string, settings: BookingSettings, now = new Date()): boolean {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${dateStr}T00:00:00`);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
  return diffDays >= 0 && diffDays <= settings.maxBookingWindowDays;
}

export function isDateBookable(dateStr: string, settings: BookingSettings, now = new Date()): boolean {
  return isWorkingDay(dateStr, settings) && isWithinBookingWindow(dateStr, settings, now);
}

type ExistingAppointment = { time: string; endTime?: string | null; status: string };

const ACTIVE_APPOINTMENT_STATUSES = new Set(["SCHEDULED", "CONFIRMED", "SHOWED"]);

/** Every bookable "HH:mm" start time for a given date, filtering out
 * anything that overlaps an existing (non-cancelled) appointment, falls in
 * a configured break, or is closer than minLeadTimeHours from now. Caller
 * passes in the day's existing appointments (see getAvailableSlots below,
 * which wraps this with the actual DB query + maxAppointmentsPerDay cap). */
export function generateSlotsForDate(
  dateStr: string,
  settings: BookingSettings,
  existingAppointments: ExistingAppointment[],
  now = new Date()
): string[] {
  if (!isDateBookable(dateStr, settings, now)) return [];

  const day = settings.hours[String(weekdayOf(dateStr))];
  if (!day?.enabled) return [];

  const duration = settings.appointmentDurationMinutes;
  const step = duration + settings.bufferMinutes;
  const dayStart = toMinutes(day.start);
  const dayEnd = toMinutes(day.end);

  const busy = existingAppointments
    .filter((a) => ACTIVE_APPOINTMENT_STATUSES.has(a.status))
    .map((a) => {
      const start = toMinutes(a.time);
      const end = a.endTime ? toMinutes(a.endTime) : start + duration;
      return { start, end };
    });

  const breaks = settings.breaks.map((b) => ({ start: toMinutes(b.start), end: toMinutes(b.end) }));

  // Minimum bookable instant, expressed as minutes-since-midnight *for this
  // date* — only meaningful when dateStr is today; earlier/future dates are
  // unaffected (minMinutesToday ends up negative/irrelevant).
  const cutoff = new Date(now.getTime() + settings.minLeadTimeHours * 3600000);
  const cutoffDateStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}-${String(cutoff.getDate()).padStart(2, "0")}`;
  const minMinutesToday = cutoffDateStr === dateStr ? cutoff.getHours() * 60 + cutoff.getMinutes() : -1;

  const slots: string[] = [];
  for (let start = dayStart; start + duration <= dayEnd; start += step) {
    if (start < minMinutesToday) continue;
    const end = start + duration;
    const overlapsBusy = busy.some((b) => start < b.end && end > b.start);
    if (overlapsBusy) continue;
    const overlapsBreak = breaks.some((b) => start < b.end && end > b.start);
    if (overlapsBreak) continue;
    slots.push(toHHMM(start));
  }
  return slots;
}

export async function getAvailableSlots(dateStr: string, settings?: BookingSettings): Promise<string[]> {
  const s = settings ?? (await getBookingSettings());
  if (!isDateBookable(dateStr, s)) return [];

  const existing = await prisma.appointment.findMany({
    where: { date: new Date(`${dateStr}T00:00:00`) },
    select: { time: true, endTime: true, status: true },
  });

  if (s.maxAppointmentsPerDay !== null) {
    const activeCount = existing.filter((a) => ACTIVE_APPOINTMENT_STATUSES.has(a.status)).length;
    if (activeCount >= s.maxAppointmentsPerDay) return [];
  }

  return generateSlotsForDate(dateStr, s, existing);
}

/** Whether a specific "HH:mm" slot on a date is still free — re-checked
 * server-side at submit time (and at reschedule time) so two customers
 * racing for the same slot can never both win it. */
export async function isSlotAvailable(dateStr: string, time: string, settings?: BookingSettings, excludeAppointmentId?: string): Promise<boolean> {
  const s = settings ?? (await getBookingSettings());
  const slots = await getAvailableSlots(dateStr, s);
  if (slots.includes(time)) return true;
  // If we're rescheduling and the target slot is only "taken" by the
  // appointment being moved, it's still fine to keep it.
  if (!excludeAppointmentId) return false;
  const existing = await prisma.appointment.findMany({
    where: { date: new Date(`${dateStr}T00:00:00`), id: { not: excludeAppointmentId } },
    select: { time: true, endTime: true, status: true },
  });
  return generateSlotsForDate(dateStr, s, existing).includes(time);
}
