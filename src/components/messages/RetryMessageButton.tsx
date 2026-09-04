"use client";

import { useState, useTransition } from "react";
import { RotateCcw, Loader2 } from "lucide-react";
import { retrySmsMessage, retryEmailMessage } from "@/lib/actions/messages";

// One-click resend for a failed confirmation/reminder — used on both the
// global Message Log and a customer's own profile. Re-sends the exact
// stored body/subject through the same provider path, so a bad-signal
// moment (Twilio hiccup, transient Resend error) doesn't require the
// customer to be re-booked or re-texted by hand.
export function RetryMessageButton({ kind, id }: { kind: "sms" | "email"; id: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  if (result) return <span className="text-[11.5px] text-[var(--text-muted)]">{result}</span>;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        startTransition(async () => {
          const res = kind === "sms" ? await retrySmsMessage(id) : await retryEmailMessage(id);
          if ("error" in res && res.error) setResult(res.error);
          else setResult(res.simulated ? "Retried (simulated)." : res.sent ? "Sent." : "Retry failed again.");
        });
      }}
      disabled={pending}
      className="flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-[11px] font-semibold text-[var(--text)] hover:border-[var(--brand)] hover:text-[var(--brand)] disabled:opacity-60"
    >
      {pending ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
      Retry
    </button>
  );
}
