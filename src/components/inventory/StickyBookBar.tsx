"use client";

import Link from "next/link";
import { CalendarCheck } from "lucide-react";
import { formatCurrency } from "@/lib/format";

/** Mobile-only bar pinned to the bottom of the viewport on a vehicle detail
 * page, so "Schedule Test Drive" stays one tap away no matter how far the
 * customer scrolls through photos/specs/features — the equivalent CTA in
 * the page body requires scrolling back up to find. Desktop already shows
 * the CTA row without scrolling, so this only renders below the lg
 * breakpoint. */
export function StickyBookBar({ vehicleId, title, price }: { vehicleId: string; title: string; price: number | null }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--bg-elevated)]/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(0,0,0,0.08)] backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-5xl items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-semibold text-[var(--text)]">{title}</p>
          {price != null && <p className="text-[13px] font-bold text-[var(--brand)]">{formatCurrency(price)}</p>}
        </div>
        <Link href={`/book?vehicle=${vehicleId}`} className="btn btn-primary shrink-0 py-2.5">
          <CalendarCheck size={15} /> Schedule Test Drive
        </Link>
      </div>
    </div>
  );
}
