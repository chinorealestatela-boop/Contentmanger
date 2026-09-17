import { prisma } from "@/lib/prisma";
import { requireScope } from "@/lib/queries/scope";
import { ScanLeadFlow } from "@/components/licenseScan/ScanLeadFlow";

export const metadata = { title: "Scan License | CRM" };

export default async function ScanLeadPage() {
  const scope = await requireScope();
  const [sources, users, vehicles] = await Promise.all([
    prisma.leadSource.findMany({ where: { active: true }, orderBy: { order: "asc" } }),
    prisma.user.findMany({ where: { isActive: true }, orderBy: { firstName: "asc" } }),
    prisma.vehicle.findMany({ where: { status: { in: ["AVAILABLE", "HOLD", "IN_TRANSIT"] } }, orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text)]">Scan Driver&rsquo;s License</h1>
        <p className="text-[13px] text-[var(--text-muted)]">
          Scan the barcode on the back of the license to auto-fill a new lead — nothing is saved until you review it and tap Save Lead.
        </p>
      </div>
      <ScanLeadFlow sources={sources} users={users} vehicles={vehicles} currentUserId={scope.userId} />
    </div>
  );
}
