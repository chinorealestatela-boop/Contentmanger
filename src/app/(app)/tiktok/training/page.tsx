import { prisma } from "@/lib/prisma";
import { listKnowledge } from "@/lib/queries/tiktok";
import { TikTokTabs } from "@/components/tiktok/TikTokTabs";
import { SectionCard } from "@/components/ui/SectionCard";
import { KnowledgeForm } from "@/components/tiktok/KnowledgeForm";
import { KnowledgeList } from "@/components/tiktok/KnowledgeList";
import { TIKTOK_KNOWLEDGE_TYPES } from "@/lib/constants";

export default async function TrainingCenterPage() {
  const [items, pendingReview] = await Promise.all([listKnowledge(), prisma.tikTokEscalation.count({ where: { status: "PENDING" } })]);

  const corrections = items.filter((i) => i.type === "CORRECTION");
  const everythingElse = items.filter((i) => i.type !== "CORRECTION");

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text)]">TikTok AI Training Center</h1>
        <p className="text-[13px] text-[var(--text-muted)]">
          Everything here shapes how the AI talks and what it&rsquo;s allowed to say. Nothing the AI states as fact comes from anywhere else.
        </p>
      </div>

      <TikTokTabs pendingReview={pendingReview} />

      <SectionCard title="Add Knowledge">
        <KnowledgeForm />
        <p className="mt-2 text-[11px] text-[var(--text-faint)]">
          Categories: {TIKTOK_KNOWLEDGE_TYPES.map((t) => t.label).join(" · ")}. Policy entries (hours, location, financing, credit, licenses,
          documents, applications) are the only source the AI will quote numbers/facts from for those topics.
        </p>
      </SectionCard>

      {corrections.length > 0 && (
        <SectionCard title={`Corrections (${corrections.length})`}>
          <KnowledgeList items={corrections} />
        </SectionCard>
      )}

      <SectionCard title={`Knowledge, Examples & Policies (${everythingElse.length})`}>
        <KnowledgeList items={everythingElse} />
      </SectionCard>
    </div>
  );
}
