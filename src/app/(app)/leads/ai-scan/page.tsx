import { prisma } from "@/lib/prisma";
import { requireScope } from "@/lib/queries/scope";
import { AiLeadScanFlow } from "@/components/aiScan/AiLeadScanFlow";

export const metadata = { title: "Scan New Lead | CRM" };

export default async function AiScanLeadPage() {
  const scope = await requireScope();
  const [sources, users, vehicles] = await Promise.all([
    prisma.leadSource.findMany({ where: { active: true }, orderBy: { order: "asc" } }),
    prisma.user.findMany({ where: { isActive: true }, orderBy: { firstName: "asc" } }),
    prisma.vehicle.findMany({ where: { status: { in: ["AVAILABLE", "HOLD", "IN_TRANSIT"] } }, orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text)]">Scan New Lead</h1>
        <p className="text-[13px] text-[var(--text-muted)]">
          Take a picture of a physical lead form and AI fills in the lead for you — review everything and confirm before it&rsquo;s saved.
        </p>
      </div>
      <AiLeadScanFlow sources={sources} users={users} vehicles={vehicles} currentUserId={scope.userId} />
    </div>
  );
}
