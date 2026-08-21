import { cn } from "@/lib/utils";
import type { Temperature } from "@/lib/constants";

const TEMP_CLASS: Record<Temperature, string> = {
  HOT: "badge-hot",
  WARM: "badge-warm",
  COLD: "badge-cold",
};

const TEMP_DOT: Record<Temperature, string> = {
  HOT: "🔥",
  WARM: "☀️",
  COLD: "❄️",
};

export function TemperatureBadge({ temperature, className }: { temperature: string; className?: string }) {
  const t = (temperature as Temperature) in TEMP_CLASS ? (temperature as Temperature) : "COLD";
  return (
    <span className={cn("badge", TEMP_CLASS[t], className)}>
      <span aria-hidden>{TEMP_DOT[t]}</span> {t}
    </span>
  );
}

export function Badge({
  children,
  variant = "neutral",
  className,
}: {
  children: React.ReactNode;
  variant?: "hot" | "warm" | "cold" | "overdue" | "appointment" | "sold" | "lost" | "neutral";
  className?: string;
}) {
  return <span className={cn("badge", `badge-${variant}`, className)}>{children}</span>;
}

export function ColorDot({ color }: { color: string }) {
  return <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />;
}

export function ColorPill({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      className="badge"
      style={{ background: `${color}1a`, color }}
    >
      {children}
    </span>
  );
}
