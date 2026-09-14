"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toggleKnowledge, deleteKnowledge } from "@/lib/actions/tiktok";
import { optionLabel, TIKTOK_KNOWLEDGE_TYPES } from "@/lib/constants";
import { formatTimeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TikTokKnowledge, User } from "@prisma/client";

export function KnowledgeList({ items }: { items: (TikTokKnowledge & { author: User | null })[] }) {
  const [pending, startTransition] = useTransition();

  if (items.length === 0) return <p className="py-6 text-center text-[13px] text-[var(--text-muted)]">Nothing here yet.</p>;

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.id} className={cn("rounded-lg border border-[var(--border)] p-3", !item.active && "opacity-50")}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="badge badge-neutral">{optionLabel(TIKTOK_KNOWLEDGE_TYPES, item.type)}</span>
                {item.title && <p className="text-[13px] font-semibold text-[var(--text)]">{item.title}</p>}
                <span className="text-[10.5px] text-[var(--text-faint)]">v{item.version}</span>
              </div>
              {item.incorrectResponse && (
                <p className="mt-1 text-[11.5px] text-[var(--text-faint)]">
                  Instead of: <span className="line-through">{item.incorrectResponse}</span>
                </p>
              )}
              <p className="mt-1 whitespace-pre-wrap text-[13px] text-[var(--text)]">{item.content}</p>
              <p className="mt-1 text-[10.5px] text-[var(--text-faint)]">
                {item.author ? `${item.author.firstName} ${item.author.lastName} · ` : ""}
                {formatTimeAgo(item.updatedAt)}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <button
                disabled={pending}
                onClick={() => startTransition(() => toggleKnowledge(item.id, !item.active))}
                className="btn btn-ghost btn-sm"
              >
                {item.active ? "Deactivate" : "Activate"}
              </button>
              <button disabled={pending} onClick={() => startTransition(() => deleteKnowledge(item.id))} className="btn btn-ghost btn-sm text-red-600"><Trash2 size={13} /></button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
