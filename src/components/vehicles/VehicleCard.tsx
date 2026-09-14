import Link from "next/link";
import { Car, IdCard } from "lucide-react";
import { StatusBadge } from "@/components/ui/Badge";
import { formatCurrency } from "@/lib/format";
import { optionLabel, VEHICLE_TYPES, VEHICLE_AVAILABILITY } from "@/lib/constants";

type VehicleData = {
  id: string;
  fleetNumber: string;
  name: string;
  year: number;
  make: string;
  model: string;
  vehicleType: string;
  color: string | null;
  seatingCapacity: number | null;
  currentMileage: number;
  hourlyRate: number | null;
  dailyRate: number | null;
  availability: string;
  assignedDriver: { firstName: string; lastName: string } | null;
  _count: { bookings: number };
};

export function VehicleCard({ vehicle }: { vehicle: VehicleData }) {
  return (
    <Link href={`/fleet/${vehicle.id}`} className="card card-hover flex flex-col overflow-hidden">
      <div className="flex h-28 items-center justify-center bg-white/[0.02] text-[var(--text-faint)]">
        <Car size={30} strokeWidth={1.25} />
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[13.5px] font-semibold leading-snug text-[var(--text)]">{vehicle.name}</p>
          <StatusBadge options={VEHICLE_AVAILABILITY} value={vehicle.availability} />
        </div>
        <p className="text-[12px] text-[var(--text-muted)]">{optionLabel(VEHICLE_TYPES, vehicle.vehicleType)} · {vehicle.color ?? "—"} · {vehicle.seatingCapacity ?? "?"} seats</p>
        <p className="text-[11px] text-[var(--text-faint)]">#{vehicle.fleetNumber} · {vehicle.currentMileage.toLocaleString()} mi</p>
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="text-[14px] font-semibold text-[var(--brand-bright)]">{vehicle.hourlyRate ? `${formatCurrency(vehicle.hourlyRate)}/hr` : "—"}</span>
          {vehicle.assignedDriver && (
            <span className="flex items-center gap-1 text-[11px] text-[var(--text-muted)]"><IdCard size={12} /> {vehicle.assignedDriver.firstName}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
