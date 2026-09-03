"use client";

import { useActionState, useState, useTransition } from "react";
import { Plus, Trash2, RefreshCcw } from "lucide-react";
import { updateBookingSettings, runReminderChecksNow, type BookingSettingsActionState } from "@/lib/actions/settings";
import type { BookingSettings } from "@/lib/availability";

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type FormShape = BookingSettings & { primarySalespersonId?: string };

export function BookingSettingsForm({
  initial,
  primarySalespersonId,
  users,
}: {
  initial: BookingSettings;
  primarySalespersonId: string | null;
  users: { id: string; firstName: string; lastName: string }[];
}) {
  const [state, formAction, pending] = useActionState<BookingSettingsActionState, FormData>(updateBookingSettings, null);
  const [settings, setSettings] = useState<FormShape>({ ...initial, primarySalespersonId: primarySalespersonId ?? users[0]?.id });
  const [reminderPending, startReminderTransition] = useTransition();
  const [reminderResult, setReminderResult] = useState<string | null>(null);

  function update<K extends keyof FormShape>(key: K, value: FormShape[K]) {
    setSettings((s) => ({ ...s, [key]: value }));
  }

  function updateDay(dayKey: string, patch: Partial<FormShape["hours"][string]>) {
    setSettings((s) => ({ ...s, hours: { ...s.hours, [dayKey]: { ...s.hours[dayKey], ...patch } } }));
  }

  function addBreak() {
    setSettings((s) => ({ ...s, breaks: [...s.breaks, { start: "12:00", end: "12:30" }] }));
  }
  function removeBreak(i: number) {
    setSettings((s) => ({ ...s, breaks: s.breaks.filter((_, idx) => idx !== i) }));
  }
  function updateBreak(i: number, patch: { start?: string; end?: string }) {
    setSettings((s) => ({ ...s, breaks: s.breaks.map((b, idx) => (idx === i ? { ...b, ...patch } : b)) }));
  }

  function addBlackout(date: string) {
    if (!date || settings.blackoutDates.includes(date)) return;
    setSettings((s) => ({ ...s, blackoutDates: [...s.blackoutDates, date].sort() }));
  }
  function removeBlackout(date: string) {
    setSettings((s) => ({ ...s, blackoutDates: s.blackoutDates.filter((d) => d !== date) }));
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="payload" value={JSON.stringify(settings)} />

      {state?.error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</div>}
      {state?.success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.success}</div>}

      <div>
        <p className="mb-3 text-[13px] font-semibold text-[var(--text)]">Booking site basics</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Your name (used in SMS/email)</label>
            <input className="input" value={settings.agentName} onChange={(e) => update("agentName", e.target.value)} required />
          </div>
          <div>
            <label className="label">Timezone</label>
            <select className="input" value={settings.timezone} onChange={(e) => update("timezone", e.target.value)}>
              <option value="America/Los_Angeles">Pacific (Las Vegas)</option>
              <option value="America/Denver">Mountain</option>
              <option value="America/Chicago">Central</option>
              <option value="America/New_York">Eastern</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Meeting location</label>
            <input className="input" value={settings.location} onChange={(e) => update("location", e.target.value)} required />
          </div>
          {users.length > 0 && (
            <div className="sm:col-span-2">
              <label className="label">Assign online bookings to</label>
              <select className="input" value={settings.primarySalespersonId} onChange={(e) => update("primarySalespersonId", e.target.value)}>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.firstName} {u.lastName}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      <div>
        <p className="mb-3 text-[13px] font-semibold text-[var(--text)]">Working hours</p>
        <div className="space-y-2">
          {DAY_LABELS.map((label, i) => {
            const key = String(i);
            const day = settings.hours[key];
            return (
              <div key={key} className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2">
                <label className="flex w-28 shrink-0 items-center gap-2 text-[13px] font-medium">
                  <input type="checkbox" checked={day.enabled} onChange={(e) => updateDay(key, { enabled: e.target.checked })} />
                  {label}
                </label>
                {day.enabled ? (
                  <div className="flex items-center gap-2 text-[13px]">
                    <input type="time" className="input w-32" value={day.start} onChange={(e) => updateDay(key, { start: e.target.value })} />
                    <span className="text-[var(--text-faint)]">to</span>
                    <input type="time" className="input w-32" value={day.end} onChange={(e) => updateDay(key, { end: e.target.value })} />
                  </div>
                ) : (
                  <span className="text-[13px] text-[var(--text-faint)]">Closed</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Appointment length (minutes)</label>
          <input type="number" min={5} step={5} className="input" value={settings.appointmentDurationMinutes} onChange={(e) => update("appointmentDurationMinutes", Number(e.target.value))} />
        </div>
        <div>
          <label className="label">Buffer between appointments (minutes)</label>
          <input type="number" min={0} step={5} className="input" value={settings.bufferMinutes} onChange={(e) => update("bufferMinutes", Number(e.target.value))} />
        </div>
        <div>
          <label className="label">Max appointments per day</label>
          <input
            type="number"
            min={1}
            className="input"
            placeholder="Unlimited"
            value={settings.maxAppointmentsPerDay ?? ""}
            onChange={(e) => update("maxAppointmentsPerDay", e.target.value === "" ? null : Number(e.target.value))}
          />
        </div>
        <div>
          <label className="label">Minimum notice (hours)</label>
          <input type="number" min={0} className="input" value={settings.minLeadTimeHours} onChange={(e) => update("minLeadTimeHours", Number(e.target.value))} />
        </div>
        <div>
          <label className="label">How far out customers can book (days)</label>
          <input type="number" min={1} className="input" value={settings.maxBookingWindowDays} onChange={(e) => update("maxBookingWindowDays", Number(e.target.value))} />
        </div>
      </div>

      <div>
        <p className="mb-2 text-[13px] font-semibold text-[var(--text)]">Daily breaks</p>
        <div className="space-y-2">
          {settings.breaks.map((b, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="time" className="input w-32" value={b.start} onChange={(e) => updateBreak(i, { start: e.target.value })} />
              <span className="text-[var(--text-faint)]">to</span>
              <input type="time" className="input w-32" value={b.end} onChange={(e) => updateBreak(i, { end: e.target.value })} />
              <button type="button" onClick={() => removeBreak(i)} className="btn btn-ghost btn-sm text-red-600"><Trash2 size={14} /></button>
            </div>
          ))}
          <button type="button" onClick={addBreak} className="btn btn-secondary btn-sm"><Plus size={14} /> Add break</button>
        </div>
      </div>

      <div>
        <p className="mb-2 text-[13px] font-semibold text-[var(--text)]">Holidays / days off</p>
        <div className="mb-2 flex flex-wrap gap-2">
          {settings.blackoutDates.map((d) => (
            <span key={d} className="badge badge-neutral gap-1.5 normal-case">
              {d}
              <button type="button" onClick={() => removeBlackout(d)} className="text-[var(--text-faint)] hover:text-red-600">×</button>
            </span>
          ))}
          {settings.blackoutDates.length === 0 && <p className="text-[12.5px] text-[var(--text-faint)]">None yet.</p>}
        </div>
        <input
          type="date"
          className="input w-48"
          onChange={(e) => {
            if (e.target.value) addBlackout(e.target.value);
            e.target.value = "";
          }}
        />
      </div>

      <div>
        <p className="mb-2 text-[13px] font-semibold text-[var(--text)]">Reminders</p>
        <div className="space-y-2">
          {(
            [
              ["sendImmediateConfirmation", "Confirmation immediately after booking"],
              ["send24HourReminder", "Reminder 24 hours before"],
              ["send2HourReminder", "Reminder 2 hours before"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-[13px]">
              <input type="checkbox" checked={settings.reminders[key]} onChange={(e) => update("reminders", { ...settings.reminders, [key]: e.target.checked })} />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-[var(--border)] pt-4">
        <button
          type="button"
          disabled={reminderPending}
          onClick={() =>
            startReminderTransition(async () => {
              const res = await runReminderChecksNow();
              setReminderResult(`Checked ${res.checked} upcoming appointments — sent ${res.sent24h} 24h and ${res.sent2h} 2h reminder(s).`);
            })
          }
          className="btn btn-secondary btn-sm"
        >
          <RefreshCcw size={14} className={reminderPending ? "animate-spin" : ""} /> Run Reminder Checks Now
        </button>
        <button type="submit" disabled={pending} className="btn btn-primary">
          {pending ? "Saving…" : "Save Settings"}
        </button>
      </div>
      {reminderResult && <p className="text-[12.5px] text-[var(--text-muted)]">{reminderResult}</p>}
    </form>
  );
}
