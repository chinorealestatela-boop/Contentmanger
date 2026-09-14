"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { ingestInboundMessage } from "@/lib/actions/tiktok";
import { MessageCirclePlus } from "lucide-react";

export function IngestForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(ingestInboundMessage, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state?.success) return;
    formRef.current?.reset();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- closing the compose panel after a successful submit, not syncing render state
    setOpen(false);
  }, [state]);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn btn-secondary btn-sm inline-flex items-center gap-1.5">
        <MessageCirclePlus size={14} /> Log a TikTok DM
      </button>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="card space-y-2.5 p-4">
      <p className="text-[12px] text-[var(--text-muted)]">
        TikTok doesn&rsquo;t give us a live inbox yet — paste in what a customer sent (or a new DM) and the AI will read it the same way it would from a real connection.
      </p>
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input name="tiktokUsername" required placeholder="@tiktok_username" className="input" />
        <input name="tiktokDisplayName" placeholder="Display name (optional)" className="input" />
      </div>
      <textarea name="text" required rows={2} placeholder="Paste the customer's message exactly as they typed it…" className="input" />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className="btn btn-secondary btn-sm">Cancel</button>
        <button type="submit" disabled={pending} className="btn btn-primary btn-sm">{pending ? "Processing…" : "Log Message"}</button>
      </div>
    </form>
  );
}
