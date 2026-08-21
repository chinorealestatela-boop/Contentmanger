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
  tone?: "default" | "hot" | "warm" | "overdue" | "appointment" | "sold" | "lost";
}) {
  const toneClasses: Record<string, string> = {
    default: "text-[var(--brand)] bg-[var(--brand-soft)]",
    hot: "text-[var(--hot)] bg-[var(--hot-soft)]",
    warm: "text-[var(--warm)] bg-[var(--warm-soft)]",
    overdue: "text-[var(--overdue)] bg-[var(--overdue-soft)]",
    appointment: "text-[var(--appointment)] bg-[var(--appointment-soft)]",
    sold: "text-[var(--sold)] bg-[var(--sold-soft)]",
    lost: "text-[var(--lost)] bg-[var(--lost-soft)]",
  };

  const content = (
    <div className="card flex items-center gap-3 p-3.5 transition-shadow hover:shadow-md">
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", toneClasses[tone])}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-xl font-bold leading-tight text-[var(--text)] tabular-nums">{value}</p>
        <p className="text-[11.5px] font-medium leading-snug text-[var(--text-muted)]">{label}</p>
      </div>
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}
