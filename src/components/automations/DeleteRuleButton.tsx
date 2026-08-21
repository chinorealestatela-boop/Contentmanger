"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteAutomationRule } from "@/lib/actions/automations";

export function DeleteRuleButton({ ruleId }: { ruleId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      disabled={pending}
      className="btn btn-ghost btn-sm text-red-600"
      onClick={() => {
        if (confirm("Delete this automation rule?")) startTransition(() => deleteAutomationRule(ruleId));
      }}
      aria-label="Delete rule"
    >
      <Trash2 size={14} />
    </button>
  );
}
