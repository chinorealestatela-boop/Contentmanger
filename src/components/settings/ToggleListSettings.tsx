"use client";

import { useActionState, useRef, useEffect, useTransition } from "react";
import { Plus } from "lucide-react";
import type { SimpleActionState } from "@/lib/actions/communications";
import { cn } from "@/lib/utils";

export function ToggleListSettings({
  items,
  createAction,
  toggleAction,
  placeholder,
}: {
  items: { id: string; name: string; active: boolean }[];
  createAction: (prev: SimpleActionState, formData: FormData) => Promise<SimpleActionState>;
  toggleAction: (id: string, active: boolean) => Promise<void>;
  placeholder: string;
}) {
  const [state, formAction, pending] = useActionState(createAction, null);
  const [, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <div className="card p-5">
      <div className="space-y-1">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between border-b border-[var(--border)] py-2.5 last:border-0">
            <span className={cn("text-[13.5px]", !item.active && "text-[var(--text-faint)] line-through")}>{item.name}</span>
            <button
              onClick={() => startTransition(() => toggleAction(item.id, !item.active))}
              className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", item.active ? "bg-emerald-500" : "bg-[var(--border)]")}
            >
              <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", item.active ? "translate-x-5" : "translate-x-0.5")} />
            </button>
          </div>
        ))}
        {items.length === 0 && <p className="py-4 text-center text-sm text-[var(--text-faint)]">None yet.</p>}
      </div>
      <form ref={formRef} action={formAction} className="mt-4 flex gap-2 border-t border-[var(--border)] pt-4">
        <input name="name" required placeholder={placeholder} className="input" />
        <button type="submit" disabled={pending} className="btn btn-primary shrink-0"><Plus size={14} /> Add</button>
      </form>
      {state?.error && <p className="mt-2 text-xs text-red-600">{state.error}</p>}
    </div>
  );
}
