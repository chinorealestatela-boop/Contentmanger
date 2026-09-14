import { prisma } from "@/lib/prisma";
import { requireScope } from "@/lib/queries/scope";
import { NewLeadForm } from "@/components/leads/NewLeadForm";

export default async function NewLeadPage() {
  const scope = await requireScope();
  const [sources, users, vehicles] = await Promise.all([
    prisma.leadSource.findMany({ where: { active: true }, orderBy: { order: "asc" } }),
    prisma.user.findMany({ where: { isActive: true }, orderBy: { firstName: "asc" } }),
    prisma.vehicle.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="font-display text-3xl font-medium text-[var(--text)]">New Lead</h1>
        <p className="text-[13px] text-[var(--text-muted)]">Capture a new inquiry — a follow-up cadence starts automatically the moment it&rsquo;s created.</p>
      </div>
      <NewLeadForm sources={sources} users={users} vehicles={vehicles} currentUserId={scope.userId} />
    </div>
  );
}
