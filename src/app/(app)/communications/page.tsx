import Link from "next/link";
import { Phone, MessageSquare, Mail, Voicemail, Users, MoreHorizontal, type LucideIcon } from "lucide-react";
import { requireScope } from "@/lib/queries/scope";
import { customerScopeWhere } from "@/lib/queries/scope";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/Badge";
import { formatTimeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = { CALL: Phone, TEXT: MessageSquare, EMAIL: Mail, VOICEMAIL: Voicemail, IN_PERSON: Users, OTHER: MoreHorizontal };

export default async function CommunicationsPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const sp = await searchParams;
  const scope = await requireScope();

  const communications = await prisma.communication.findMany({
    where: { customer: customerScopeWhere(scope), ...(sp.type ? { type: sp.type } : {}) },
    include: { customer: true, actor: true },
    orderBy: { occurredAt: "desc" },
    take: 100,
  });

  const types = ["CALL", "TEXT", "EMAIL", "VOICEMAIL", "IN_PERSON", "OTHER"];

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text)]">Communications</h1>
        <p className="text-[13px] text-[var(--text-muted)]">Every call, text, email, and in-person touch logged across your book.</p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Link href="/communications" className={cn("badge", !sp.type ? "bg-[var(--brand)] text-white" : "badge-neutral")}>All</Link>
        {types.map((t) => (
          <Link key={t} href={`/communications?type=${t}`} className={cn("badge", sp.type === t ? "bg-[var(--brand)] text-white" : "badge-neutral")}>{t.replace("_", " ")}</Link>
        ))}
      </div>

      <div className="space-y-2.5">
        {communications.length === 0 && (
          <div className="card p-10 text-center text-sm text-[var(--text-muted)]">
            No communications logged yet. Log calls, texts, and emails from any customer profile.
          </div>
        )}
        {communications.map((c) => {
          const Icon = ICONS[c.type] ?? MoreHorizontal;
          return (
            <Link key={c.id} href={`/customers/${c.customerId}`} className="card flex items-start gap-3 p-4 hover:shadow-md">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--bg-subtle)] text-[var(--text-muted)]"><Icon size={15} /></span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="text-[13.5px] font-semibold text-[var(--text)]">{c.customer.firstName} {c.customer.lastName}</p>
                  <Badge variant="neutral">{c.direction === "INBOUND" ? "Inbound" : "Outbound"}</Badge>
                </div>
                <p className="mt-0.5 text-[12.5px] text-[var(--text-muted)]">{c.summary}</p>
                <p className="mt-1 text-[11px] text-[var(--text-faint)]">{c.actor.firstName} {c.actor.lastName} · {formatTimeAgo(c.occurredAt)}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
