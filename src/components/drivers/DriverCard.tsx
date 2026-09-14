import Link from "next/link";
import { Star, Car } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { StatusBadge } from "@/components/ui/Badge";
import { DRIVER_STATUSES } from "@/lib/constants";

type DriverData = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  status: string;
  rating: number | null;
  completedTrips: number;
  assignedVehicles: { name: string }[];
};

export function DriverCard({ driver }: { driver: DriverData }) {
  return (
    <Link href={`/drivers/${driver.id}`} className="card card-hover flex items-center gap-3 p-4">
      <Avatar firstName={driver.firstName} lastName={driver.lastName} size="lg" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-[14px] font-semibold text-[var(--text)]">{driver.firstName} {driver.lastName}</p>
          <StatusBadge options={DRIVER_STATUSES} value={driver.status} />
        </div>
        <p className="mt-0.5 truncate text-[12px] text-[var(--text-muted)]">{driver.phone ?? "No phone on file"}</p>
        <div className="mt-1.5 flex items-center gap-3 text-[11px] text-[var(--text-faint)]">
          <span className="flex items-center gap-1"><Star size={11} className="text-[var(--brand-bright)]" fill="currentColor" /> {driver.rating?.toFixed(2) ?? "—"}</span>
          <span>{driver.completedTrips} trips</span>
          {driver.assignedVehicles[0] && <span className="flex items-center gap-1 truncate"><Car size={11} /> {driver.assignedVehicles[0].name}</span>}
        </div>
      </div>
    </Link>
  );
}
