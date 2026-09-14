import Link from "next/link";
import { Plus } from "lucide-react";
import { requireScope } from "@/lib/queries/scope";
import { listLeads } from "@/lib/queries/leads";
import { LeadRow } from "@/components/leads/LeadRow";
import { SearchInput } from "@/components/ui/SearchInput";
import { Pagination } from "@/components/ui/Pagination";
import { cn } from "@/lib/utils";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; vip?: string; page?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const scope = await requireScope();
  const { leads, page, pageCount, total } = await listLeads(scope, {
    q: sp.q,
    isVip: sp.vip === "1",
    status: sp.status,
    page: sp.page ? Number(sp.page) : 1,
  });

  const buildHref = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { q: sp.q, vip: sp.vip, status: sp.status, ...overrides };
    Object.entries(merged).forEach(([k, v]) => v && params.set(k, v));
    const qs = params.toString();
    return `/leads${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium text-[var(--text)]">Leads</h1>
          <p className="text-[13px] text-[var(--text-muted)]">{total} lead{total === 1 ? "" : "s"} · sorted by VIP status, then priority score</p>
        </div>
        <Link href="/leads/new" className="btn btn-primary">
          <Plus size={15} /> New Lead
        </Link>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <form className="flex-1">
          <SearchInput defaultValue={sp.q} placeholder="Search name, phone, email, company…" />
        </form>
        <div className="flex flex-wrap items-center gap-1.5">
          <Link href={buildHref({ status: undefined, page: undefined })} className={cn("badge", !sp.status || sp.status === "ACTIVE" ? "badge-gold" : "badge-neutral")}>Active</Link>
          <Link href={buildHref({ status: "BOOKED", page: undefined })} className={cn("badge", sp.status === "BOOKED" ? "badge-gold" : "badge-neutral")}>Booked</Link>
          <Link href={buildHref({ status: "LOST", page: undefined })} className={cn("badge", sp.status === "LOST" ? "badge-gold" : "badge-neutral")}>Lost</Link>
          <Link href={buildHref({ vip: sp.vip === "1" ? undefined : "1", page: undefined })} className={cn("badge", sp.vip === "1" ? "badge-gold" : "badge-neutral")}>★ VIP only</Link>
        </div>
      </div>

      <div className="space-y-2.5">
        {leads.length === 0 && <div className="card p-10 text-center text-sm text-[var(--text-muted)]">No leads match your filters yet.</div>}
        {leads.map((lead) => <LeadRow key={lead.id} lead={lead} />)}
      </div>

      <Pagination page={page} pageCount={pageCount} buildHref={(p) => buildHref({ page: String(p) })} />
    </div>
  );
}
