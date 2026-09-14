"use client";

import { useActionState, useState, useEffect } from "react";
import { correctResponse } from "@/lib/actions/tiktok";
import { PenLine } from "lucide-react";

export function CorrectionForm({ messageId }: { messageId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(correctResponse, null);

  useEffect(() => {
    if (!state?.success) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- closing this inline form after a successful save, not syncing render state
    setOpen(false);
  }, [state]);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-[var(--text-faint)] hover:text-[var(--brand)]">
        <PenLine size={11} /> Correct this response
      </button>
    );
  }

  return (
    <form action={formAction} className="mt-1.5 space-y-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] p-2.5">
      <input type="hidden" name="messageId" value={messageId} />
      {state?.error && <p className="text-[11px] text-red-600">{state.error}</p>}
      <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">What would you have said instead?</p>
      <textarea name="correctedText" required rows={2} className="input text-[13px]" placeholder="Type the response you'd actually send…" />
      <div className="flex justify-end gap-1.5">
        <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost btn-sm">Cancel</button>
        <button type="submit" disabled={pending} className="btn btn-primary btn-sm">{pending ? "Saving…" : "Save Correction"}</button>
      </div>
    </form>
  );
}
