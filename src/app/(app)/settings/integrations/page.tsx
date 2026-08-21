import { requireScope } from "@/lib/queries/scope";
import { prisma } from "@/lib/prisma";
import { SettingsShell } from "@/components/settings/SettingsShell";
import { Badge } from "@/components/ui/Badge";
import { Sparkles, MessageSquare, Mail, Calendar, Database, Truck, type LucideIcon } from "lucide-react";

const META: Record<string, { label: string; desc: string; icon: LucideIcon; envVar: string }> = {
  OPENAI: { label: "AI Provider (OpenAI or similar)", desc: "Upgrades the AI Sales Assistant from the built-in rule-based engine to a full LLM.", icon: Sparkles, envVar: "OPENAI_API_KEY" },
  TWILIO: { label: "SMS (Twilio)", desc: "Send texts directly instead of manually logging them.", icon: MessageSquare, envVar: "TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN" },
  GMAIL: { label: "Email (Gmail)", desc: "Send and sync emails directly from customer profiles.", icon: Mail, envVar: "EMAIL_PROVIDER_API_KEY" },
  OUTLOOK: { label: "Email (Outlook)", desc: "Send and sync emails directly from customer profiles.", icon: Mail, envVar: "EMAIL_PROVIDER_API_KEY" },
  GOOGLE_CALENDAR: { label: "Google Calendar", desc: "Two-way sync of appointments with your calendar.", icon: Calendar, envVar: "GOOGLE_CALENDAR_CLIENT_ID / SECRET" },
  DMS: { label: "Dealership Management System", desc: "Sync customer and deal records with your DMS.", icon: Database, envVar: "DMS_API_KEY" },
  INVENTORY_FEED: { label: "Inventory Feed", desc: "Auto-import vehicle inventory from a third-party feed instead of manual entry.", icon: Truck, envVar: "INVENTORY_FEED_URL" },
};

export default async function IntegrationsSettingsPage() {
  const scope = await requireScope();
  const integrations = await prisma.integration.findMany({ orderBy: { category: "asc" } });

  return (
    <SettingsShell isAdmin={scope.role === "ADMIN"} title="Integrations" subtitle="Everything in Driveline CRM works fully without these. Connect them later to unlock more automation.">
      <div className="space-y-2.5">
        {integrations.map((i) => {
          const meta = META[i.provider];
          if (!meta) return null;
          return (
            <div key={i.id} className="card flex items-start gap-3 p-4">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-subtle)] text-[var(--text-muted)]"><meta.icon size={17} /></span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-[13.5px] font-semibold text-[var(--text)]">{meta.label}</p>
                  <Badge variant={i.enabled ? "sold" : "neutral"}>{i.enabled ? "Connected" : "Not Connected"}</Badge>
                </div>
                <p className="mt-0.5 text-[12.5px] text-[var(--text-muted)]">{meta.desc}</p>
                {!i.enabled && <p className="mt-1 font-mono text-[11px] text-[var(--text-faint)]">Set {meta.envVar} in your environment to enable.</p>}
              </div>
            </div>
          );
        })}
      </div>
    </SettingsShell>
  );
}
