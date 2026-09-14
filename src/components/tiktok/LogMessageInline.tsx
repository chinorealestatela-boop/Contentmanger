"use client";

import { useState, useTransition } from "react";
import { MessageCirclePlus } from "lucide-react";
import { processInboundMessage } from "@/lib/actions/tiktok";

export function LogMessageInline({ conversationId }: { conversationId: string }) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 border-t border-[var(--border)] p-2.5 text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--brand)]">
        <MessageCirclePlus size={14} /> Log another message from this customer
      </button>
    );
  }

  return (
    <div className="space-y-1.5 border-t border-[var(--border)] p-3">
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="Paste the customer's next message…" className="input text-[13px]" />
      <div className="flex justify-end gap-1.5">
        <button onClick={() => setOpen(false)} className="btn btn-ghost btn-sm">Cancel</button>
        <button
          disabled={pending || !text.trim()}
          onClick={() =>
            startTransition(async () => {
              await processInboundMessage(conversationId, text);
              setText("");
              setOpen(false);
            })
          }
          className="btn btn-primary btn-sm"
        >
          {pending ? "Processing…" : "Log Message"}
        </button>
      </div>
    </div>
  );
}
