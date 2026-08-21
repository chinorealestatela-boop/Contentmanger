import { SettingsNav } from "@/components/settings/SettingsNav";

export function SettingsShell({ isAdmin, title, subtitle, children }: { isAdmin: boolean; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text)]">{title}</h1>
        {subtitle && <p className="text-[13px] text-[var(--text-muted)]">{subtitle}</p>}
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[200px_1fr]">
        <SettingsNav isAdmin={isAdmin} />
        <div className="space-y-5">{children}</div>
      </div>
    </div>
  );
}
