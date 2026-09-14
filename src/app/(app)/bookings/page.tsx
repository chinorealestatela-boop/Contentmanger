import Link from "next/link";
import { Plus } from "lucide-react";
import { listBookings } from "@/lib/queries/bookings";
import { BookingRow } from "@/components/bookings/BookingRow";
import { SearchInput } from "@/components/ui/SearchInput";
import { Pagination } from "@/components/ui/Pagination";
import { BOOKING_STATUSES } from "@/lib/constants";
import { cn } from "@/lib/utils";

export default async function BookingsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  const sp = await searchParams;
  const { bookings, page, pageCount, total } = await listBookings({ q: sp.q, status: sp.status, page: sp.page ? Number(sp.page) : 1 });

  const buildHref = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { q: sp.q, status: sp.status, ...overrides };
    Object.entries(merged).forEach(([k, v]) => v && params.set(k, v));
    const qs = params.toString();
    return `/bookings${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium text-[var(--text)]">Bookings</h1>
          <p className="text-[13px] text-[var(--text-muted)]">{total} reservation{total === 1 ? "" : "s"}</p>
        </div>
        <Link href="/bookings/new" className="btn btn-primary"><Plus size={15} /> New Booking</Link>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <form className="flex-1"><SearchInput defaultValue={sp.q} placeholder="Search booking #, client, phone…" /></form>
        <div className="flex flex-wrap items-center gap-1.5">
          <Link href={buildHref({ status: undefined, page: undefined })} className={cn("badge", !sp.status ? "badge-gold" : "badge-neutral")}>All</Link>
          {BOOKING_STATUSES.map((s) => (
            <Link key={s.value} href={buildHref({ status: s.value, page: undefined })} className={cn("badge", sp.status === s.value ? "badge-gold" : "badge-neutral")}>{s.label}</Link>
          ))}
        </div>
      </div>

      <div className="space-y-2.5">
        {bookings.length === 0 && <div className="card p-10 text-center text-sm text-[var(--text-muted)]">No bookings match your filters yet.</div>}
        {bookings.map((b) => <BookingRow key={b.id} booking={b} />)}
      </div>

      <Pagination page={page} pageCount={pageCount} buildHref={(p) => buildHref({ page: String(p) })} />
    </div>
  );
}
