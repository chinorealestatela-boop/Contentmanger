"use client";

import { useTransition } from "react";
import { setGlobalMode } from "@/lib/actions/tiktok";
import { TIKTOK_MODES, type TikTokMode } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function GlobalModeButtons({ mode }: { mode: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {TIKTOK_MODES.map((m) => {
        const [title, desc] = m.label.split(" — ");
        const active = mode === m.value;
        return (
          <button
            key={m.value}
            disabled={pending}
            onClick={() => startTransition(() => setGlobalMode(m.value as TikTokMode))}
            className={cn("rounded-xl border p-3 text-left transition-colors", active ? "border-[var(--brand)] bg-[var(--brand-soft)]" : "border-[var(--border)] hover:bg-[var(--bg-subtle)]")}
          >
            <p className="text-[13px] font-semibold text-[var(--text)]">{title}</p>
            <p className="mt-0.5 text-[11.5px] text-[var(--text-muted)]">{desc}</p>
          </button>
        );
      })}
    </div>
  );
}
