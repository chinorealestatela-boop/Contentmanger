"use client";

import { useActionState } from "react";
import { savePaymentAutomation } from "@/lib/actions/paymentAutomation";
import { PAYMENT_REMINDER_STAGES } from "@/lib/payments/status";
import type { PaymentAutomationSettings } from "@/lib/payments/reminders";

export function AutomationSettingsForm({ initial }: { initial: PaymentAutomationSettings }) {
  const [state, formAction, pending] = useActionState(savePaymentAutomation, null);

  return (
    <form action={formAction} className="space-y-3">
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
            {PAYMENT_REMINDER_STAGES.map((stage) => {
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
        &ldquo;Text Customer&rdquo; only ever sends to customers who&rsquo;ve given SMS consent — this never overrides that. The Overdue stage fires once, the day the payment first becomes overdue, not every day after.
      </p>
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
