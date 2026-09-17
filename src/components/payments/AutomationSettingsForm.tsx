"use client";

import { useActionState, useState } from "react";
import { savePaymentAutomation } from "@/lib/actions/paymentAutomation";
import { ALL_PAYMENT_REMINDER_STAGES } from "@/lib/payments/status";
import type { PaymentAutomationSettings } from "@/lib/payments/reminders";

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => ({
  value: String(h),
  label: h === 0 ? "12:00 AM" : h < 12 ? `${h}:00 AM` : h === 12 ? "12:00 PM" : `${h - 12}:00 PM`,
}));

export function AutomationSettingsForm({ initial }: { initial: PaymentAutomationSettings }) {
  const [state, formAction, pending] = useActionState(savePaymentAutomation, null);
  const [overdueRepeatEnabled, setOverdueRepeatEnabled] = useState(initial.overdueRepeat.enabled);

  return (
    <form action={formAction} className="space-y-5">
      {state?.error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}

      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">
              <th className="py-2 pr-2">Reminder Stage</th>
              <th className="px-2 py-2 text-center">On</th>
              <th className="px-2 py-2 text-center">Notify Me</th>
              <th className="px-2 py-2 text-center">Create Task</th>
              <th className="px-2 py-2 text-center">Text Customer</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {ALL_PAYMENT_REMINDER_STAGES.map((stage) => {
              const cfg = initial.stages[stage.value];
              return (
                <tr key={stage.value}>
                  <td className="py-2.5 pr-2 font-medium text-[var(--text)]">{stage.label}</td>
                  <Cell name={`${stage.value}_enabled`} defaultChecked={cfg.enabled} />
                  <Cell name={`${stage.value}_notify`} defaultChecked={cfg.notify} />
                  <Cell name={`${stage.value}_task`} defaultChecked={cfg.task} />
                  <Cell name={`${stage.value}_sms`} defaultChecked={cfg.sms} />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11.5px] text-[var(--text-muted)]">
        &ldquo;Text Customer&rdquo; only ever sends to customers who&rsquo;ve given SMS consent — this never overrides that. A payment automatically switches to &ldquo;Late&rdquo; the first time it&rsquo;s checked after its due date passes unpaid.
      </p>

      <div className="grid grid-cols-1 gap-4 border-t border-[var(--border)] pt-4 sm:grid-cols-2">
        <div>
          <label className="label">Preferred Notification Time</label>
          <select name="preferredHour" defaultValue={String(initial.preferredHour)} className="input">
            {HOUR_OPTIONS.map((h) => <option key={h.value} value={h.value}>{h.label}</option>)}
          </select>
          <p className="mt-1 text-[11px] text-[var(--text-faint)]">New reminders only go out at or after this time each day, in your dealership&rsquo;s timezone.</p>
        </div>
        <div>
          <label className="label">Overdue Reminders</label>
          <label className="flex items-center gap-2 py-1.5 text-[13px] text-[var(--text)]">
            <input type="checkbox" name="overdueRepeatEnabled" checked={overdueRepeatEnabled} onChange={(e) => setOverdueRepeatEnabled(e.target.checked)} className="h-4 w-4 accent-[var(--brand)]" />
            Repeat while a payment stays late
          </label>
          {overdueRepeatEnabled && (
            <div className="flex items-center gap-2 text-[13px]">
              Every
              <input name="overdueRepeatIntervalDays" type="number" min={1} max={30} defaultValue={initial.overdueRepeat.intervalDays} className="input w-16 text-center" />
              day(s)
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn btn-primary btn-sm">{pending ? "Saving…" : "Save Automation Settings"}</button>
        {state?.success && <span className="text-[12px] text-emerald-600">Saved.</span>}
      </div>
    </form>
  );
}

function Cell({ name, defaultChecked }: { name: string; defaultChecked: boolean }) {
  return (
    <td className="px-2 py-2.5 text-center">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="h-4 w-4 accent-[var(--brand)]" />
    </td>
  );
}
