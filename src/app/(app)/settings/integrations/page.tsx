import { requireScope } from "@/lib/queries/scope";
import { prisma } from "@/lib/prisma";
import { SettingsShell } from "@/components/settings/SettingsShell";
import { IntegrationToggle } from "@/components/settings/IntegrationToggle";
import { MessageSquare, Mail, CreditCard, Calendar, Satellite, Plane, Sparkles, type LucideIcon } from "lucide-react";

const META: Record<string, { label: string; desc: string; icon: LucideIcon; envVar: string }> = {
  TWILIO: { label: "Twilio (SMS)", desc: "Send automated texts (confirmations, reminders, follow-ups) directly instead of just logging them.", icon: MessageSquare, envVar: "TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN" },
  SENDGRID: { label: "SendGrid (Email)", desc: "Send automated emails — quotes, confirmations, receipts.", icon: Mail, envVar: "SENDGRID_API_KEY" },
  RESEND: { label: "Resend (Email)", desc: "Alternative email provider for transactional sends.", icon: Mail, envVar: "RESEND_API_KEY" },
  STRIPE: { label: "Stripe (Payments)", desc: "Real hosted payment links and card processing for deposits and balances.", icon: CreditCard, envVar: "STRIPE_SECRET_KEY" },
  GOOGLE_CALENDAR: { label: "Google Calendar", desc: "Two-way sync of bookings with your calendar.", icon: Calendar, envVar: "GOOGLE_CALENDAR_CLIENT_ID / SECRET" },
  GPS_TELEMATICS: { label: "GPS / Telematics", desc: "Live fleet location on the Live Map instead of the seeded demo positions.", icon: Satellite, envVar: "TELEMATICS_API_KEY" },
  FLIGHT_TRACKING: { label: "Flight Tracking", desc: "Auto-update flight status (delayed/landed) on airport transfer bookings.", icon: Plane, envVar: "FLIGHT_API_KEY" },
  OPENAI: { label: "AI Provider (LLM)", desc: "Upgrades the AI Assistant from the built-in rule-based engine to a full LLM.", icon: Sparkles, envVar: "OPENAI_API_KEY" },
};

export default async function IntegrationsSettingsPage() {
  const scope = await requireScope();
  const isAdmin = ["OWNER", "ADMIN"].includes(scope.role);
  const integrations = await prisma.integration.findMany({ orderBy: { category: "asc" } });

  return (
    <SettingsShell isAdmin={isAdmin} title="Integrations" subtitle="Every core feature works fully without these connected. Flip one on once real credentials are in place to unlock live sending/processing.">
      <div className="space-y-2.5">
        {integrations.map((i) => {
          const meta = META[i.provider];
          if (!meta) return null;
          return (
            <div key={i.id} className="card flex items-start gap-3 p-4">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-[var(--text-muted)]"><meta.icon size={17} /></span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-[13.5px] font-semibold text-[var(--text)]">{meta.label}</p>
                </div>
                <p className="mt-0.5 text-[12.5px] text-[var(--text-muted)]">{meta.desc}</p>
                {!i.enabled && <p className="mt-1 font-mono text-[11px] text-[var(--text-faint)]">Set {meta.envVar} in your environment, then flip this on.</p>}
              </div>
              <IntegrationToggle provider={i.provider} enabled={i.enabled} disabled={!isAdmin} />
            </div>
          );
        })}
      </div>
    </SettingsShell>
  );
}
