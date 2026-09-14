import { prisma } from "@/lib/prisma";
import { requireScope } from "@/lib/queries/scope";
import { QuoteForm } from "@/components/quotes/QuoteForm";

export default async function NewQuotePage({ searchParams }: { searchParams: Promise<{ customerId?: string; leadId?: string }> }) {
  const sp = await searchParams;
  await requireScope();
  const [customers, vehicles, drivers] = await Promise.all([
    prisma.customer.findMany({ orderBy: { firstName: "asc" }, select: { id: true, firstName: true, lastName: true, tier: true } }),
    prisma.vehicle.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, fleetNumber: true, hourlyRate: true } }),
    prisma.driver.findMany({ where: { isActive: true }, orderBy: { firstName: "asc" }, select: { id: true, firstName: true, lastName: true } }),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="font-display text-3xl font-medium text-[var(--text)]">New Quote</h1>
        <p className="text-[13px] text-[var(--text-muted)]">Build a premium proposal — pricing calculates automatically.</p>
      </div>
      <QuoteForm customers={customers} vehicles={vehicles} drivers={drivers} defaultCustomerId={sp.customerId} defaultLeadId={sp.leadId} />
    </div>
  );
}
