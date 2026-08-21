import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function Pagination({ page, pageCount, buildHref }: { page: number; pageCount: number; buildHref: (page: number) => string }) {
  if (pageCount <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-2 py-4">
      <Link
        href={buildHref(Math.max(1, page - 1))}
        aria-disabled={page <= 1}
        className={`btn btn-secondary btn-sm ${page <= 1 ? "pointer-events-none opacity-40" : ""}`}
      >
        <ChevronLeft size={14} /> Prev
      </Link>
      <span className="text-xs font-medium text-[var(--text-muted)]">Page {page} of {pageCount}</span>
      <Link
        href={buildHref(Math.min(pageCount, page + 1))}
        aria-disabled={page >= pageCount}
        className={`btn btn-secondary btn-sm ${page >= pageCount ? "pointer-events-none opacity-40" : ""}`}
      >
        Next <ChevronRight size={14} />
      </Link>
    </div>
  );
}
