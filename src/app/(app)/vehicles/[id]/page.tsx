import { notFound } from "next/navigation";
import Link from "next/link";
import { Car, Pencil } from "lucide-react";
import { requireScope } from "@/lib/queries/scope";
import { getVehicleDetail } from "@/lib/queries/vehicles";
import { SectionCard, EmptyRow } from "@/components/ui/SectionCard";
import { Badge } from "@/components/ui/Badge";
import { VehicleStatusControl } from "@/components/vehicles/VehicleStatusControl";
import { formatCurrency, formatDate, formatTime12h } from "@/lib/format";
import { optionLabel, VEHICLE_CONDITIONS, APPOINTMENT_STATUSES } from "@/lib/constants";

export default async function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireScope();
  const vehicle = await getVehicleDetail(id);
  if (!vehicle) notFound();

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
      <div className="card p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-subtle)] text-[var(--text-faint)]">
              <Car size={26} strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-[var(--text)]">{vehicle.year} {vehicle.make} {vehicle.model} {vehicle.trim}</h1>
              <p className="mt-1 text-[13px] text-[var(--text-muted)]">#{vehicle.stockNumber} · VIN {vehicle.vin} · {optionLabel(VEHICLE_CONDITIONS, vehicle.condition)}</p>
              <p className="mt-1 text-[20px] font-bold text-[var(--text)]">{formatCurrency(vehicle.internetPrice ?? vehicle.sellingPrice)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/vehicles/${vehicle.id}/edit`} className="btn btn-secondary btn-sm"><Pencil size={13} /> Edit</Link>
            <Link href="/leads/new" className="btn btn-primary btn-sm">Attach to New Lead</Link>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-4">
          <VehicleStatusControl vehicleId={vehicle.id} status={vehicle.status} />
          {vehicle.location && <span className="text-[12.5px] text-[var(--text-muted)]">📍 {vehicle.location}</span>}
          {vehicle.mileage > 0 && <span className="text-[12.5px] text-[var(--text-muted)]">{vehicle.mileage.toLocaleString()} mi</span>}
          {vehicle.exteriorColor && <span className="text-[12.5px] text-[var(--text-muted)]">Ext: {vehicle.exteriorColor}</span>}
          {vehicle.interiorColor && <span className="text-[12.5px] text-[var(--text-muted)]">Int: {vehicle.interiorColor}</span>}
          {vehicle.seatingCapacity && <span className="text-[12.5px] text-[var(--text-muted)]">{vehicle.seatingCapacity} seats</span>}
        </div>
        {vehicle.description && <p className="mt-3 text-[13px] text-[var(--text-muted)]">{vehicle.description}</p>}
      </div>

      <SectionCard title={`Interested Customers (${vehicle.customerInterests.length})`}>
        {vehicle.customerInterests.length === 0 ? (
          <EmptyRow>No customers linked to this vehicle yet.</EmptyRow>
        ) : (
          <ul className="space-y-2">
            {vehicle.customerInterests.map((ci) => (
              <li key={ci.id}>
                <Link href={`/customers/${ci.customerId}`} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3.5 py-2.5 hover:bg-[var(--bg-subtle)]">
                  <span className="text-[13px] font-medium text-[var(--text)]">{ci.customer.firstName} {ci.customer.lastName}</span>
                  <div className="flex items-center gap-2">
                    {ci.lead && <Badge variant="neutral">{ci.lead.stage.name}</Badge>}
                    <Badge variant={ci.interestLevel === "STRONG" ? "hot" : ci.interestLevel === "PURCHASED" ? "sold" : "neutral"}>{ci.interestLevel}</Badge>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Appointments">
        {vehicle.appointments.length === 0 ? (
          <EmptyRow>No appointments for this vehicle.</EmptyRow>
        ) : (
          <ul className="space-y-2">
            {vehicle.appointments.map((a) => (
              <li key={a.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3.5 py-2.5">
                <span className="text-[13px] text-[var(--text)]">{a.customer.firstName} {a.customer.lastName} — {a.type.replace(/_/g, " ")}</span>
                <span className="text-[11.5px] text-[var(--text-faint)]">{formatDate(a.date)} {formatTime12h(a.time)} · {optionLabel(APPOINTMENT_STATUSES, a.status)}</span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {vehicle.sales.length > 0 && (
        <SectionCard title="Sale">
          {vehicle.sales.map((s) => (
            <div key={s.id} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5">
              <p className="text-[13px] font-semibold text-emerald-800">{s.customer.firstName} {s.customer.lastName} — {formatCurrency(s.salePrice)}</p>
              <p className="text-[11.5px] text-emerald-700">{formatDate(s.saleDate)}</p>
            </div>
          ))}
        </SectionCard>
      )}
    </div>
  );
}
