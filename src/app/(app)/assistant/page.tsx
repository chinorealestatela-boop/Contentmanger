"use client";

import { useRef, useState, useTransition } from "react";
import { Sparkles, Send } from "lucide-react";
import { askAssistant } from "@/lib/actions/assistant";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Show me all uncontacted leads from today",
  "Which vehicles are available Saturday?",
  "How much revenue did the Sprinter generate this month?",
  "Who needs a follow-up?",
  "Show me tomorrow's schedule",
  "Which customers haven't paid their balance?",
  "Create a follow-up list for today's leads",
  "Which vehicle is currently closest to LAX?",
];

export default function AssistantPage() {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Good day — I'm your Stratos Exotics AI executive assistant. Ask me anything about leads, bookings, the fleet, payments, or today's schedule; I read live from your CRM data." },
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

  return (
    <div className="mx-auto flex h-[calc(100vh-64px)] max-w-3xl flex-col p-4 sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--brand-line)] bg-[var(--brand-soft)] text-[var(--brand-bright)]">
          <Sparkles size={18} />
        </span>
        <div>
          <h1 className="font-display text-2xl font-medium text-[var(--text)]">AI Assistant</h1>
          <p className="text-[12.5px] text-[var(--text-muted)]">Reads your live CRM data — no API key required</p>
        </div>
      </div>

      <div ref={listRef} className="card flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[13.5px] leading-relaxed",
                m.role === "user" ? "rounded-br-sm bg-[var(--brand)] text-[#14120a]" : "rounded-bl-sm border border-[var(--border)] bg-white/[0.04] text-[var(--text)]"
              )}
            >
              {m.content}
            </div>
          </div>
        ))}
        {pending && <div className="flex justify-start"><div className="rounded-2xl rounded-bl-sm border border-[var(--border)] bg-white/[0.04] px-4 py-2.5 text-[13.5px] text-[var(--text-muted)]">Thinking…</div></div>}
      </div>

      {messages.length <= 1 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
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
        className="mt-3 flex items-center gap-2"
      >
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about a lead, booking, or vehicle…" className="input" />
        <button type="submit" disabled={pending} className="btn btn-primary !p-3"><Send size={16} /></button>
      </form>
    </div>
  );
}
