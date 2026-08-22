import { prisma } from "@/lib/prisma";
import { requireScope } from "@/lib/queries/scope";
import { customerScopeWhere } from "@/lib/queries/scope";
import { NewAppointmentForm } from "@/components/appointments/NewAppointmentForm";

export default async function NewAppointmentPage({ searchParams }: { searchParams: Promise<{ customerId?: string }> }) {
  const scope = await requireScope();
  await searchParams;
  const [customers, vehicles] = await Promise.all([
    prisma.customer.findMany({ where: customerScopeWhere(scope), orderBy: { firstName: "asc" } }),
    prisma.vehicle.findMany({ where: { status: { in: ["AVAILABLE", "HOLD", "IN_TRANSIT"] } }, orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <div className="mx-auto max-w-lg space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text)]">Add to Calendar</h1>
        <p className="text-[13px] text-[var(--text-muted)]">Schedule a test drive, sales appointment, delivery, or other calendar event.</p>
      </div>
      <div className="card p-5">
        <NewAppointmentForm customers={customers} vehicles={vehicles} />
      </div>
    </div>
  );
}
