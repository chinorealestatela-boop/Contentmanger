"use client";

import { useState, useTransition } from "react";
import { Smartphone, MessageSquare, Mail } from "lucide-react";
import { updateNotificationPrefs } from "@/lib/actions/settings";
import { CHANNEL_NOTIFICATION_TYPES } from "@/lib/constants";
import { cn } from "@/lib/utils";

type ChannelPrefs = { push?: boolean; sms?: boolean; email?: boolean };
type Prefs = Record<string, ChannelPrefs>;

// Real per-channel toggles (Push / SMS / Email) per event type — this is
// exactly what notifyAdmin() reads (src/lib/notify/adminAlert.ts) before
// deciding to actually call Twilio/Resend/web-push for a given alert, not
// a cosmetic settings screen with nothing behind it.
export function NotificationPrefsForm({ initial }: { initial: Prefs }) {
  const [prefs, setPrefs] = useState<Prefs>(initial);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function toggle(type: string, channel: keyof ChannelPrefs) {
    const next: Prefs = { ...prefs, [type]: { ...prefs[type], [channel]: !prefs[type]?.[channel] } };
    setPrefs(next);
    setSaved(false);
    startTransition(async () => {
      await updateNotificationPrefs(next);
      setSaved(true);
    });
  }

  return (
    <div>
      <div className="grid grid-cols-[1fr_repeat(3,44px)] items-center gap-x-2 gap-y-1 pb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">
        <span />
        <span className="flex justify-center" title="Push"><Smartphone size={13} /></span>
        <span className="flex justify-center" title="SMS"><MessageSquare size={13} /></span>
        <span className="flex justify-center" title="Email"><Mail size={13} /></span>
      </div>
      <div className="space-y-0.5">
        {CHANNEL_NOTIFICATION_TYPES.map((t) => (
          <div key={t.value} className="grid grid-cols-[1fr_repeat(3,44px)] items-center gap-x-2 border-b border-[var(--border)] py-2.5 last:border-0">
            <span className="text-[13px] text-[var(--text)]">{t.label}</span>
            {(["push", "sms", "email"] as const).map((channel) => (
              <label key={channel} className="flex justify-center">
                <input
                  type="checkbox"
                  disabled={pending}
                  checked={!!prefs[t.value]?.[channel]}
                  onChange={() => toggle(t.value, channel)}
                  className={cn("h-4 w-4 cursor-pointer accent-[var(--brand)]")}
                />
              </label>
            ))}
          </div>
        ))}
      </div>
      {saved && <p className="pt-2 text-xs text-emerald-600">Saved.</p>}
    </div>
  );
}
