import Link from "next/link";
import { Car, Users } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency } from "@/lib/format";
import { optionLabel, VEHICLE_STATUSES } from "@/lib/constants";

type VehicleData = {
  id: string;
  stockNumber: string;
  vin: string;
  year: number;
  make: string;
  model: string;
  trim: string | null;
  condition: string;
  bodyStyle: string | null;
  mileage: number;
  exteriorColor: string | null;
  sellingPrice: number | null;
  internetPrice: number | null;
  status: string;
  source: string;
  syncStatus: string;
  _count: { customerInterests: number };
};

export function VehicleCard({ vehicle }: { vehicle: VehicleData }) {
  return (
    <Link href={`/vehicles/${vehicle.id}`} className="card flex flex-col overflow-hidden hover:shadow-md">
      <div className="flex h-32 items-center justify-center bg-[var(--bg-subtle)] text-[var(--text-faint)]">
        <Car size={32} strokeWidth={1.5} />
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[13.5px] font-semibold leading-snug text-[var(--text)]">{vehicle.year} {vehicle.make} {vehicle.model}</p>
          <Badge variant={vehicle.status === "AVAILABLE" ? "sold" : vehicle.status === "SOLD" ? "lost" : "neutral"}>{optionLabel(VEHICLE_STATUSES, vehicle.status)}</Badge>
        </div>
        <p className="text-[12px] text-[var(--text-muted)]">{vehicle.trim} · {vehicle.condition === "NEW" ? "New" : `${vehicle.mileage.toLocaleString()} mi`} · {vehicle.exteriorColor}</p>
        <div className="flex items-center gap-1.5">
          <p className="text-[11px] text-[var(--text-faint)]">#{vehicle.stockNumber}</p>
          {vehicle.source === "AUTOMAXLV" && <Badge variant="neutral">automaxlv.com</Badge>}
          {vehicle.syncStatus === "NEEDS_REVIEW" && <Badge variant="warm">Needs Review</Badge>}
        </div>
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="text-[15px] font-bold text-[var(--text)]">{formatCurrency(vehicle.internetPrice ?? vehicle.sellingPrice)}</span>
          {vehicle._count.customerInterests > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-[var(--text-muted)]"><Users size={12} /> {vehicle._count.customerInterests}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
