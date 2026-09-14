"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Send, Check } from "lucide-react";
import { resolveEscalation, sendSuggestedResponse } from "@/lib/actions/tiktok";
import { TikTokEscalationReasonBadge, TikTokIntentBadge, ConfidenceMeter } from "@/components/tiktok/badges";
import type { TikTokEscalation } from "@prisma/client";

export function EscalationBanner({ escalation }: { escalation: TikTokEscalation }) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  let suggestions: string[] = [];
  try {
    suggestions = escalation.suggestedResponses ? (JSON.parse(escalation.suggestedResponses) as string[]) : [];
  } catch {
    suggestions = [];
  }

  return (
    <div className="border-b border-red-200 bg-red-50 p-4">
      <div className="flex items-center gap-2">
        <AlertTriangle size={16} className="text-red-600" />
        <h3 className="text-[13.5px] font-bold uppercase tracking-wide text-red-700">Human Review Required</h3>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <TikTokEscalationReasonBadge reason={escalation.reason} />
        <TikTokIntentBadge intent={escalation.intent} />
        <ConfidenceMeter score={escalation.confidence} />
      </div>
      {escalation.aiInterpretation && <p className="mt-2 text-[13px] text-red-900">AI&rsquo;s read on this: &ldquo;{escalation.aiInterpretation}&rdquo;</p>}

      {suggestions.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-red-700">Suggested response{suggestions.length > 1 ? "s" : ""}</p>
          {suggestions.map((s, i) =>
            editing === s ? (
              <EditableSuggestion key={i} escalationId={escalation.id} initial={s} onCancel={() => setEditing(null)} />
            ) : (
              <div key={i} className="flex items-start gap-2 rounded-lg border border-red-200 bg-white p-2.5">
                <p className="flex-1 text-[13px] text-[var(--text)]">{s}</p>
                <div className="flex shrink-0 gap-1.5">
                  <button onClick={() => setEditing(s)} className="btn btn-ghost btn-sm">Edit</button>
                  <button
                    disabled={pending}
                    onClick={() => startTransition(() => sendSuggestedResponse(escalation.id, s))}
                    className="btn btn-primary btn-sm inline-flex items-center gap-1"
                  >
                    <Send size={12} /> Send
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}

      <div className="mt-3 flex justify-end">
        <button
          disabled={pending}
          onClick={() => startTransition(() => resolveEscalation(escalation.id, "Resolved without sending an AI-suggested response."))}
          className="btn btn-secondary btn-sm inline-flex items-center gap-1.5"
        >
          <Check size={13} /> Mark Resolved
        </button>
      </div>
    </div>
  );
}

function EditableSuggestion({ escalationId, initial, onCancel }: { escalationId: string; initial: string; onCancel: () => void }) {
  const [text, setText] = useState(initial);
  const [pending, startTransition] = useTransition();
  return (
    <div className="space-y-1.5 rounded-lg border border-red-200 bg-white p-2.5">
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} className="input text-[13px]" />
      <div className="flex justify-end gap-1.5">
        <button onClick={onCancel} className="btn btn-ghost btn-sm">Cancel</button>
        <button disabled={pending} onClick={() => startTransition(() => sendSuggestedResponse(escalationId, text))} className="btn btn-primary btn-sm inline-flex items-center gap-1">
          <Send size={12} /> Send
        </button>
      </div>
    </div>
  );
}
