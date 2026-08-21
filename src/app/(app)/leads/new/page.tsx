import { prisma } from "@/lib/prisma";
import { requireScope } from "@/lib/queries/scope";
import { NewLeadForm } from "@/components/leads/NewLeadForm";

export default async function NewLeadPage() {
  const scope = await requireScope();
  const [sources, users, vehicles] = await Promise.all([
    prisma.leadSource.findMany({ where: { active: true }, orderBy: { order: "asc" } }),
    prisma.user.findMany({ where: { isActive: true }, orderBy: { firstName: "asc" } }),
    prisma.vehicle.findMany({ where: { status: { in: ["AVAILABLE", "HOLD", "IN_TRANSIT"] } }, orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text)]">New Lead</h1>
        <p className="text-[13px] text-[var(--text-muted)]">Capture a new customer and lead in one shot — a Day 0 follow-up sequence starts automatically.</p>
      </div>
      <NewLeadForm sources={sources} users={users} vehicles={vehicles} currentUserId={scope.userId} />
    </div>
  );
}
