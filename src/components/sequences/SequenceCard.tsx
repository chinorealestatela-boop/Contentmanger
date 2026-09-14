import { AddStepForm } from "@/components/sequences/AddStepForm";
import { RemoveStepButton } from "@/components/sequences/RemoveStepButton";
import { SequenceToggle } from "@/components/sequences/SequenceToggle";

type Step = { id: string; offsetMinutes: number; channel: string; title: string; messageBody: string | null; order: number };
type Sequence = { id: string; name: string; description: string | null; trigger: string; active: boolean; steps: Step[] };

function formatOffset(minutes: number) {
  if (minutes === 0) return "Immediately";
  if (minutes < 60) return `${minutes}m after`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h after`;
  return `${Math.round(minutes / 1440)}d after`;
}

export function SequenceCard({ sequence }: { sequence: Sequence }) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[14px] font-semibold text-[var(--text)]">{sequence.name}</p>
          <p className="text-[12px] text-[var(--text-muted)]">{sequence.description}</p>
          <p className="mt-0.5 text-[11px] text-[var(--text-faint)]">Trigger: {sequence.trigger.replace(/_/g, " ")}</p>
        </div>
        <SequenceToggle id={sequence.id} active={sequence.active} />
      </div>

      <ol className="mt-4 space-y-2">
        {sequence.steps.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-3 py-2">
            <div className="min-w-0">
              <p className="text-[12.5px] font-medium text-[var(--text)]">{s.title}</p>
              <p className="text-[11px] text-[var(--text-faint)]">{formatOffset(s.offsetMinutes)} · {s.channel}</p>
            </div>
            <RemoveStepButton stepId={s.id} />
          </li>
        ))}
        {sequence.steps.length === 0 && <p className="py-3 text-center text-[12px] text-[var(--text-faint)]">No steps yet.</p>}
      </ol>

      <div className="mt-3">
        <AddStepForm sequenceId={sequence.id} />
      </div>
    </div>
  );
}
