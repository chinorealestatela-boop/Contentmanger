import { cn } from "@/lib/utils";
import { CUSTOMER_TIERS, optionColor, optionLabel } from "@/lib/constants";

export function TierBadge({ tier, className }: { tier: string; className?: string }) {
  const color = optionColor(CUSTOMER_TIERS, tier);
  return (
    <span className={cn("badge", className)} style={{ background: `${color}22`, color, borderColor: `${color}55` }}>
      {tier === "VVIP" && <span aria-hidden>★</span>}
      {optionLabel(CUSTOMER_TIERS, tier)}
    </span>
  );
}

export function Badge({
  children,
  variant = "neutral",
  className,
}: {
  children: React.ReactNode;
  variant?: "gold" | "success" | "warning" | "danger" | "info" | "neutral";
  className?: string;
}) {
  return <span className={cn("badge", `badge-${variant}`, className)}>{children}</span>;
}

export function StatusBadge({ options, value, className }: { options: { value: string; label: string; color?: string }[]; value: string | null | undefined; className?: string }) {
  const color = optionColor(options, value);
  return (
    <span className={cn("badge", className)} style={{ background: `${color}22`, color, borderColor: `${color}55` }}>
      <span className="badge-dot" style={{ background: color }} />
      {optionLabel(options, value)}
    </span>
  );
}

export function ColorDot({ color }: { color: string }) {
  return <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />;
}

export function ColorPill({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className="badge" style={{ background: `${color}22`, color, borderColor: `${color}55` }}>
      {children}
    </span>
  );
}
