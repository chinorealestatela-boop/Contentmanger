"use client";

import { useState } from "react";
import { Car } from "lucide-react";
import { cn } from "@/lib/utils";

/** A vehicle photo (plain <img>, not next/image — photo URLs come from
 * whatever host a CSV upload or the live-site scraper points at, so we
 * can't know the domain ahead of time to allowlist it). Falls back to the
 * generic car icon when there's no photo, or if the URL 404s/breaks after
 * the fact (e.g. the dealer site pulled the listing). */
export function VehicleThumb({ src, alt, className, iconSize = 18 }: { src?: string | null; alt: string; className?: string; iconSize?: number }) {
  const [broken, setBroken] = useState(false);

  if (!src || broken) {
    return (
      <span className={cn("flex items-center justify-center rounded-lg bg-[var(--bg-subtle)] text-[var(--text-faint)]", className)}>
        <Car size={iconSize} />
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={cn("rounded-lg object-cover", className)}
      loading="lazy"
      onError={() => setBroken(true)}
    />
  );
}
