import { Suspense } from "react";
import { searchPublicInventory, getInventoryFilterOptions, type InventorySort } from "@/lib/queries/publicInventory";
import { PublicVehicleCard } from "@/components/inventory/PublicVehicleCard";
import { InventoryControls } from "@/components/inventory/InventoryControls";
import { Pagination } from "@/components/ui/Pagination";

export const metadata = { title: "Available Vehicles | AutoMax LV" };
// Inventory changes as vehicles are added/sold/marked unavailable from the
// admin dashboard — revalidate periodically instead of only at build time.
export const revalidate = 60;

const SORT_VALUES = new Set(["priceAsc", "priceDesc", "yearDesc", "yearAsc", "mileageAsc", "mileageDesc", "newest"]);

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const sort: InventorySort = sp.sort && SORT_VALUES.has(sp.sort) ? (sp.sort as InventorySort) : "newest";

  const [{ vehicles, total, page, pageCount }, options] = await Promise.all([
    searchPublicInventory({ ...sp, sort, page: sp.page ? Number(sp.page) : 1 }),
    getInventoryFilterOptions(),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)] sm:text-3xl">Available Vehicles</h1>
        <p className="mt-1 text-[13.5px] text-[var(--text-muted)]">
          {options.count} vehicle{options.count === 1 ? "" : "s"} currently on the lot — search or filter to find yours.
        </p>
      </div>

      <Suspense fallback={<div className="mt-5 h-96 animate-pulse rounded-xl bg-[var(--bg-subtle)]" />}>
        <InventoryControls options={options} resultCount={total}>
          {vehicles.length === 0 ? (
            <div className="card p-10 text-center text-[13.5px] text-[var(--text-muted)]">
              No vehicles match those filters. Try widening your search, or{" "}
              <a href="/book" className="font-semibold text-[var(--brand)] hover:underline">tell us what you&rsquo;re looking for</a>.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {vehicles.map((v) => (
                <PublicVehicleCard key={v.id} vehicle={v} />
              ))}
            </div>
          )}

          <Pagination
            page={page}
            pageCount={pageCount}
            buildHref={(p) => {
              const params = new URLSearchParams(sp as Record<string, string>);
              params.set("page", String(p));
              return `/inventory?${params.toString()}`;
            }}
          />
        </InventoryControls>
      </Suspense>
    </div>
  );
}
