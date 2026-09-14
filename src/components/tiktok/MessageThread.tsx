import { ConfidenceMeter, TikTokIntentBadge } from "@/components/tiktok/badges";
import { DraftControls } from "@/components/tiktok/DraftControls";
import { CorrectionForm } from "@/components/tiktok/CorrectionForm";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TikTokMessage } from "@prisma/client";

function paraphraseOf(m: TikTokMessage): string | null {
  if (!m.understanding) return null;
  try {
    return (JSON.parse(m.understanding) as { paraphrase?: string }).paraphrase ?? null;
  } catch {
    return null;
  }
}

export function MessageThread({ messages }: { messages: TikTokMessage[] }) {
  return (
    <div className="flex-1 space-y-3 overflow-y-auto p-4">
      {messages.length === 0 && <p className="py-10 text-center text-[13px] text-[var(--text-muted)]">No messages yet.</p>}
      {messages.map((m) => {
        const isIn = m.direction === "IN";
        const paraphrase = isIn ? paraphraseOf(m) : null;
        return (
          <div key={m.id} className={cn("flex flex-col", isIn ? "items-start" : "items-end")}>
            <div className={cn("max-w-[85%] rounded-2xl px-3.5 py-2 text-[13.5px]", isIn ? "bg-[var(--bg-subtle)] text-[var(--text)]" : m.status === "BLOCKED" ? "bg-red-50 text-red-800 line-through" : "bg-[var(--brand)] text-white")}>
              {m.body}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10.5px] text-[var(--text-faint)]">
              <span>{isIn ? "Customer" : m.senderType === "AI" ? "AI" : "You"} · {formatDateTime(m.createdAt)}</span>
              {m.editedByHuman && <span className="italic">· edited</span>}
            </div>
            {isIn && (paraphrase || m.intent) && (
              <div className="mt-1 flex flex-wrap items-center gap-1.5 rounded-md bg-[var(--bg-subtle)]/60 px-2 py-1 text-[11px] text-[var(--text-muted)]">
                {paraphrase && <span className="italic">&ldquo;{paraphrase}&rdquo;</span>}
                <TikTokIntentBadge intent={m.intent} />
                <ConfidenceMeter score={m.confidence} />
              </div>
            )}
            {!isIn && m.aiGenerated && <DraftControls messageId={m.id} body={m.body} status={m.status} />}
            {!isIn && m.status === "SENT" && <CorrectionForm messageId={m.id} />}
          </div>
        );
      })}
    </div>
  );
}
