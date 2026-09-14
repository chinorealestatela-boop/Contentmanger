"use client";

import { useRef, useState, useTransition } from "react";
import { Sparkles, X, Send } from "lucide-react";
import { askAssistant } from "@/lib/actions/assistant";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Show me all uncontacted leads from today",
  "Which vehicles are available Saturday?",
  "Who needs a follow-up?",
  "Show me tomorrow's schedule",
  "Which vehicle is closest to LAX?",
];

export function AssistantPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Good day — I'm your Stratos Exotics AI assistant. I read live from your CRM data. Ask me about leads, the fleet, today's schedule, or unpaid balances, and I'll draft messages for you too." },
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
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="animate-fade-in card fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col rounded-none border-l">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--brand-line)] bg-[var(--brand-soft)] text-[var(--brand-bright)]">
              <Sparkles size={15} />
            </span>
            <div>
              <p className="text-sm font-semibold text-[var(--text)]">AI Assistant</p>
              <p className="text-[11px] text-[var(--text-muted)]">Reads your live CRM data — no API key needed</p>
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
                  m.role === "user" ? "rounded-br-sm bg-[var(--brand)] text-[#14120a]" : "rounded-bl-sm bg-white/[0.05] border border-[var(--border)] text-[var(--text)]"
                )}
              >
                {m.content}
              </div>
            </div>
          ))}
          {pending && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-sm border border-[var(--border)] bg-white/[0.05] px-3.5 py-2.5 text-[13px] text-[var(--text-muted)]">Thinking…</div>
            </div>
          )}
        </div>

        {messages.length <= 1 && (
          <div className="flex flex-wrap gap-1.5 px-4 pb-2">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => send(s)} className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[11px] text-[var(--text-muted)] hover:border-[var(--brand-line)] hover:text-[var(--brand-bright)]">
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
            placeholder="Ask about a lead, booking, or vehicle…"
            className="input"
          />
          <button type="submit" disabled={pending} className="btn btn-primary !p-2.5"><Send size={15} /></button>
        </form>
      </div>
    </>
  );
}
