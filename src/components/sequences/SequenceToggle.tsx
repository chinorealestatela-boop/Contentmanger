"use client";

import { useTransition } from "react";
import { toggleSequence } from "@/lib/actions/sequences";
import { cn } from "@/lib/utils";

export function SequenceToggle({ id, active }: { id: string; active: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => startTransition(() => toggleSequence(id, !active))}
      className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", active ? "bg-emerald-500" : "bg-[var(--border)]")}
      aria-label={active ? "Deactivate sequence" : "Activate sequence"}
    >
      <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", active ? "translate-x-5" : "translate-x-0.5")} />
    </button>
  );
}
