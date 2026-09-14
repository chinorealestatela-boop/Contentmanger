"use client";

import { useActionState, useRef, useEffect } from "react";
import { addKnowledge } from "@/lib/actions/tiktok";
import { TIKTOK_KNOWLEDGE_TYPES } from "@/lib/constants";

export function KnowledgeForm() {
  const [state, formAction, pending] = useActionState(addKnowledge, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-2.5">
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
      {state?.success && <p className="text-xs text-emerald-600">{state.success}</p>}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[180px_1fr]">
        <select name="type" className="input" defaultValue="KNOWLEDGE">
          {TIKTOK_KNOWLEDGE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <input name="title" placeholder="Title (optional)" className="input" />
      </div>
      <textarea name="content" required rows={3} placeholder={'What Chino would actually say — e.g. "We work with all credit situations, even first-time buyers. A $500-1000 down payment usually gets things moving."'} className="input" />
      <input name="tags" placeholder="Tags, comma-separated (e.g. financing, down payment)" className="input" />
      <div className="flex justify-end">
        <button type="submit" disabled={pending} className="btn btn-primary btn-sm">{pending ? "Saving…" : "Add to Training Center"}</button>
      </div>
    </form>
  );
}
