import Link from "next/link";
import { StatusBadge } from "@/components/ui/Badge";
import { BOOKING_STATUSES, PAYMENT_STATUSES } from "@/lib/constants";
import { formatCurrency, formatDate, formatTime12h, fullName } from "@/lib/format";

type BookingData = {
  id: string;
  bookingNumber: string;
  serviceType: string;
  date: Date;
  pickupTime: string;
  totalPrice: number;
  bookingStatus: string;
  paymentStatus: string;
  customer: { firstName: string; lastName: string; tier: string };
  vehicle: { name: string } | null;
  driver: { firstName: string; lastName: string } | null;
};

export function BookingRow({ booking }: { booking: BookingData }) {
  return (
    <Link href={`/bookings/${booking.id}`} className="card card-hover flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="text-[14px] font-semibold text-[var(--text)]">{fullName(booking.customer)}</p>
          {booking.customer.tier !== "STANDARD" && <span className="badge badge-gold">{booking.customer.tier}</span>}
          <span className="text-[11px] text-[var(--text-faint)]">#{booking.bookingNumber}</span>
        </div>
        <p className="mt-0.5 truncate text-[12.5px] text-[var(--text-muted)]">
          {booking.serviceType.replace(/_/g, " ")} · {booking.vehicle?.name ?? "Vehicle TBD"}{booking.driver ? ` · ${fullName(booking.driver)}` : ""}
        </p>
        <p className="mt-0.5 text-[11.5px] text-[var(--text-faint)]">{formatDate(booking.date)} at {formatTime12h(booking.pickupTime)}</p>
      </div>
      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <span className="text-[13px] font-semibold text-[var(--text)]">{formatCurrency(booking.totalPrice)}</span>
        <StatusBadge options={PAYMENT_STATUSES} value={booking.paymentStatus} />
        <StatusBadge options={BOOKING_STATUSES} value={booking.bookingStatus} />
      </div>
    </Link>
  );
}
