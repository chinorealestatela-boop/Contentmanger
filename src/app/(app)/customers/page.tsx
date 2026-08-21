import Link from "next/link";
import { Plus } from "lucide-react";
import { requireScope } from "@/lib/queries/scope";
import { listCustomers } from "@/lib/queries/customers";
import { CustomerRow } from "@/components/customers/CustomerRow";
import { SearchInput } from "@/components/ui/SearchInput";
import { Pagination } from "@/components/ui/Pagination";
import { TEMPERATURES } from "@/lib/constants";
import { cn } from "@/lib/utils";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; temperature?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const scope = await requireScope();
  const { customers, page, pageCount, total } = await listCustomers(scope, {
    q: sp.q,
    temperature: sp.temperature,
    page: sp.page ? Number(sp.page) : 1,
  });

  const buildHref = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { q: sp.q, temperature: sp.temperature, ...overrides };
    Object.entries(merged).forEach(([k, v]) => v && params.set(k, v));
    const qs = params.toString();
    return `/customers${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text)]">Customers</h1>
          <p className="text-[13px] text-[var(--text-muted)]">{total} customer{total === 1 ? "" : "s"} in your book</p>
        </div>
        <Link href="/leads/new" className="btn btn-primary">
          <Plus size={15} /> Add Customer / Lead
        </Link>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <form className="flex-1">
          <SearchInput defaultValue={sp.q} placeholder="Search name, phone, email…" />
        </form>
        <div className="flex flex-wrap items-center gap-1.5">
          <Link href={buildHref({ temperature: undefined, page: undefined })} className={cn("badge", !sp.temperature ? "bg-[var(--brand)] text-white" : "badge-neutral")}>
            All
          </Link>
          {TEMPERATURES.map((t) => (
            <Link key={t.value} href={buildHref({ temperature: t.value, page: undefined })} className={cn("badge", sp.temperature === t.value ? `badge-${t.value.toLowerCase()}` : "badge-neutral")}>
              {t.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="space-y-2.5">
        {customers.length === 0 && (
          <div className="card p-10 text-center text-sm text-[var(--text-muted)]">No customers match your filters yet.</div>
        )}
        {customers.map((c) => (
          <CustomerRow key={c.id} customer={c} />
        ))}
      </div>

      <Pagination page={page} pageCount={pageCount} buildHref={(p) => buildHref({ page: String(p) })} />
    </div>
  );
}
