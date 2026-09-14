import Link from "next/link";
import { listEscalations } from "@/lib/queries/tiktok";
import { TikTokTabs } from "@/components/tiktok/TikTokTabs";
import { EscalationBanner } from "@/components/tiktok/EscalationBanner";
import { formatTimeAgo } from "@/lib/format";

export default async function ReviewQueuePage() {
  const escalations = await listEscalations("PENDING");

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text)]">Human Review Queue</h1>
        <p className="text-[13px] text-[var(--text-muted)]">Every message the AI wasn&rsquo;t confident enough to answer on its own — accuracy over speed.</p>
      </div>

      <TikTokTabs pendingReview={escalations.length} />

      {escalations.length === 0 && (
        <div className="card p-10 text-center text-sm text-[var(--text-muted)]">Nothing needs your attention right now.</div>
      )}

      <div className="space-y-4">
        {escalations.map((e) => (
          <div key={e.id} className="card overflow-hidden">
            <Link href={`/tiktok/${e.conversationId}`} className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2.5 hover:bg-[var(--bg-subtle)]">
              <span className="text-[13px] font-semibold text-[var(--text)]">{e.conversation.tiktokDisplayName || `@${e.conversation.tiktokUsername}`}</span>
              <span className="text-[11px] text-[var(--text-faint)]">{formatTimeAgo(e.createdAt)}</span>
            </Link>
            {e.message && <p className="border-b border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-2 text-[13px] italic text-[var(--text)]">&ldquo;{e.message.body}&rdquo;</p>}
            <EscalationBanner escalation={e} />
          </div>
        ))}
      </div>
    </div>
  );
}
