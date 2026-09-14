import Link from "next/link";
import { requireScope } from "@/lib/queries/scope";
import { ensureFollowUpsFresh, listFollowUps } from "@/lib/queries/followups";
import { prisma } from "@/lib/prisma";
import { SequenceCard } from "@/components/sequences/SequenceCard";
import { NewSequenceForm } from "@/components/sequences/NewSequenceForm";
import { TemplateEditor } from "@/components/templates/TemplateEditor";
import { StatusBadge } from "@/components/ui/Badge";
import { FOLLOWUP_STATUSES } from "@/lib/constants";
import { formatDate, formatTime12h, fullName } from "@/lib/format";

export default async function FollowUpsPage() {
  const scope = await requireScope();
  await ensureFollowUpsFresh();

  const [followUps, sequences, templates] = await Promise.all([
    listFollowUps(scope, { status: "SCHEDULED" }),
    prisma.followUpSequence.findMany({ orderBy: { createdAt: "asc" }, include: { steps: { orderBy: { order: "asc" } } } }),
    prisma.messageTemplate.findMany({ orderBy: { key: "asc" } }),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="font-display text-3xl font-medium text-[var(--text)]">Follow-Ups</h1>
        <p className="text-[13px] text-[var(--text-muted)]">Scheduled follow-ups, automated cadences, and the messages they send.</p>
      </div>

      <section>
        <h2 className="mb-2.5 text-[12px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Scheduled Follow-Ups ({followUps.length})</h2>
        <div className="card divide-y divide-[var(--border)]">
          {followUps.length === 0 && <p className="px-4 py-8 text-center text-[13px] text-[var(--text-muted)]">Nothing scheduled — you&rsquo;re all caught up.</p>}
          {followUps.map((f) => (
            <Link key={f.id} href={`/customers/${f.customerId}`} className="flex items-center justify-between px-4 py-3 hover:bg-white/[0.03]">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-[var(--text)]">{fullName(f.customer)} — {f.topic}</p>
                <p className="text-[11px] text-[var(--text-faint)]">{formatDate(f.followUpDate)} at {formatTime12h(f.followUpTime)} · {f.assignee ? fullName(f.assignee) : "Unassigned"}</p>
              </div>
              <StatusBadge options={FOLLOWUP_STATUSES} value={f.status} />
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2.5 text-[12px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Follow-Up Sequences</h2>
        <p className="mb-3 text-[12.5px] text-[var(--text-muted)]">Automatic cadences a lead is enrolled in the moment they come in — stopped automatically once they respond or book (spec: no manual babysitting required).</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {sequences.map((s) => (
            <SequenceCard key={s.id} sequence={s} />
          ))}
        </div>
        <div className="card mt-4 p-5">
          <h3 className="mb-3 text-[12.5px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">New Sequence</h3>
          <NewSequenceForm />
        </div>
      </section>

      <section>
        <h2 className="mb-2.5 text-[12px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Message Templates</h2>
        <p className="mb-3 text-[12.5px] text-[var(--text-muted)]">Every automated SMS and email the CRM sends — fully editable. Connect Twilio/SendGrid/Resend in Settings → Integrations to send these for real.</p>
        <div className="space-y-2">
          {templates.map((t) => (
            <TemplateEditor key={t.key} template={t} />
          ))}
        </div>
      </section>
    </div>
  );
}
