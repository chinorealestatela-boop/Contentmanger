import Link from "next/link";
import { Plus } from "lucide-react";
import { requireScope } from "@/lib/queries/scope";
import { listCustomers } from "@/lib/queries/customers";
import { CustomerRow } from "@/components/customers/CustomerRow";
import { SearchInput } from "@/components/ui/SearchInput";
import { Pagination } from "@/components/ui/Pagination";
import { CUSTOMER_TIERS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tier?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const scope = await requireScope();
  const { customers, page, pageCount, total } = await listCustomers(scope, {
    q: sp.q,
    tier: sp.tier,
    page: sp.page ? Number(sp.page) : 1,
  });

  const buildHref = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { q: sp.q, tier: sp.tier, ...overrides };
    Object.entries(merged).forEach(([k, v]) => v && params.set(k, v));
    const qs = params.toString();
    return `/customers${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium text-[var(--text)]">Clients</h1>
          <p className="text-[13px] text-[var(--text-muted)]">{total} client{total === 1 ? "" : "s"} in your book</p>
        </div>
        <Link href="/leads/new" className="btn btn-primary">
          <Plus size={15} /> Add Client / Lead
        </Link>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <form className="flex-1">
          <SearchInput defaultValue={sp.q} placeholder="Search name, phone, email, company…" />
        </form>
        <div className="flex flex-wrap items-center gap-1.5">
          <Link href={buildHref({ tier: undefined, page: undefined })} className={cn("badge", !sp.tier ? "badge-gold" : "badge-neutral")}>All</Link>
          {CUSTOMER_TIERS.map((t) => (
            <Link key={t.value} href={buildHref({ tier: t.value, page: undefined })} className={cn("badge", sp.tier === t.value ? "badge-gold" : "badge-neutral")}>
              {t.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="space-y-2.5">
        {customers.length === 0 && (
          <div className="card p-10 text-center text-sm text-[var(--text-muted)]">No clients match your filters yet.</div>
        )}
        {customers.map((c) => (
          <CustomerRow key={c.id} customer={c} />
        ))}
      </div>

      <Pagination page={page} pageCount={pageCount} buildHref={(p) => buildHref({ page: String(p) })} />
    </div>
  );
}
