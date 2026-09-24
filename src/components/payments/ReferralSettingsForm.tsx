"use client";

import { useActionState, useState } from "react";
import { saveReferralSettings } from "@/lib/actions/referrals";
import { renderThankYouTemplate } from "@/lib/payments/templates";
import { formatCurrency } from "@/lib/format";

/** Editable settings for the deferred-payment-completion follow-up
 * (Feature 5/6): the referral reward default and the one thank-you/
 * referral message template. Kept as its own small form rather than
 * folded into SmsTemplateManager above, which is purpose-built for the
 * multi-template, per-reminder-stage case — there's only ever one
 * thank-you message, so a dedicated editor with a live preview is more
 * direct for it. */
export function ReferralSettingsForm({ defaultRewardAmount, thankYouMessage }: { defaultRewardAmount: number; thankYouMessage: string }) {
  const [state, formAction, pending] = useActionState(saveReferralSettings, null);
  const [amount, setAmount] = useState(String(defaultRewardAmount));
  const [message, setMessage] = useState(thankYouMessage);

  const preview = renderThankYouTemplate(message || "…", { firstName: "John", referralAmount: formatCurrency(Number(amount) || 0) });

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state?.success && <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.success}</p>}

      <div>
        <label className="label">Referral Reward Amount</label>
        <div className="relative max-w-[160px]">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]">$</span>
          <input name="defaultRewardAmount" type="number" min={0} step="1" required value={amount} onChange={(e) => setAmount(e.target.value)} className="input pl-6" />
        </div>
        <p className="mt-1 text-[11.5px] text-[var(--text-faint)]">Applied to new referrals — editing this doesn&rsquo;t change rewards already recorded.</p>
      </div>

      <div>
        <label className="label">Thank-You &amp; Referral Message</label>
        <textarea name="thankYouMessage" required rows={5} value={message} onChange={(e) => setMessage(e.target.value)} className="input" />
        <p className="mt-1 text-[11px] text-[var(--text-faint)]">Variables: {"{{firstName}} {{referralAmount}}"}</p>
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] p-3">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">Preview</p>
        <p className="text-[13px] italic text-[var(--text)]">&ldquo;{preview}&rdquo;</p>
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={pending} className="btn btn-primary">{pending ? "Saving…" : "Save"}</button>
      </div>
    </form>
  );
}
