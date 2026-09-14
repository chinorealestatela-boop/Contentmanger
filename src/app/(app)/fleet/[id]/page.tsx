import { notFound } from "next/navigation";
import Link from "next/link";
import { Gauge, Shield, FileBadge, MapPin } from "lucide-react";
import { getVehicleDetail } from "@/lib/queries/vehicles";
import { SectionCard, EmptyRow } from "@/components/ui/SectionCard";
import { StatusBadge } from "@/components/ui/Badge";
import { VehicleAvailabilityControl } from "@/components/vehicles/VehicleAvailabilityControl";
import { MaintenanceSection } from "@/components/vehicles/MaintenanceForm";
import { formatCurrency, formatDate, formatTime12h, fullName } from "@/lib/format";
import { optionLabel, VEHICLE_TYPES, BOOKING_STATUSES } from "@/lib/constants";

export default async function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const vehicle = await getVehicleDetail(id);
  if (!vehicle) notFound();

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6 lg:p-8">
      <div className="card p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-medium text-[var(--text)]">{vehicle.name}</h1>
              <VehicleAvailabilityControl vehicleId={vehicle.id} availability={vehicle.availability} />
            </div>
            <p className="mt-1 text-[13px] text-[var(--text-muted)]">
              #{vehicle.fleetNumber} · {vehicle.year} {vehicle.make} {vehicle.model} · {optionLabel(VEHICLE_TYPES, vehicle.vehicleType)}
            </p>
            <p className="mt-1 flex items-center gap-1 text-[12.5px] text-[var(--text-faint)]">
              <MapPin size={12} /> {vehicle.currentLocation ?? "Location unknown"}
              {vehicle.assignedDriver && <span className="ml-2">· Assigned to {fullName(vehicle.assignedDriver)}</span>}
            </p>
          </div>
          <Link href={`/fleet/${vehicle.id}/edit`} className="text-xs font-semibold text-[var(--brand-bright)] hover:underline">Edit Vehicle</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Hourly Rate" value={vehicle.hourlyRate ? formatCurrency(vehicle.hourlyRate) : "—"} />
        <Stat label="Daily Rate" value={vehicle.dailyRate ? formatCurrency(vehicle.dailyRate) : "—"} />
        <Stat label="Deposit" value={vehicle.depositRequirement ? formatCurrency(vehicle.depositRequirement) : "—"} />
        <Stat label="Mileage" value={`${vehicle.currentMileage.toLocaleString()} mi`} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <SectionCard title="Vehicle Details">
            <dl className="grid grid-cols-2 gap-4 text-[13px] sm:grid-cols-3">
              <Info label="VIN" value={vehicle.vin} />
              <Info label="License Plate" value={vehicle.licensePlate} />
              <Info label="Color" value={vehicle.color} />
              <Info label="Seating" value={vehicle.seatingCapacity?.toString()} />
              <Info label="Home Base" value={vehicle.homeBase} />
            </dl>
          </SectionCard>

          <SectionCard title="Insurance &amp; Registration" action={<Shield size={14} className="text-[var(--text-faint)]" />}>
            <dl className="grid grid-cols-2 gap-4 text-[13px] sm:grid-cols-3">
              <Info label="Insurance Provider" value={vehicle.insuranceProvider} />
              <Info label="Policy Number" value={vehicle.insurancePolicyNo} />
              <Info label="Insurance Expires" value={vehicle.insuranceExpiresAt ? formatDate(vehicle.insuranceExpiresAt) : null} />
              <Info label="Registration Expires" value={vehicle.registrationExpiresAt ? formatDate(vehicle.registrationExpiresAt) : null} />
            </dl>
          </SectionCard>

          <SectionCard title="Maintenance" action={<FileBadge size={14} className="text-[var(--text-faint)]" />}>
            <MaintenanceSection vehicleId={vehicle.id} records={vehicle.maintenanceRecords} />
          </SectionCard>

          <SectionCard title="Booking History" action={<Gauge size={14} className="text-[var(--text-faint)]" />}>
            {vehicle.bookings.length === 0 ? (
              <EmptyRow>No bookings yet for this vehicle.</EmptyRow>
            ) : (
              <ul className="space-y-2">
                {vehicle.bookings.map((b) => (
                  <li key={b.id}>
                    <Link href={`/bookings/${b.id}`} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3.5 py-2.5 hover:bg-white/[0.03]">
                      <div>
                        <p className="text-[13px] font-medium text-[var(--text)]">{fullName(b.customer)}</p>
                        <p className="text-[11.5px] text-[var(--text-faint)]">{formatDate(b.date)} at {formatTime12h(b.pickupTime)}{b.driver ? ` · ${fullName(b.driver)}` : ""}</p>
                      </div>
                      <StatusBadge options={BOOKING_STATUSES} value={b.bookingStatus} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        <div className="space-y-5">
          {vehicle.notes && (
            <SectionCard title="Notes">
              <p className="whitespace-pre-wrap text-[13px] text-[var(--text)]">{vehicle.notes}</p>
            </SectionCard>
          )}
          {vehicle.preferredByCustomers.length > 0 && (
            <SectionCard title="Preferred By">
              <ul className="space-y-1.5">
                {vehicle.preferredByCustomers.map((c) => (
                  <li key={c.id}><Link href={`/customers/${c.id}`} className="text-[13px] text-[var(--text)] hover:text-[var(--brand-bright)]">{c.firstName} {c.lastName}</Link></li>
                ))}
              </ul>
            </SectionCard>
          )}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">{label}</dt>
      <dd className="mt-0.5 text-[var(--text)]">{value || "—"}</dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="font-display text-xl font-medium text-[var(--text)]">{value}</p>
      <p className="mt-0.5 text-[11px] font-medium text-[var(--text-muted)]">{label}</p>
    </div>
  );
}
