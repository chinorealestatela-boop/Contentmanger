import Link from "next/link";
import { Plus } from "lucide-react";
import { listQuotes } from "@/lib/queries/quotes";
import { SearchInput } from "@/components/ui/SearchInput";
import { Pagination } from "@/components/ui/Pagination";
import { StatusBadge } from "@/components/ui/Badge";
import { QUOTE_STATUSES } from "@/lib/constants";
import { formatCurrency, formatDate, fullName } from "@/lib/format";
import { cn } from "@/lib/utils";

export default async function QuotesPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  const sp = await searchParams;
  const { quotes, page, pageCount, total } = await listQuotes({ q: sp.q, status: sp.status, page: sp.page ? Number(sp.page) : 1 });

  const buildHref = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { q: sp.q, status: sp.status, ...overrides };
    Object.entries(merged).forEach(([k, v]) => v && params.set(k, v));
    const qs = params.toString();
    return `/quotes${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium text-[var(--text)]">Quotes</h1>
          <p className="text-[13px] text-[var(--text-muted)]">{total} quote{total === 1 ? "" : "s"}</p>
        </div>
        <Link href="/quotes/new" className="btn btn-primary"><Plus size={15} /> New Quote</Link>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <form className="flex-1"><SearchInput defaultValue={sp.q} placeholder="Search quote #, client…" /></form>
        <div className="flex flex-wrap items-center gap-1.5">
          <Link href={buildHref({ status: undefined, page: undefined })} className={cn("badge", !sp.status ? "badge-gold" : "badge-neutral")}>All</Link>
          {QUOTE_STATUSES.map((s) => (
            <Link key={s.value} href={buildHref({ status: s.value, page: undefined })} className={cn("badge", sp.status === s.value ? "badge-gold" : "badge-neutral")}>{s.label}</Link>
          ))}
        </div>
      </div>

      <div className="space-y-2.5">
        {quotes.length === 0 && <div className="card p-10 text-center text-sm text-[var(--text-muted)]">No quotes match your filters yet.</div>}
        {quotes.map((q) => (
          <Link key={q.id} href={`/quotes/${q.id}`} className="card card-hover flex items-center justify-between p-4">
            <div>
              <p className="text-[14px] font-semibold text-[var(--text)]">{fullName(q.customer)} <span className="ml-1.5 text-[11px] font-normal text-[var(--text-faint)]">#{q.quoteNumber}</span></p>
              <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">{q.vehicle?.name ?? "Vehicle TBD"} · {q.serviceDate ? formatDate(q.serviceDate) : "Date TBD"}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[13px] font-semibold text-[var(--text)]">{formatCurrency(q.totalPrice)}</span>
              <StatusBadge options={QUOTE_STATUSES} value={q.status} />
            </div>
          </Link>
        ))}
      </div>

      <Pagination page={page} pageCount={pageCount} buildHref={(p) => buildHref({ page: String(p) })} />
    </div>
  );
}
