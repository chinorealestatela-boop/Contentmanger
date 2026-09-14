import Link from "next/link";
import { StatusBadge } from "@/components/ui/Badge";
import { BOOKING_STATUSES } from "@/lib/constants";
import { formatTime12h, fullName } from "@/lib/format";

export type OperationsRowData = {
  id: string;
  pickupTime: string;
  serviceType: string;
  pickupAddress: string | null;
  dropoffAddress: string | null;
  bookingStatus: string;
  customer: { firstName: string; lastName: string; tier: string };
  vehicle: { name: string } | null;
  driver: { firstName: string; lastName: string } | null;
};

export function OperationsRow({ booking }: { booking: OperationsRowData }) {
  return (
    <Link
      href={`/bookings/${booking.id}`}
      className="animate-fade-in group flex items-center gap-4 rounded-xl border border-transparent px-3 py-3.5 transition-colors hover:border-[var(--border)] hover:bg-white/[0.03]"
    >
      <div className="w-16 shrink-0 text-right">
        <p className="font-display text-lg font-medium leading-none text-[var(--text)]">{formatTime12h(booking.pickupTime)}</p>
      </div>
      <div className="h-10 w-px shrink-0 bg-[var(--border)]" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-[13.5px] font-semibold text-[var(--text)]">
            {booking.pickupAddress ?? "Pickup TBD"}{booking.dropoffAddress ? ` → ${booking.dropoffAddress}` : ""}
          </p>
          {booking.customer.tier !== "STANDARD" && <span className="badge badge-gold shrink-0">{booking.customer.tier}</span>}
        </div>
        <p className="mt-0.5 truncate text-[12px] text-[var(--text-muted)]">
          {fullName(booking.customer)} · {booking.vehicle?.name ?? "Vehicle TBD"}{booking.driver ? ` · ${fullName(booking.driver)}` : ""}
        </p>
      </div>
      <StatusBadge options={BOOKING_STATUSES} value={booking.bookingStatus} className="shrink-0" />
    </Link>
  );
}
