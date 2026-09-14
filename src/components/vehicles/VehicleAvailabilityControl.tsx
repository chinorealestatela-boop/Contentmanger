"use client";

import { useTransition } from "react";
import { updateVehicleAvailability } from "@/lib/actions/vehicles";
import { VEHICLE_AVAILABILITY } from "@/lib/constants";

export function VehicleAvailabilityControl({ vehicleId, availability }: { vehicleId: string; availability: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <select
      className="input !w-auto !py-1.5 text-[12.5px] font-semibold"
      value={availability}
      disabled={pending}
      onChange={(e) => startTransition(() => updateVehicleAvailability(vehicleId, e.target.value))}
    >
      {VEHICLE_AVAILABILITY.map((s) => (
        <option key={s.value} value={s.value}>{s.label}</option>
      ))}
    </select>
  );
}
