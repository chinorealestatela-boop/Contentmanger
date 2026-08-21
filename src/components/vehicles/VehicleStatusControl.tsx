"use client";

import { useTransition } from "react";
import { updateVehicleStatus } from "@/lib/actions/vehicles";
import { VEHICLE_STATUSES } from "@/lib/constants";
import { optionColor } from "@/lib/constants";

export function VehicleStatusControl({ vehicleId, status }: { vehicleId: string; status: string }) {
  const [pending, startTransition] = useTransition();
  const color = optionColor(VEHICLE_STATUSES, status);

  return (
    <select
      defaultValue={status}
      disabled={pending}
      onChange={(e) => startTransition(() => updateVehicleStatus(vehicleId, e.target.value))}
      className="badge cursor-pointer border-0"
      style={{ background: `${color}1a`, color }}
    >
      {VEHICLE_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
    </select>
  );
}
