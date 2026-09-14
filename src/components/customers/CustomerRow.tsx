import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { TierBadge, ColorPill } from "@/components/ui/Badge";
import { formatCurrency, formatTimeAgo } from "@/lib/format";

type CustomerWithLead = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  tier: string;
  updatedAt: Date;
  owner: { firstName: string; lastName: string };
  leads: { status: string; stage: { name: string; color: string } }[];
  bookings: { totalPrice: number; bookingStatus: string }[];
};

export function CustomerRow({ customer }: { customer: CustomerWithLead }) {
  const lead = customer.leads[0];
  const lastBooking = customer.bookings[0];

  return (
    <Link href={`/customers/${customer.id}`} className="card card-hover flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar firstName={customer.firstName} lastName={customer.lastName} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-[14px] font-semibold text-[var(--text)]">{customer.firstName} {customer.lastName}</p>
            {customer.tier !== "STANDARD" && <TierBadge tier={customer.tier} />}
          </div>
          <p className="mt-0.5 truncate text-[12.5px] text-[var(--text-muted)]">
            {customer.phone ?? "—"} {customer.email ? `· ${customer.email}` : ""}
          </p>
          <p className="mt-0.5 truncate text-[12px] text-[var(--text-faint)]">
            {lastBooking ? `Last trip ${formatCurrency(lastBooking.totalPrice)}` : "No bookings yet"}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 sm:justify-end">
        {lead && <ColorPill color={lead.stage.color}>{lead.stage.name}</ColorPill>}
        <div className="text-right">
          <p className="text-[11px] text-[var(--text-muted)]">{customer.owner.firstName} {customer.owner.lastName}</p>
          <p className="text-[11px] text-[var(--text-faint)]">Updated {formatTimeAgo(customer.updatedAt)}</p>
        </div>
      </div>
    </Link>
  );
}
