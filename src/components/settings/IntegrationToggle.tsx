"use client";

import { useTransition } from "react";
import { toggleIntegration } from "@/lib/actions/settings";
import { cn } from "@/lib/utils";

export function IntegrationToggle({ provider, enabled, disabled }: { provider: string; enabled: boolean; disabled?: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      disabled={pending || disabled}
      onClick={() => startTransition(() => toggleIntegration(provider, !enabled))}
      className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40", enabled ? "bg-[var(--success)]" : "bg-white/10")}
      aria-label={enabled ? "Disconnect" : "Connect"}
    >
      <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", enabled ? "translate-x-5" : "translate-x-0.5")} />
    </button>
  );
}
