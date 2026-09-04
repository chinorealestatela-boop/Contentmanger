"use client";

import { useState, useTransition } from "react";
import { RotateCcw, Loader2, MessageSquare, Mail } from "lucide-react";
import { retrySmsMessage, retryEmailMessage } from "@/lib/actions/messages";
import { formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { EmptyRow } from "@/components/ui/SectionCard";
import { cn } from "@/lib/utils";

type SmsRow = { id: string; toPhone: string; type: string; status: string; errorMessage: string | null; createdAt: Date };
type EmailRow = { id: string; toEmail: string; subject: string; type: string; status: string; errorMessage: string | null; createdAt: Date };
type Row = { id: string; kind: "sms" | "email"; label: string; type: string; status: string; errorMessage: string | null; createdAt: Date };

function statusBadge(status: string) {
  if (status === "DELIVERED") return <Badge variant="sold">Delivered</Badge>;
  if (status === "SENT") return <Badge variant="sold">Sent</Badge>;
  if (status === "FAILED") return <Badge variant="overdue">Failed</Badge>;
  if (status === "SIMULATED") return <Badge variant="cold">Simulated</Badge>;
  return <Badge variant="neutral">{status}</Badge>;
}

// Delivery-status visibility + one-click retry for the failed case, per the
// booking flow's requirement that a send failure never gets silently lost —
// it stays visible here and can be re-sent without re-typing anything.
export function MessageLogSection({ sms, email }: { sms: SmsRow[]; email: EmailRow[] }) {
  const combined: Row[] = [
    ...sms.map((m): Row => ({ id: m.id, kind: "sms", label: m.toPhone, type: m.type, status: m.status, errorMessage: m.errorMessage, createdAt: m.createdAt })),
    ...email.map((m): Row => ({ id: m.id, kind: "email", label: `${m.subject} → ${m.toEmail}`, type: m.type, status: m.status, errorMessage: m.errorMessage, createdAt: m.createdAt })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (combined.length === 0) return <EmptyRow>No SMS or email sent yet.</EmptyRow>;

  return (
    <ul className="space-y-2">
      {combined.map((m) => (
        <MessageRow key={`${m.kind}-${m.id}`} row={m} />
      ))}
    </ul>
  );
}

function MessageRow({ row }: { row: Row }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  function retry() {
    startTransition(async () => {
      const res = row.kind === "sms" ? await retrySmsMessage(row.id) : await retryEmailMessage(row.id);
      if ("error" in res && res.error) setResult(res.error);
      else setResult(res.simulated ? "Retried (simulated — no provider configured)." : res.sent ? "Sent." : "Retry failed again.");
    });
  }

  return (
    <li className={cn("rounded-lg border border-[var(--border)] px-3 py-2.5 text-[13px]", row.status === "FAILED" && "border-[var(--overdue)]/30 bg-[var(--overdue-soft)]")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          {row.kind === "sms" ? <MessageSquare size={14} className="mt-0.5 shrink-0 text-[var(--text-faint)]" /> : <Mail size={14} className="mt-0.5 shrink-0 text-[var(--text-faint)]" />}
          <div className="min-w-0">
            <p className="truncate font-medium text-[var(--text)]">{row.label}</p>
            <p className="mt-0.5 text-[11.5px] text-[var(--text-faint)]">
              {row.type} · {formatDateTime(row.createdAt)}
            </p>
            {row.status === "FAILED" && row.errorMessage && <p className="mt-1 text-[11.5px] text-[var(--overdue)]">{row.errorMessage}</p>}
            {result && <p className="mt-1 text-[11.5px] text-[var(--text-muted)]">{result}</p>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {statusBadge(row.status)}
          {row.status === "FAILED" && !result && (
            <button
              type="button"
              onClick={retry}
              disabled={pending}
              className="flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-[11.5px] font-semibold text-[var(--text)] hover:border-[var(--brand)] hover:text-[var(--brand)] disabled:opacity-60"
            >
              {pending ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
              Retry
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
