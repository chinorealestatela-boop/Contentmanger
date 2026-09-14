"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignDriverToBooking, assignVehicleToBooking, cancelBooking } from "@/lib/actions/bookings";
import { setFlightStatusAction } from "@/lib/actions/flights";
import { FLIGHT_STATUSES } from "@/lib/constants";

export function DriverAssignControl({ bookingId, driverId, drivers }: { bookingId: string; driverId: string | null; drivers: { id: string; firstName: string; lastName: string }[] }) {
  const [pending, startTransition] = useTransition();
  return (
    <select
      className="input !w-auto !py-1.5 text-[12.5px]"
      value={driverId ?? ""}
      disabled={pending}
      onChange={(e) => startTransition(() => assignDriverToBooking(bookingId, e.target.value || null))}
    >
      <option value="">Unassigned</option>
      {drivers.map((d) => <option key={d.id} value={d.id}>{d.firstName} {d.lastName}</option>)}
    </select>
  );
}

export function VehicleAssignControl({ bookingId, vehicleId, vehicles }: { bookingId: string; vehicleId: string | null; vehicles: { id: string; name: string; fleetNumber: string }[] }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <select
      className="input !w-auto !py-1.5 text-[12.5px]"
      value={vehicleId ?? ""}
      disabled={pending}
      onChange={(e) =>
        startTransition(async () => {
          const res = await assignVehicleToBooking(bookingId, e.target.value || null);
          if (res && "error" in res && res.error) alert(res.error);
          router.refresh();
        })
      }
    >
      <option value="">Unassigned</option>
      {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name} ({v.fleetNumber})</option>)}
    </select>
  );
}

export function FlightStatusControl({ bookingId, status }: { bookingId: string; status: string | null }) {
  const [pending, startTransition] = useTransition();
  return (
    <select
      className="input !w-auto !py-1.5 text-[12.5px]"
      value={status ?? ""}
      disabled={pending}
      onChange={(e) => startTransition(() => setFlightStatusAction(bookingId, e.target.value))}
    >
      <option value="">No status</option>
      {FLIGHT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
    </select>
  );
}

export function CancelBookingButton({ bookingId }: { bookingId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => {
        if (confirm("Cancel this booking? The vehicle and chauffeur will be freed up.")) startTransition(() => cancelBooking(bookingId));
      }}
      className="btn btn-secondary btn-sm !text-[var(--danger)]"
    >
      Cancel Booking
    </button>
  );
}
