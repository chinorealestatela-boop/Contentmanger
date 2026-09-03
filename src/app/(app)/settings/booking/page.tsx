import { redirect } from "next/navigation";
import { requireScope } from "@/lib/queries/scope";
import { prisma } from "@/lib/prisma";
import { getBookingSettings } from "@/lib/availability";
import { getPrimarySalespersonIdSetting } from "@/lib/actions/settings";
import { SettingsShell } from "@/components/settings/SettingsShell";
import { BookingSettingsForm } from "@/components/settings/BookingSettingsForm";

export default async function BookingSettingsPage() {
  const scope = await requireScope();
  if (scope.role === "SALESPERSON") redirect("/settings");

  const [settings, primarySalespersonId, users] = await Promise.all([
    getBookingSettings(),
    getPrimarySalespersonIdSetting(),
    prisma.user.findMany({ where: { isActive: true }, orderBy: { firstName: "asc" }, select: { id: true, firstName: true, lastName: true } }),
  ]);

  return (
    <SettingsShell
      isAdmin={scope.role === "ADMIN"}
      title="Booking & Hours"
      subtitle="Controls what customers see on the public test-drive booking site: working hours, appointment length, breaks, blackout days, and reminder timing."
    >
      <div className="card max-w-2xl p-5">
        <BookingSettingsForm initial={settings} primarySalespersonId={primarySalespersonId} users={users} />
      </div>
    </SettingsShell>
  );
}
