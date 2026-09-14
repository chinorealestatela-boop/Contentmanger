import Link from "next/link";
import { Plus, IdCard } from "lucide-react";
import { listDrivers, getDriverStats } from "@/lib/queries/drivers";
import { DriverCard } from "@/components/drivers/DriverCard";
import { SearchInput } from "@/components/ui/SearchInput";
import { DRIVER_STATUSES } from "@/lib/constants";
import { cn } from "@/lib/utils";

export default async function DriversPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const sp = await searchParams;
  const [drivers, stats] = await Promise.all([listDrivers({ q: sp.q, status: sp.status }), getDriverStats()]);

  const buildHref = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { q: sp.q, status: sp.status, ...overrides };
    Object.entries(merged).forEach(([k, v]) => v && params.set(k, v));
    const qs = params.toString();
    return `/drivers${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium text-[var(--text)]">Chauffeurs</h1>
          <p className="text-[13px] text-[var(--text-muted)]">{stats.total} on staff · {stats.available} available now</p>
        </div>
        <Link href="/drivers/new" className="btn btn-primary"><Plus size={15} /> Add Chauffeur</Link>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <form className="flex-1"><SearchInput defaultValue={sp.q} placeholder="Search name or phone…" /></form>
        <div className="flex flex-wrap items-center gap-1.5">
          <Link href={buildHref({ status: undefined })} className={cn("badge", !sp.status ? "badge-gold" : "badge-neutral")}>All</Link>
          {DRIVER_STATUSES.map((s) => (
            <Link key={s.value} href={buildHref({ status: s.value })} className={cn("badge", sp.status === s.value ? "badge-gold" : "badge-neutral")}>{s.label}</Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {drivers.length === 0 && <div className="card col-span-full p-10 text-center text-sm text-[var(--text-muted)]"><IdCard className="mx-auto mb-2" size={20} /> No chauffeurs match your filters.</div>}
        {drivers.map((d) => <DriverCard key={d.id} driver={d} />)}
      </div>
    </div>
  );
}
