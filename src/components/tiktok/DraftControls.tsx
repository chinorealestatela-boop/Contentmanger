"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Trash2 } from "lucide-react";
import { approveDraft, discardDraft, markMessageSent } from "@/lib/actions/tiktok";

export function DraftControls({ messageId, body, status }: { messageId: string; body: string; status: string }) {
  const [text, setText] = useState(body);
  const [pending, startTransition] = useTransition();

  if (status === "DRAFT") {
    return (
      <div className="mt-1.5 space-y-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] p-2.5">
        <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">AI Draft — needs your review</p>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} className="input text-[13px]" />
        <div className="flex justify-end gap-1.5">
          <button disabled={pending} onClick={() => startTransition(() => discardDraft(messageId))} className="btn btn-ghost btn-sm inline-flex items-center gap-1"><Trash2 size={12} /> Discard</button>
          <button disabled={pending} onClick={() => startTransition(() => approveDraft(messageId, text))} className="btn btn-primary btn-sm inline-flex items-center gap-1"><Check size={12} /> Approve</button>
        </div>
      </div>
    );
  }

  if (status === "QUEUED") {
    return (
      <div className="mt-1.5 flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] p-2">
        <p className="text-[11px] text-[var(--text-muted)]">Ready to send — copy this into TikTok, then mark it sent.</p>
        <div className="flex shrink-0 gap-1.5">
          <button onClick={() => navigator.clipboard?.writeText(body)} className="btn btn-ghost btn-sm inline-flex items-center gap-1"><Copy size={12} /> Copy</button>
          <button disabled={pending} onClick={() => startTransition(() => markMessageSent(messageId))} className="btn btn-primary btn-sm inline-flex items-center gap-1"><Check size={12} /> Mark Sent</button>
        </div>
      </div>
    );
  }

  if (status === "BLOCKED") {
    return <p className="mt-1 text-[11px] italic text-[var(--text-faint)]">Blocked by the safety guard before it could be sent — see the reason above.</p>;
  }

  return null;
}
