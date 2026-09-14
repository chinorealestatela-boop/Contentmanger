import Link from "next/link";
import { MessageCircle, Flame, Sun, CalendarClock, AlertTriangle } from "lucide-react";
import { listConversations, type ConversationFilter } from "@/lib/queries/tiktok";
import { getDashboardStats } from "@/lib/tiktok/analytics";
import { prisma } from "@/lib/prisma";
import { TikTokTabs } from "@/components/tiktok/TikTokTabs";
import { ConversationRow } from "@/components/tiktok/ConversationRow";
import { IngestForm } from "@/components/tiktok/IngestForm";
import { StatCard } from "@/components/dashboard/StatCard";
import { cn } from "@/lib/utils";

const FILTERS: { value: ConversationFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "UNREAD", label: "Unread" },
  { value: "HOT", label: "Hot" },
  { value: "WARM", label: "Warm" },
  { value: "APPOINTMENTS", label: "Appointments" },
  { value: "HUMAN_REVIEW", label: "Human Review" },
  { value: "AI_ACTIVE", label: "AI Active" },
  { value: "AI_OFF", label: "AI Off" },
];

export default async function TikTokInboxPage({ searchParams }: { searchParams: Promise<{ filter?: string; q?: string }> }) {
  const sp = await searchParams;
  const filter = (FILTERS.some((f) => f.value === sp.filter) ? sp.filter : "ALL") as ConversationFilter;
  const [conversations, stats, pendingReview] = await Promise.all([
    listConversations(filter, sp.q),
    getDashboardStats(),
    prisma.tikTokEscalation.count({ where: { status: "PENDING" } }),
  ]);

  const cards = [
    { label: "Conversations", value: stats.totalConversations, icon: MessageCircle, href: "/tiktok", tone: "default" as const },
    { label: "Hot Leads", value: stats.hotLeads, icon: Flame, href: "/tiktok?filter=HOT", tone: "hot" as const },
    { label: "Warm Leads", value: stats.warmLeads, icon: Sun, href: "/tiktok?filter=WARM", tone: "warm" as const },
    { label: "Appointments Requested", value: stats.appointments, icon: CalendarClock, href: "/tiktok?filter=APPOINTMENTS", tone: "appointment" as const },
    { label: "Human Review", value: stats.humanReview, icon: AlertTriangle, href: "/tiktok/review", tone: "overdue" as const },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text)]">TikTok AI Assistant</h1>
          <p className="text-[13px] text-[var(--text-muted)]">AI response rate {stats.aiResponseRate}% · Escalation rate {stats.escalationRate}%</p>
        </div>
        <IngestForm />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => (
          <StatCard key={c.label} {...c} />
        ))}
      </div>

      <TikTokTabs pendingReview={pendingReview} />

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <Link key={f.value} href={f.value === "ALL" ? "/tiktok" : `/tiktok?filter=${f.value}`} className={cn("badge", filter === f.value ? "bg-[var(--brand)] text-white" : "badge-neutral")}>
            {f.label}
          </Link>
        ))}
      </div>

      <div className="card">
        {conversations.length === 0 && (
          <div className="p-10 text-center text-sm text-[var(--text-muted)]">
            No conversations yet. Log a TikTok DM above to get started — the AI will read it, decide how confident it is, and either draft a reply, ask a clarifying question, or flag it for you.
          </div>
        )}
        {conversations.map((c) => (
          <ConversationRow key={c.id} conversation={c} />
        ))}
      </div>
    </div>
  );
}
