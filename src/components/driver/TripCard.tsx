"use client";

import { useTransition } from "react";
import { Phone, Navigation, Plane, Users, MapPin, CheckCircle2 } from "lucide-react";
import { acceptTrip, startTrip, markArrived, markPickedUp, completeTrip } from "@/lib/actions/trips";
import { formatTime12h, fullName } from "@/lib/format";
import { cn } from "@/lib/utils";

export type DriverTripData = {
  id: string;
  bookingNumber: string;
  pickupTime: string;
  serviceType: string;
  pickupAddress: string | null;
  dropoffAddress: string | null;
  passengers: number;
  specialInstructions: string | null;
  flightNumber: string | null;
  bookingStatus: string;
  customer: { firstName: string; lastName: string; phone: string | null };
  vehicle: { name: string } | null;
  trip: { status: string } | null;
};

const STEPS = [
  { status: "SCHEDULED", label: "ACCEPT", action: acceptTrip },
  { status: "ACCEPTED", label: "START TRIP", action: startTrip },
  { status: "DRIVER_EN_ROUTE", label: "ARRIVED", action: markArrived },
  { status: "ARRIVED", label: "PASSENGER PICKED UP", action: markPickedUp },
  { status: "PASSENGER_PICKED_UP", label: "TRIP COMPLETED", action: completeTrip },
  { status: "IN_TRANSIT", label: "TRIP COMPLETED", action: completeTrip },
];

export function TripCard({ trip }: { trip: DriverTripData }) {
  const [pending, startTransition] = useTransition();
  const currentStatus = trip.trip?.status ?? "SCHEDULED";
  const completed = currentStatus === "COMPLETED";
  const step = STEPS.find((s) => s.status === currentStatus);

  return (
    <div className={cn("card p-5", completed && "opacity-60")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-xl font-medium text-[var(--text)]">{formatTime12h(trip.pickupTime)}</p>
          <p className="text-[12px] text-[var(--text-muted)]">{trip.serviceType.replace(/_/g, " ")} · #{trip.bookingNumber}</p>
        </div>
        {completed && <span className="badge badge-success"><CheckCircle2 size={11} /> Completed</span>}
      </div>

      <div className="mt-3 space-y-1.5">
        <p className="text-[15px] font-semibold text-[var(--text)]">{fullName(trip.customer)}</p>
        <p className="flex items-start gap-1.5 text-[13px] text-[var(--text-muted)]">
          <MapPin size={14} className="mt-0.5 shrink-0" /> {trip.pickupAddress ?? "Pickup TBD"} {trip.dropoffAddress ? `→ ${trip.dropoffAddress}` : ""}
        </p>
        <p className="flex items-center gap-1.5 text-[13px] text-[var(--text-muted)]">
          <Users size={14} className="shrink-0" /> {trip.passengers} passenger{trip.passengers === 1 ? "" : "s"} · {trip.vehicle?.name ?? "Vehicle TBD"}
        </p>
        {trip.flightNumber && (
          <p className="flex items-center gap-1.5 text-[13px] text-[var(--text-muted)]"><Plane size={14} className="shrink-0" /> Flight {trip.flightNumber}</p>
        )}
        {trip.specialInstructions && (
          <p className="mt-1 rounded-lg border border-dashed border-[var(--border)] bg-white/[0.02] p-2 text-[12.5px] text-[var(--text-muted)]">{trip.specialInstructions}</p>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        {trip.customer.phone && (
          <a href={`tel:${trip.customer.phone}`} className="btn btn-secondary flex-1"><Phone size={14} /> Call Client</a>
        )}
        {trip.pickupAddress && (
          <a href={`https://maps.google.com/?q=${encodeURIComponent(trip.pickupAddress)}`} target="_blank" rel="noreferrer" className="btn btn-secondary flex-1">
            <Navigation size={14} /> Navigate
          </a>
        )}
      </div>

      {step && !completed && (
        <button
          disabled={pending}
          onClick={() => startTransition(() => step.action(trip.id))}
          className="btn btn-primary mt-3 w-full py-3 text-[13px] tracking-wide"
        >
          {pending ? "Updating…" : step.label}
        </button>
      )}
    </div>
  );
}
