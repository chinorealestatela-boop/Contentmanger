"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Gift, CheckCircle2 } from "lucide-react";
import { completeTask } from "@/lib/actions/tasks";
import type { PaymentFollowUpItem } from "@/lib/queries/payments";

/** Dashboard section for the deferred-payment-completion follow-up
 * feature (Feature 10) — a dedicated Due Today / Overdue / Completed
 * count, on top of (not instead of) these same tasks already showing in
 * the generic Today's Actions list above. Clicking a customer opens their
 * existing profile; "Mark Complete" reuses the same completeTask() action
 * every other task in the CRM uses, so it disappears from here the moment
 * it's done — no separate completion state to keep in sync. */
export function PaymentFollowUpCard({
  dueToday,
  overdue,
  completedTodayCount,
}: {
  dueToday: PaymentFollowUpItem[];
  overdue: PaymentFollowUpItem[];
  completedTodayCount: number;
}) {
  const items = [...overdue, ...dueToday];
  if (items.length === 0 && completedTodayCount === 0) return null;

  return (
    <section className="card">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
        <div className="flex items-center gap-1.5">
          <Gift size={16} className="text-[var(--brand)]" />
          <h2 className="text-[15px] font-semibold text-[var(--text)]">Customer Follow-Ups</h2>
        </div>
        <Link href="/payments" className="text-xs font-semibold text-[var(--brand)] hover:underline">Payments</Link>
      </div>

      <div className="grid grid-cols-3 divide-x divide-[var(--border)] border-b border-[var(--border)] text-center">
        <Stat label="Due Today" value={dueToday.length} tone="default" />
        <Stat label="Overdue" value={overdue.length} tone="overdue" />
        <Stat label="Completed Today" value={completedTodayCount} tone="sold" />
      </div>

      {items.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-[var(--text-muted)]">No deferred-payment follow-ups outstanding.</p>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {items.map((item) => (
            <FollowUpRow key={item.taskId} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "default" | "overdue" | "sold" }) {
  const color = tone === "overdue" ? "text-[var(--overdue)]" : tone === "sold" ? "text-[var(--sold)]" : "text-[var(--text)]";
  return (
    <div className="px-2 py-3">
      <p className={`text-xl font-bold tabular-nums ${color}`}>{value}</p>
      <p className="mt-0.5 text-[11px] font-medium text-[var(--text-faint)]">{label}</p>
    </div>
  );
}

function FollowUpRow({ item }: { item: PaymentFollowUpItem }) {
  const [pending, startTransition] = useTransition();
  return (
    <li className="flex items-center justify-between gap-3 px-5 py-3">
      <Link href={`/customers/${item.customerId}`} className="min-w-0 flex-1 hover:opacity-80">
        <p className="truncate text-[13px] font-semibold text-[var(--text)]">
          {item.customerName} — {item.amountLabel} completed
        </p>
        <p className="truncate text-[11.5px] text-[var(--text-muted)]">
          Send thank-you/referral text{item.vehicleLabel ? ` · ${item.vehicleLabel}` : ""}
        </p>
      </Link>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => completeTask(item.taskId))}
        className="btn btn-secondary btn-sm shrink-0"
      >
        <CheckCircle2 size={13} /> Mark Complete
      </button>
    </li>
  );
}
