"use client";

import { useState, useTransition } from "react";
import { PlayCircle } from "lucide-react";
import { runAutomationChecksNow } from "@/lib/actions/automations";

export function RunChecksButton() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<number | null>(null);

  return (
    <button
      disabled={pending}
      className="btn btn-secondary btn-sm"
      onClick={() =>
        startTransition(async () => {
          const created = await runAutomationChecksNow();
          setResult(created);
        })
      }
    >
      <PlayCircle size={13} /> {pending ? "Checking…" : result !== null ? `Ran — ${result} triggered` : "Run Checks Now"}
    </button>
  );
}
