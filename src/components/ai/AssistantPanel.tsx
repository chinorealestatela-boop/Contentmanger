"use client";

import { useRef, useState, useTransition } from "react";
import { Sparkles, X, Send } from "lucide-react";
import { askAssistant } from "@/lib/actions/assistant";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Who should I call today?",
  "Who are my hottest leads?",
  "Which leads are closest to buying?",
  "Write a reactivation message for a lost customer",
];

export function AssistantPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Hi! I'm your CRM assistant. I read directly from your customer data — ask me who to call, which leads are hottest, or have me draft a message." },
  ]);
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();
  const listRef = useRef<HTMLDivElement>(null);

  function send(q: string) {
    if (!q.trim() || pending) return;
    const next: Msg[] = [...messages, { role: "user", content: q }];
    setMessages(next);
    setInput("");
    startTransition(async () => {
      const res = await askAssistant(q, next);
      setMessages((prev) => [...prev, { role: "assistant", content: res.answer }]);
      queueMicrotask(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }));
    });
  }

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <div className="animate-fade-in fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-[var(--border)] bg-[var(--bg-elevated)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3.5">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-amber-500" />
            <div>
              <p className="text-sm font-semibold">AI Sales Assistant</p>
              <p className="text-[11px] text-[var(--text-muted)]">Runs on your CRM data — no API key needed</p>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm !p-1.5"><X size={16} /></button>
        </div>

        <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {messages.map((m, i) => (
            <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed",
                  m.role === "user" ? "rounded-br-sm bg-[var(--brand)] text-white" : "rounded-bl-sm bg-[var(--bg-subtle)] text-[var(--text)]"
                )}
              >
                {m.content}
              </div>
            </div>
          ))}
          {pending && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-sm bg-[var(--bg-subtle)] px-3.5 py-2.5 text-[13px] text-[var(--text-muted)]">Thinking…</div>
            </div>
          )}
        </div>

        {messages.length <= 1 && (
          <div className="flex flex-wrap gap-1.5 px-4 pb-2">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => send(s)} className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[11px] text-[var(--text-muted)] hover:border-[var(--brand)] hover:text-[var(--brand)]">
                {s}
              </button>
            ))}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-center gap-2 border-t border-[var(--border)] p-3"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about a customer, or type 'help'…"
            className="input"
          />
          <button type="submit" disabled={pending} className="btn btn-primary !p-2.5"><Send size={15} /></button>
        </form>
      </div>
    </>
  );
}
