import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireScope } from "@/lib/queries/scope";
import { VehicleForm } from "@/components/vehicles/VehicleForm";

export default async function EditVehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireScope();
  const vehicle = await prisma.vehicle.findUnique({ where: { id } });
  if (!vehicle) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="font-display text-3xl font-medium text-[var(--text)]">Edit Vehicle</h1>
        <p className="text-[13px] text-[var(--text-muted)]">Update details for {vehicle.name}.</p>
      </div>
      <VehicleForm vehicle={vehicle} />
    </div>
  );
}
