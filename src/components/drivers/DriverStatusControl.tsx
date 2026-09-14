"use client";

import { useTransition } from "react";
import { setDriverStatus } from "@/lib/actions/drivers";
import { DRIVER_STATUSES } from "@/lib/constants";

export function DriverStatusControl({ driverId, status }: { driverId: string; status: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <select
      className="input !w-auto !py-1.5 text-[12.5px] font-semibold"
      value={status}
      disabled={pending}
      onChange={(e) => startTransition(() => setDriverStatus(driverId, e.target.value))}
    >
      {DRIVER_STATUSES.map((s) => (
        <option key={s.value} value={s.value}>{s.label}</option>
      ))}
    </select>
  );
}
