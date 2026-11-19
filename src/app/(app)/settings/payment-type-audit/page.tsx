import { redirect } from "next/navigation";
import { requireScope } from "@/lib/queries/scope";
import { SettingsShell } from "@/components/settings/SettingsShell";
import { PaymentTypeAuditPanel } from "@/components/settings/PaymentTypeAuditPanel";

export default async function PaymentTypeAuditPage() {
  const scope = await requireScope();
  if (scope.role !== "ADMIN") redirect("/settings");

  return (
    <SettingsShell
      isAdmin
      title="Payment Type Audit"
      subtitle="Find First vs. Pick Payments that are missing, duplicated, past due, or possibly filed under the wrong type — nothing changes until you fix it by hand."
    >
      <div className="card space-y-3 p-5">
        <PaymentTypeAuditPanel />
      </div>
    </SettingsShell>
  );
}
