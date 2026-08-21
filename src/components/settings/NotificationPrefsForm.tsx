"use client";

import { useState, useTransition } from "react";
import { updateNotificationPrefs } from "@/lib/actions/settings";
import { NOTIFICATION_TYPES } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function NotificationPrefsForm({ initial }: { initial: Record<string, boolean> }) {
  const [prefs, setPrefs] = useState<Record<string, boolean>>(initial);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function toggle(key: string) {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    setSaved(false);
    startTransition(async () => {
      await updateNotificationPrefs(next);
      setSaved(true);
    });
  }

  return (
    <div className="space-y-1">
      {NOTIFICATION_TYPES.map((t) => {
        const active = prefs[t.value] !== false;
        return (
          <div key={t.value} className="flex items-center justify-between border-b border-[var(--border)] py-3 last:border-0">
            <span className="text-[13.5px] text-[var(--text)]">{t.label}</span>
            <button
              disabled={pending}
              onClick={() => toggle(t.value)}
              className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", active ? "bg-emerald-500" : "bg-[var(--border)]")}
            >
              <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", active ? "translate-x-5" : "translate-x-0.5")} />
            </button>
          </div>
        );
      })}
      {saved && <p className="pt-2 text-xs text-emerald-600">Saved.</p>}
    </div>
  );
}
