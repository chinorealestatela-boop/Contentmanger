import { cn } from "@/lib/utils";
import { initials } from "@/lib/utils";

export function Avatar({
  firstName,
  lastName,
  color = "#2563eb",
  size = "md",
  className,
}: {
  firstName: string;
  lastName: string;
  color?: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes: Record<string, string> = {
    xs: "h-6 w-6 text-[10px]",
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-14 w-14 text-lg",
  };
  return (
    <div
      className={cn("flex shrink-0 items-center justify-center rounded-full font-semibold text-white", sizes[size], className)}
      style={{ background: color }}
    >
      {initials(firstName, lastName)}
    </div>
  );
}
