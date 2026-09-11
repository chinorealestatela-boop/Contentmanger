import Link from "next/link";
import { Palette } from "lucide-react";
import { VehicleThumb } from "@/components/vehicles/VehicleThumb";
import { formatCurrency } from "@/lib/format";
import { estimateMonthlyPayment } from "@/lib/utils";
import { optionLabel, BODY_STYLES } from "@/lib/constants";
import type { PublicVehicleListItem } from "@/lib/queries/publicInventory";

export function PublicVehicleCard({ vehicle }: { vehicle: PublicVehicleListItem }) {
  const title = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  const price = vehicle.internetPrice ?? vehicle.sellingPrice;
  const topFeatures = vehicle.features.slice(0, 3);

  return (
    <div className="card flex flex-col overflow-hidden">
      <Link href={`/inventory/${vehicle.id}`} className="block">
        <VehicleThumb src={vehicle.photos[0]} alt={title} className="h-44 w-full" iconSize={36} />
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div>
          <Link href={`/inventory/${vehicle.id}`} className="text-[15px] font-bold leading-snug text-[var(--text)] hover:text-[var(--brand)]">
            {title}
          </Link>
          {vehicle.trim && <p className="text-[12.5px] text-[var(--text-muted)]">{vehicle.trim}</p>}
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-[var(--text-muted)]">
          <span>{vehicle.condition === "NEW" ? "New" : `${vehicle.mileage.toLocaleString()} mi`}</span>
          {vehicle.bodyStyle && <span>{optionLabel(BODY_STYLES, vehicle.bodyStyle)}</span>}
          {vehicle.exteriorColor && (
            <span className="flex items-center gap-1"><Palette size={11} /> {vehicle.exteriorColor}</span>
          )}
        </div>

        {topFeatures.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {topFeatures.map((f) => (
              <span key={f} className="rounded-full bg-[var(--bg-subtle)] px-2 py-0.5 text-[10.5px] font-medium text-[var(--text-muted)]">
                {f}
              </span>
            ))}
          </div>
        )}

        <p className="text-[11px] text-[var(--text-faint)]">Stock #{vehicle.stockNumber}</p>

        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <span className="text-[17px] font-extrabold text-[var(--brand)]">{formatCurrency(price)}</span>
          {price != null && (
            <span className="text-[12px] font-semibold text-[var(--text-muted)]">
              Est. {formatCurrency(Math.round(estimateMonthlyPayment(price)))}/mo
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <Link href={`/inventory/${vehicle.id}`} className="btn btn-secondary btn-sm justify-center">
            View Details
          </Link>
          <Link href={`/inventory/${vehicle.id}#interested`} className="btn btn-primary btn-sm justify-center">
            Get Info
          </Link>
        </div>
      </div>
    </div>
  );
}
