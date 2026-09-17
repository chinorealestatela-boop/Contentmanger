import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireScope } from "@/lib/queries/scope";
import { getPaymentAutomationSettings } from "@/lib/payments/reminders";
import { getSmsTemplates } from "@/lib/payments/templates";
import { SectionCard } from "@/components/ui/SectionCard";
import { AutomationSettingsForm } from "@/components/payments/AutomationSettingsForm";
import { SmsTemplateManager } from "@/components/payments/SmsTemplateManager";

export const metadata = { title: "Payment Automation | CRM" };

export default async function PaymentSettingsPage() {
  await requireScope();
  const [automation, templates] = await Promise.all([getPaymentAutomationSettings(), getSmsTemplates()]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <div>
        <Link href="/payments" className="flex items-center gap-1 text-[12.5px] font-semibold text-[var(--brand)] hover:underline"><ArrowLeft size={13} /> Back to Payments</Link>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--text)]">Payment Automation</h1>
        <p className="text-[13.5px] text-[var(--text-muted)]">Control exactly when reminders go out, and what they say.</p>
      </div>

      <SectionCard title="Reminder Schedule">
        <AutomationSettingsForm initial={automation} />
      </SectionCard>

      <SectionCard title="SMS Templates">
        <SmsTemplateManager templates={templates} />
      </SectionCard>
    </div>
  );
}
