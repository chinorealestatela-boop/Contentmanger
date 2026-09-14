import { ColorPill } from "@/components/ui/Badge";
import { optionColor, optionLabel, TIKTOK_CONVERSATION_STATUSES, TIKTOK_ESCALATION_REASONS, TIKTOK_INTENTS, TIKTOK_MODES, TIKTOK_TEMPERATURES } from "@/lib/constants";

export function TikTokTemperatureBadge({ temperature }: { temperature: string }) {
  return <ColorPill color={optionColor(TIKTOK_TEMPERATURES, temperature)}>{optionLabel(TIKTOK_TEMPERATURES, temperature)}</ColorPill>;
}

export function TikTokStatusBadge({ status }: { status: string }) {
  return <ColorPill color={optionColor(TIKTOK_CONVERSATION_STATUSES, status)}>{optionLabel(TIKTOK_CONVERSATION_STATUSES, status)}</ColorPill>;
}

export function TikTokModeBadge({ mode }: { mode: string | null }) {
  const value = mode ?? "DRAFT";
  return <ColorPill color={optionColor(TIKTOK_MODES, value)}>{optionLabel(TIKTOK_MODES, value).split(" — ")[0]}</ColorPill>;
}

export function TikTokIntentBadge({ intent }: { intent: string | null }) {
  if (!intent) return null;
  return <span className="badge badge-neutral">{optionLabel(TIKTOK_INTENTS, intent)}</span>;
}

export function TikTokEscalationReasonBadge({ reason }: { reason: string | null }) {
  if (!reason) return null;
  return <span className="badge badge-overdue">{optionLabel(TIKTOK_ESCALATION_REASONS, reason)}</span>;
}

export function ConfidenceMeter({ score }: { score: number | null }) {
  if (score === null) return null;
  const color = score >= 90 ? "#16a34a" : score >= 75 ? "#2563eb" : score >= 50 ? "#a16207" : "#dc2626";
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium" style={{ color }}>
      <span className="inline-block h-1.5 w-10 overflow-hidden rounded-full bg-[var(--border)]">
        <span className="block h-full rounded-full" style={{ width: `${score}%`, background: color }} />
      </span>
      {score}%
    </span>
  );
}
