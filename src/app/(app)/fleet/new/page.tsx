import { requireScope } from "@/lib/queries/scope";
import { VehicleForm } from "@/components/vehicles/VehicleForm";

export default async function NewVehiclePage() {
  await requireScope();
  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="font-display text-3xl font-medium text-[var(--text)]">Add Vehicle</h1>
        <p className="text-[13px] text-[var(--text-muted)]">Add a new vehicle to the Stratos Exotics fleet.</p>
      </div>
      <VehicleForm />
    </div>
  );
}
