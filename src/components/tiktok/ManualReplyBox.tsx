"use client";

import { useRef, useState, useTransition } from "react";
import { Send } from "lucide-react";
import { sendManualReply } from "@/lib/actions/tiktok";

export function ManualReplyBox({ conversationId }: { conversationId: string }) {
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLTextAreaElement>(null);

  function submit() {
    if (!text.trim()) return;
    startTransition(async () => {
      await sendManualReply(conversationId, text);
      setText("");
      ref.current?.focus();
    });
  }

  return (
    <div className="flex items-end gap-2 border-t border-[var(--border)] p-3">
      <textarea
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        rows={1}
        placeholder="Write a reply yourself…"
        className="input flex-1 resize-none"
      />
      <button disabled={pending || !text.trim()} onClick={submit} className="btn btn-primary btn-sm inline-flex items-center gap-1.5">
        <Send size={14} /> Send
      </button>
    </div>
  );
}
