import { requireScope } from "@/lib/queries/scope";
import { VehicleForm } from "@/components/vehicles/VehicleForm";

export default async function NewVehiclePage() {
  await requireScope();
  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text)]">Add Vehicle</h1>
        <p className="text-[13px] text-[var(--text-muted)]">Add a vehicle to inventory.</p>
      </div>
      <div className="card p-5"><VehicleForm /></div>
    </div>
  );
}
