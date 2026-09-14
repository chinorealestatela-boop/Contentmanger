import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireScope } from "@/lib/queries/scope";
import { DriverForm } from "@/components/drivers/DriverForm";

export default async function EditDriverPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireScope();
  const driver = await prisma.driver.findUnique({ where: { id } });
  if (!driver) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="font-display text-3xl font-medium text-[var(--text)]">Edit Chauffeur</h1>
        <p className="text-[13px] text-[var(--text-muted)]">Update details for {driver.firstName} {driver.lastName}.</p>
      </div>
      <DriverForm driver={driver} />
    </div>
  );
}
