"use client";

import { useActionState, useRef, useEffect, useTransition } from "react";
import { ArrowUp, ArrowDown, Plus } from "lucide-react";
import { createPipelineStage, toggleStageActive, moveStage } from "@/lib/actions/settings";
import { ColorPill } from "@/components/ui/Badge";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

type Stage = { id: string; name: string; color: string; active: boolean; isClosedWon: boolean; isClosedLost: boolean };

export function PipelineStagesSettings({ stages }: { stages: Stage[] }) {
  const [state, formAction, pending] = useActionState(createPipelineStage, null);
  const [, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <div className="card p-5">
      <div className="space-y-1.5">
        {stages.map((s, i) => (
          <div key={s.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3.5 py-2.5">
            <div className="flex items-center gap-2.5">
              <div className="flex flex-col">
                <button disabled={i === 0} onClick={() => startTransition(() => moveStage(s.id, "up"))} className="text-[var(--text-faint)] hover:text-[var(--text)] disabled:opacity-30"><ArrowUp size={12} /></button>
                <button disabled={i === stages.length - 1} onClick={() => startTransition(() => moveStage(s.id, "down"))} className="text-[var(--text-faint)] hover:text-[var(--text)] disabled:opacity-30"><ArrowDown size={12} /></button>
              </div>
              <ColorPill color={s.color}>{s.name}</ColorPill>
              {s.isClosedWon && <Badge variant="sold">Closed Won</Badge>}
              {s.isClosedLost && <Badge variant="lost">Closed Lost</Badge>}
              {!s.active && <Badge variant="neutral">Inactive</Badge>}
            </div>
            <button
              onClick={() => startTransition(() => toggleStageActive(s.id, !s.active))}
              className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", s.active ? "bg-emerald-500" : "bg-[var(--border)]")}
            >
              <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", s.active ? "translate-x-5" : "translate-x-0.5")} />
            </button>
          </div>
        ))}
      </div>

      <form ref={formRef} action={formAction} className="mt-4 space-y-3 border-t border-[var(--border)] pt-4">
        {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
        <div className="flex gap-2">
          <input name="name" required placeholder="New stage name" className="input" />
          <input name="color" type="color" defaultValue="#2563eb" className="h-[38px] w-14 shrink-0 rounded-lg border border-[var(--border)]" />
        </div>
        <div className="flex gap-4 text-[12.5px]">
          <label className="flex items-center gap-1.5"><input type="checkbox" name="isClosedWon" className="h-4 w-4" /> Closed Won</label>
          <label className="flex items-center gap-1.5"><input type="checkbox" name="isClosedLost" className="h-4 w-4" /> Closed Lost</label>
        </div>
        <button type="submit" disabled={pending} className="btn btn-primary"><Plus size={14} /> Add Stage</button>
      </form>
    </div>
  );
}
