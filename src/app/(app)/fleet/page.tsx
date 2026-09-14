import Link from "next/link";
import { Plus, Car, CarFront, Wrench, CircleOff } from "lucide-react";
import { listVehicles, getFleetStats } from "@/lib/queries/vehicles";
import { VehicleCard } from "@/components/vehicles/VehicleCard";
import { SearchInput } from "@/components/ui/SearchInput";
import { Pagination } from "@/components/ui/Pagination";
import { VEHICLE_AVAILABILITY } from "@/lib/constants";
import { cn } from "@/lib/utils";

export default async function FleetPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; availability?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const [{ vehicles, page, pageCount, total }, stats] = await Promise.all([
    listVehicles({ q: sp.q, availability: sp.availability, page: sp.page ? Number(sp.page) : 1 }),
    getFleetStats(),
  ]);

  const buildHref = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { q: sp.q, availability: sp.availability, ...overrides };
    Object.entries(merged).forEach(([k, v]) => v && params.set(k, v));
    const qs = params.toString();
    return `/fleet${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium text-[var(--text)]">Fleet</h1>
          <p className="text-[13px] text-[var(--text-muted)]">{total} vehicle{total === 1 ? "" : "s"} in the collection</p>
        </div>
        <Link href="/fleet/new" className="btn btn-primary"><Plus size={15} /> Add Vehicle</Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStat icon={Car} label="Total" value={stats.total} />
        <MiniStat icon={CarFront} label="Available" value={stats.available} tone="success" />
        <MiniStat icon={CarFront} label="On Trip" value={stats.onTrip} tone="warning" />
        <MiniStat icon={Wrench} label="Maintenance" value={stats.maintenance} tone="danger" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <form className="flex-1"><SearchInput defaultValue={sp.q} placeholder="Search name, make, model, fleet #, VIN…" /></form>
        <div className="flex flex-wrap items-center gap-1.5">
          <Link href={buildHref({ availability: undefined, page: undefined })} className={cn("badge", !sp.availability ? "badge-gold" : "badge-neutral")}>All</Link>
          {VEHICLE_AVAILABILITY.map((a) => (
            <Link key={a.value} href={buildHref({ availability: a.value, page: undefined })} className={cn("badge", sp.availability === a.value ? "badge-gold" : "badge-neutral")}>{a.label}</Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {vehicles.length === 0 && <div className="card col-span-full p-10 text-center text-sm text-[var(--text-muted)]"><CircleOff className="mx-auto mb-2" size={20} /> No vehicles match your filters.</div>}
        {vehicles.map((v) => <VehicleCard key={v.id} vehicle={v} />)}
      </div>

      <Pagination page={page} pageCount={pageCount} buildHref={(p) => buildHref({ page: String(p) })} />
    </div>
  );
}

function MiniStat({ icon: Icon, label, value, tone = "default" }: { icon: React.ComponentType<{ size?: number }>; label: string; value: number; tone?: "default" | "success" | "warning" | "danger" }) {
  const colors: Record<string, string> = { default: "text-[var(--brand-bright)]", success: "text-[var(--success)]", warning: "text-[var(--warning)]", danger: "text-[var(--danger)]" };
  return (
    <div className="card flex items-center gap-3 p-3.5">
      <Icon size={16} />
      <div>
        <p className={cn("font-display text-xl font-medium", colors[tone])}>{value}</p>
        <p className="text-[10.5px] font-medium text-[var(--text-muted)]">{label}</p>
      </div>
    </div>
  );
}
