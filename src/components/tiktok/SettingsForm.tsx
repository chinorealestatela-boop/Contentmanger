"use client";

import { useActionState } from "react";
import { updateTikTokSettings } from "@/lib/actions/tiktok";
import type { TikTokAISettings } from "@prisma/client";

export function SettingsForm({ settings }: { settings: TikTokAISettings }) {
  const [state, formAction, pending] = useActionState(updateTikTokSettings, null);

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</div>}
      {state?.success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.success}</div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Auto-send threshold</label>
          <input name="autoThreshold" type="number" min={0} max={100} defaultValue={settings.autoThreshold} className="input" />
          <p className="mt-1 text-[11px] text-[var(--text-faint)]">Confidence needed for AUTO mode to send without your review.</p>
        </div>
        <div>
          <label className="label">Draft threshold</label>
          <input name="draftThreshold" type="number" min={0} max={100} defaultValue={settings.draftThreshold} className="input" />
          <p className="mt-1 text-[11px] text-[var(--text-faint)]">Below this, the AI escalates to Human Review instead of drafting anything.</p>
        </div>
      </div>

      <div>
        <label className="label">Dealership / business name</label>
        <input name="businessName" defaultValue={settings.businessName ?? ""} className="input" />
      </div>

      <div>
        <label className="label">Chino Voice Notes</label>
        <textarea name="voiceNotes" rows={3} defaultValue={settings.voiceNotes ?? ""} placeholder="Describe how you naturally talk to customers — tone, favorite phrases, what to avoid." className="input" />
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={pending} className="btn btn-primary">{pending ? "Saving…" : "Save Settings"}</button>
      </div>
    </form>
  );
}
