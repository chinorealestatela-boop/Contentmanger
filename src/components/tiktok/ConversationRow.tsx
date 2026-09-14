import Link from "next/link";
import { TikTokTemperatureBadge, TikTokModeBadge } from "@/components/tiktok/badges";
import { formatTimeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TikTokConversation, TikTokMessage, TikTokEscalation } from "@prisma/client";

type Row = TikTokConversation & { messages: TikTokMessage[]; escalations: TikTokEscalation[] };

export function ConversationRow({ conversation }: { conversation: Row }) {
  const lastMessage = conversation.messages[0];
  const needsReview = conversation.escalations.length > 0;
  return (
    <Link
      href={`/tiktok/${conversation.id}`}
      className={cn("flex items-start gap-3 border-b border-[var(--border)] p-4 last:border-0 hover:bg-[var(--bg-subtle)]", conversation.unread && "bg-[var(--brand-soft)]/40")}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--bg-subtle)] text-[13px] font-semibold text-[var(--text-muted)]">
        {(conversation.tiktokDisplayName || conversation.tiktokUsername).slice(0, 1).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className={cn("text-[13.5px]", conversation.unread ? "font-bold text-[var(--text)]" : "font-semibold text-[var(--text)]")}>
            {conversation.tiktokDisplayName || `@${conversation.tiktokUsername}`}
          </p>
          <TikTokTemperatureBadge temperature={conversation.temperature} />
          {needsReview && <span className="badge badge-overdue">Human Review</span>}
          <TikTokModeBadge mode={conversation.mode} />
        </div>
        <p className="mt-0.5 truncate text-[12.5px] text-[var(--text-muted)]">
          {lastMessage ? `${lastMessage.direction === "IN" ? "" : "You: "}${lastMessage.body}` : "No messages yet."}
        </p>
        {conversation.vehicleInterest && <p className="mt-0.5 text-[11px] text-[var(--text-faint)]">Interested in: {conversation.vehicleInterest}</p>}
      </div>
      <span className="shrink-0 text-[11px] text-[var(--text-faint)]">{conversation.lastInboundAt ? formatTimeAgo(conversation.lastInboundAt) : ""}</span>
    </Link>
  );
}
