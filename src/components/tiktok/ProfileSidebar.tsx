import { SectionCard } from "@/components/ui/SectionCard";
import { optionLabel, TIKTOK_APPLICATION_STATUSES } from "@/lib/constants";
import { formatCurrency, formatTimeAgo } from "@/lib/format";
import type { TikTokConversation } from "@prisma/client";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex items-center justify-between gap-2 py-1.5 text-[12.5px]">
      <span className="text-[var(--text-faint)]">{label}</span>
      <span className="text-right font-medium text-[var(--text)]">{value}</span>
    </div>
  );
}

export function ProfileSidebar({ conversation }: { conversation: TikTokConversation }) {
  return (
    <SectionCard title="Customer Profile">
      <div className="divide-y divide-[var(--border)]">
        <Field label="TikTok" value={`@${conversation.tiktokUsername}`} />
        <Field label="Name" value={conversation.customerName} />
        <Field label="Phone" value={conversation.phone} />
        <Field label="Vehicle Interest" value={conversation.vehicleInterest} />
        <Field label="Down Payment Target" value={conversation.desiredDownPayment ? formatCurrency(conversation.desiredDownPayment) : null} />
        <Field label="Monthly Payment Target" value={conversation.desiredMonthlyPayment ? formatCurrency(conversation.desiredMonthlyPayment) : null} />
        <Field label="Trade-In" value={conversation.hasTradeIn === null ? null : conversation.hasTradeIn ? "Yes" : "No"} />
        <Field label="Driver's License" value={conversation.hasLicense === null ? null : conversation.hasLicense ? "Yes" : "No"} />
        <Field label="Employment" value={conversation.employmentStatus} />
        <Field label="Application" value={optionLabel(TIKTOK_APPLICATION_STATUSES, conversation.applicationStatus)} />
        <Field label="Appointment Requested" value={conversation.appointmentRequested ? "Yes" : "No"} />
        <Field label="AI Confidence" value={conversation.lastConfidence !== null ? `${conversation.lastConfidence}%` : null} />
        <Field label="Human Takeover" value={conversation.humanTakeoverAt ? formatTimeAgo(conversation.humanTakeoverAt) : null} />
      </div>
      {!conversation.customerName && !conversation.phone && !conversation.vehicleInterest && (
        <p className="pt-1 text-[11.5px] text-[var(--text-faint)]">Nothing collected yet — the AI fills this in gradually as the conversation goes, without interrogating the customer.</p>
      )}
    </SectionCard>
  );
}
