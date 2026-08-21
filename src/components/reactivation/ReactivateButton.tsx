"use client";

import { useState, useTransition } from "react";
import { RefreshCcw, Check } from "lucide-react";
import { reactivateLead } from "@/lib/actions/leads";

export function ReactivateButton({ leadId }: { leadId: string }) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <span className="btn btn-sm bg-emerald-100 text-emerald-700"><Check size={13} /> Reactivated</span>
    );
  }

  return (
    <button
      disabled={pending}
      className="btn btn-primary btn-sm"
      onClick={() => startTransition(async () => { await reactivateLead(leadId); setDone(true); })}
    >
      <RefreshCcw size={13} /> {pending ? "Reactivating…" : "Reactivate"}
    </button>
  );
}
