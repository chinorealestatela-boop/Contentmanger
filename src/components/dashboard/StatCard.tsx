import Link from "next/link";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  icon: Icon,
  href,
  tone = "default",
}: {
  label: string;
  value: number | string;
  icon: LucideIcon;
  href?: string;
  tone?: "default" | "success" | "warning" | "danger" | "info";
}) {
  const toneClasses: Record<string, string> = {
    default: "text-[var(--brand-bright)] bg-[var(--brand-soft)] border-[var(--brand-line)]",
    success: "text-[var(--success)] bg-[var(--success-soft)] border-[var(--success)]/30",
    warning: "text-[var(--warning)] bg-[var(--warning-soft)] border-[var(--warning)]/30",
    danger: "text-[var(--danger)] bg-[var(--danger-soft)] border-[var(--danger)]/30",
    info: "text-[var(--info)] bg-[var(--info-soft)] border-[var(--info)]/30",
  };

  const content = (
    <div className="card card-hover flex items-center gap-3 p-4">
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full border", toneClasses[tone])}>
        <Icon size={17} strokeWidth={1.75} />
      </div>
      <div className="min-w-0">
        <p className="font-display text-2xl font-medium leading-tight text-[var(--text)] tabular-nums">{value}</p>
        <p className="text-[11px] font-medium leading-snug text-[var(--text-muted)]">{label}</p>
      </div>
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}
