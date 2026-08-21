"use client";

import { useTransition } from "react";
import { X } from "lucide-react";
import { removeStep } from "@/lib/actions/sequences";

export function RemoveStepButton({ stepId, sequenceId }: { stepId: string; sequenceId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button disabled={pending} className="btn btn-ghost btn-sm !p-1.5 text-red-600" onClick={() => startTransition(() => removeStep(stepId, sequenceId))} aria-label="Remove step">
      <X size={14} />
    </button>
  );
}
