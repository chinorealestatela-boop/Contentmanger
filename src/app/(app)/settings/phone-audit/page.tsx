import { redirect } from "next/navigation";
import { requireScope } from "@/lib/queries/scope";
import { SettingsShell } from "@/components/settings/SettingsShell";
import { PhoneAuditPanel } from "@/components/settings/PhoneAuditPanel";

export default async function PhoneAuditPage() {
  const scope = await requireScope();
  if (scope.role !== "ADMIN") redirect("/settings");

  return (
    <SettingsShell
      isAdmin
      title="Phone Number Audit"
      subtitle="One-time cleanup for customer records saved before the phone-mask fix — see the fix shipped for the duplicate-1 bug."
    >
      <div className="card space-y-3 p-5">
        <PhoneAuditPanel />
      </div>
    </SettingsShell>
  );
}
