import Link from "next/link";
import { Plus } from "lucide-react";
import { listVehicles, getInventoryStats } from "@/lib/queries/vehicles";
import { VehicleCard } from "@/components/vehicles/VehicleCard";
import { SearchInput } from "@/components/ui/SearchInput";
import { Pagination } from "@/components/ui/Pagination";
import { BODY_STYLES, DRIVETRAINS, VEHICLE_STATUSES } from "@/lib/constants";

export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const [{ vehicles, page, pageCount, total }, stats] = await Promise.all([
    listVehicles({ ...sp, page: sp.page ? Number(sp.page) : 1 }),
    getInventoryStats(),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text)]">Vehicle Inventory</h1>
          <p className="text-[13px] text-[var(--text-muted)]">
            {stats.total} vehicles · {stats.available} available · {stats.hold} on hold · {stats.inTransit} in transit · {stats.sold} sold
          </p>
        </div>
        <Link href="/vehicles/new" className="btn btn-primary"><Plus size={15} /> Add Vehicle</Link>
      </div>

      <form className="card space-y-3 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SearchInput defaultValue={sp.q} placeholder="Search make, model, VIN, stock #…" />
          <select name="status" defaultValue={sp.status ?? ""} className="input">
            <option value="">Any status</option>
            {VEHICLE_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select name="bodyStyle" defaultValue={sp.bodyStyle ?? ""} className="input">
            <option value="">Any body style</option>
            {BODY_STYLES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <select name="drivetrain" defaultValue={sp.drivetrain ?? ""} className="input">
            <option value="">Any drivetrain</option>
            {DRIVETRAINS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <input name="maxPrice" type="number" placeholder="Max price" defaultValue={sp.maxPrice ?? ""} className="input" />
          <input name="color" placeholder="Color" defaultValue={sp.color ?? ""} className="input" />
          <label className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-[13px]">
            <input type="checkbox" name="thirdRow" value="true" defaultChecked={sp.thirdRow === "true"} className="h-4 w-4" /> Third row
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <Link href="/vehicles" className="btn btn-ghost btn-sm">Clear</Link>
          <button type="submit" className="btn btn-primary btn-sm">Apply Filters</button>
        </div>
      </form>

      <p className="text-xs text-[var(--text-muted)]">{total} vehicle{total === 1 ? "" : "s"} matched</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {vehicles.map((v) => <VehicleCard key={v.id} vehicle={v} />)}
      </div>
      {vehicles.length === 0 && <div className="card p-10 text-center text-sm text-[var(--text-muted)]">No vehicles match those filters.</div>}

      <Pagination
        page={page}
        pageCount={pageCount}
        buildHref={(p) => {
          const params = new URLSearchParams(sp as Record<string, string>);
          params.set("page", String(p));
          return `/vehicles?${params.toString()}`;
        }}
      />
    </div>
  );
}
