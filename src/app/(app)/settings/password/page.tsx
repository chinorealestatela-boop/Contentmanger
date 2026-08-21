import { requireScope } from "@/lib/queries/scope";
import { SettingsShell } from "@/components/settings/SettingsShell";
import { PasswordForm } from "@/components/settings/PasswordForm";

export default async function PasswordSettingsPage() {
  const scope = await requireScope();
  return (
    <SettingsShell isAdmin={scope.role === "ADMIN"} title="Password" subtitle="Change your account password.">
      <div className="card max-w-md p-5"><PasswordForm /></div>
    </SettingsShell>
  );
}
