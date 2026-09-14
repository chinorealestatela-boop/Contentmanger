import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getConversation } from "@/lib/queries/tiktok";
import { TikTokStatusBadge, TikTokTemperatureBadge } from "@/components/tiktok/badges";
import { ModeSelect } from "@/components/tiktok/ModeSelect";
import { TakeOverButton } from "@/components/tiktok/TakeOverButton";
import { EscalationBanner } from "@/components/tiktok/EscalationBanner";
import { MessageThread } from "@/components/tiktok/MessageThread";
import { ManualReplyBox } from "@/components/tiktok/ManualReplyBox";
import { LogMessageInline } from "@/components/tiktok/LogMessageInline";
import { ProfileSidebar } from "@/components/tiktok/ProfileSidebar";
import { MarkReadOnView } from "@/components/tiktok/MarkReadOnView";

export default async function TikTokConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const conversation = await getConversation(id);
  if (!conversation) notFound();

  const pendingEscalation = conversation.escalations.find((e) => e.status === "PENDING");

  return (
    <div className="mx-auto flex h-[calc(100vh-56px)] max-w-6xl flex-col gap-4 p-4 sm:h-[calc(100vh-72px)] sm:p-6 lg:flex-row">
      <MarkReadOnView conversationId={conversation.id} unread={conversation.unread} />
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Link href="/tiktok" className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]"><ArrowLeft size={16} /></Link>
            <div>
              <h1 className="text-[16px] font-semibold text-[var(--text)]">{conversation.tiktokDisplayName || `@${conversation.tiktokUsername}`}</h1>
              <div className="mt-0.5 flex items-center gap-1.5">
                <TikTokStatusBadge status={conversation.status} />
                <TikTokTemperatureBadge temperature={conversation.temperature} />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ModeSelect conversationId={conversation.id} mode={conversation.mode} />
            <TakeOverButton conversationId={conversation.id} alreadyTakenOver={Boolean(conversation.humanTakeoverAt)} />
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)]">
          {pendingEscalation && <EscalationBanner escalation={pendingEscalation} />}
          <MessageThread messages={conversation.messages} />
          <LogMessageInline conversationId={conversation.id} />
          <ManualReplyBox conversationId={conversation.id} />
        </div>
      </div>

      <div className="w-full shrink-0 lg:w-72">
        <ProfileSidebar conversation={conversation} />
      </div>
    </div>
  );
}
