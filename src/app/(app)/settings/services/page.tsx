import { requireScope } from "@/lib/queries/scope";
import { prisma } from "@/lib/prisma";
import { SettingsShell } from "@/components/settings/SettingsShell";
import { ServicesSettings } from "@/components/settings/ServicesSettings";

export default async function ServicesSettingsPage() {
  const scope = await requireScope();
  const services = await prisma.service.findMany({ orderBy: { order: "asc" } });

  return (
    <SettingsShell isAdmin={["OWNER", "ADMIN"].includes(scope.role)} title="Services & Pricing" subtitle="Base rates staff start from in the Quote Builder and Booking form.">
      <ServicesSettings services={services} />
    </SettingsShell>
  );
}
