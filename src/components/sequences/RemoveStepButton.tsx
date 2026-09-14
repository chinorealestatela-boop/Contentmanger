"use client";

import { useTransition } from "react";
import { X } from "lucide-react";
import { removeStep } from "@/lib/actions/sequences";

export function RemoveStepButton({ stepId }: { stepId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button disabled={pending} className="btn btn-ghost btn-sm !p-1.5 !text-[var(--danger)]" onClick={() => startTransition(() => removeStep(stepId))} aria-label="Remove step">
      <X size={14} />
    </button>
  );
}
