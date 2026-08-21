import Link from "next/link";
import { Plus } from "lucide-react";
import { requireScope } from "@/lib/queries/scope";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/Badge";
import { SequenceToggle } from "@/components/sequences/SequenceToggle";

export default async function FollowUpSequencesPage() {
  await requireScope();
  const sequences = await prisma.followUpSequence.findMany({
    include: { steps: true, _count: { select: { enrollments: { where: { status: "ACTIVE" } } } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text)]">Follow-Up Sequences</h1>
          <p className="text-[13px] text-[var(--text-muted)]">Automated cadences that create tasks on a schedule — day 0 through 30 and beyond.</p>
        </div>
        <Link href="/follow-up-sequences/new" className="btn btn-primary"><Plus size={15} /> New Sequence</Link>
      </div>

      <div className="space-y-2.5">
        {sequences.map((seq) => (
          <div key={seq.id} className="card flex items-center justify-between gap-4 p-4">
            <Link href={`/follow-up-sequences/${seq.id}`} className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-[13.5px] font-semibold text-[var(--text)] hover:text-[var(--brand)]">{seq.name}</p>
                {seq.isDefault && <Badge variant="neutral">Default</Badge>}
                <Badge variant="appointment">{seq.trigger.replace(/_/g, " ")}</Badge>
              </div>
              <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">{seq.description}</p>
              <p className="mt-1 text-[11.5px] text-[var(--text-faint)]">{seq.steps.length} steps · {seq._count.enrollments} active enrollment{seq._count.enrollments === 1 ? "" : "s"}</p>
            </Link>
            <SequenceToggle id={seq.id} active={seq.active} />
          </div>
        ))}
      </div>
    </div>
  );
}
