import Link from "next/link";
import { MessageSquare, Mail } from "lucide-react";
import { requireScope, customerScopeWhere } from "@/lib/queries/scope";
import { prisma } from "@/lib/prisma";
import { ColorPill } from "@/components/ui/Badge";
import { formatTimeAgo } from "@/lib/format";
import { optionColor, optionLabel, MESSAGE_STATUSES, SMS_MESSAGE_TYPES, EMAIL_MESSAGE_TYPES } from "@/lib/constants";
import { cn } from "@/lib/utils";

export default async function MessageLogPage({ searchParams }: { searchParams: Promise<{ channel?: string }> }) {
  const sp = await searchParams;
  const scope = await requireScope();
  const channel = sp.channel === "email" ? "email" : sp.channel === "sms" ? "sms" : "all";

  const [sms, email] = await Promise.all([
    channel === "email" ? [] : prisma.smsMessage.findMany({ where: { customer: customerScopeWhere(scope) }, include: { customer: true }, orderBy: { createdAt: "desc" }, take: 100 }),
    channel === "sms" ? [] : prisma.emailMessage.findMany({ where: { customer: customerScopeWhere(scope) }, include: { customer: true }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);

  const combined = [
    ...sms.map((m) => ({ ...m, channel: "sms" as const, label: optionLabel(SMS_MESSAGE_TYPES, m.type), preview: m.body, to: m.toPhone })),
    ...email.map((m) => ({ ...m, channel: "email" as const, label: optionLabel(EMAIL_MESSAGE_TYPES, m.type), preview: m.subject, to: m.toEmail })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text)]">Message Log</h1>
        <p className="text-[13px] text-[var(--text-muted)]">Every booking confirmation, reminder, and reschedule/cancellation notice sent by the booking site — and whether it actually went out.</p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Link href="/messages" className={cn("badge", channel === "all" ? "bg-[var(--brand)] text-white" : "badge-neutral")}>All</Link>
        <Link href="/messages?channel=sms" className={cn("badge", channel === "sms" ? "bg-[var(--brand)] text-white" : "badge-neutral")}>SMS</Link>
        <Link href="/messages?channel=email" className={cn("badge", channel === "email" ? "bg-[var(--brand)] text-white" : "badge-neutral")}>Email</Link>
      </div>

      <div className="space-y-2.5">
        {combined.length === 0 && (
          <div className="card p-10 text-center text-sm text-[var(--text-muted)]">
            No messages sent yet. They&rsquo;ll show up here as soon as a customer books a test drive.
          </div>
        )}
        {combined.map((m) => (
          <Link key={`${m.channel}-${m.id}`} href={`/customers/${m.customerId}`} className="card flex items-start gap-3 p-4 hover:shadow-md">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--bg-subtle)] text-[var(--text-muted)]">
              {m.channel === "sms" ? <MessageSquare size={15} /> : <Mail size={15} />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="text-[13.5px] font-semibold text-[var(--text)]">{m.customer.firstName} {m.customer.lastName}</p>
                <ColorPill color={optionColor(MESSAGE_STATUSES, m.status)}>{optionLabel(MESSAGE_STATUSES, m.status)}</ColorPill>
                <span className="text-[11px] text-[var(--text-faint)]">{m.label}</span>
              </div>
              <p className="mt-0.5 truncate text-[12.5px] text-[var(--text-muted)]">{m.preview}</p>
              {m.errorMessage && <p className="mt-0.5 text-[11px] text-red-600">{m.errorMessage}</p>}
              <p className="mt-1 text-[11px] text-[var(--text-faint)]">To {m.to} · {formatTimeAgo(m.createdAt)}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
