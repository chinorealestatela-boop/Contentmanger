import { notFound } from "next/navigation";
import { requireScope } from "@/lib/queries/scope";
import { prisma } from "@/lib/prisma";
import { SectionCard, EmptyRow } from "@/components/ui/SectionCard";
import { AddStepForm } from "@/components/sequences/AddStepForm";
import { RemoveStepButton } from "@/components/sequences/RemoveStepButton";
import { optionLabel, TASK_TYPES } from "@/lib/constants";

export default async function SequenceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireScope();
  const sequence = await prisma.followUpSequence.findUnique({
    where: { id },
    include: { steps: { orderBy: { order: "asc" } } },
  });
  if (!sequence) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text)]">{sequence.name}</h1>
        <p className="text-[13px] text-[var(--text-muted)]">{sequence.description}</p>
      </div>

      <SectionCard title={`Steps (${sequence.steps.length})`}>
        {sequence.steps.length === 0 ? (
          <EmptyRow>No steps yet — add the first one below.</EmptyRow>
        ) : (
          <ol className="space-y-2">
            {sequence.steps.map((step) => (
              <li key={step.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3.5 py-2.5">
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-11 shrink-0 items-center justify-center rounded-md bg-[var(--brand-soft)] text-[11px] font-bold text-[var(--brand)]">Day {step.dayOffset}</span>
                  <div>
                    <p className="text-[13px] font-medium text-[var(--text)]">{step.title}</p>
                    <p className="text-[11px] text-[var(--text-faint)]">{optionLabel(TASK_TYPES, step.type)}</p>
                  </div>
                </div>
                <RemoveStepButton stepId={step.id} sequenceId={sequence.id} />
              </li>
            ))}
          </ol>
        )}
        <div className="mt-4 border-t border-[var(--border)] pt-4">
          <AddStepForm sequenceId={sequence.id} />
        </div>
      </SectionCard>
    </div>
  );
}
