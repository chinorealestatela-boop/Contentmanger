import { notFound } from "next/navigation";
import Link from "next/link";
import { MapPin, Users, Plane, Clock } from "lucide-react";
import { getBookingDetail } from "@/lib/queries/bookings";
import { prisma } from "@/lib/prisma";
import { SectionCard, EmptyRow } from "@/components/ui/SectionCard";
import { StatusBadge } from "@/components/ui/Badge";
import { QuickActions } from "@/components/actions/QuickActions";
import { ActivityTimeline } from "@/components/customers/ActivityTimeline";
import { PaymentSection } from "@/components/payments/PaymentSection";
import { DriverAssignControl, VehicleAssignControl, FlightStatusControl, CancelBookingButton } from "@/components/bookings/BookingControls";
import { formatCurrency, formatDate, formatTime12h, fullName } from "@/lib/format";
import { optionLabel, SERVICE_TYPES, BOOKING_STATUSES, PAYMENT_STATUSES, FLIGHT_STATUSES } from "@/lib/constants";

export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const booking = await getBookingDetail(id);
  if (!booking) notFound();

  const [drivers, vehicles] = await Promise.all([
    prisma.driver.findMany({ where: { isActive: true }, orderBy: { firstName: "asc" } }),
    prisma.vehicle.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);

  const stops: string[] = booking.additionalStops ? JSON.parse(booking.additionalStops) : [];
  const amenities: string[] = booking.amenities ? JSON.parse(booking.amenities) : [];

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-medium text-[var(--text)]">Booking {booking.bookingNumber}</h1>
            <StatusBadge options={BOOKING_STATUSES} value={booking.bookingStatus} />
            <StatusBadge options={PAYMENT_STATUSES} value={booking.paymentStatus} />
          </div>
          <p className="mt-1 text-[13px] text-[var(--text-muted)]">
            <Link href={`/customers/${booking.customer.id}`} className="font-medium text-[var(--text)] hover:text-[var(--brand-bright)]">{fullName(booking.customer)}</Link>
            {" · "}{optionLabel(SERVICE_TYPES, booking.serviceType)} · {formatDate(booking.date)} at {formatTime12h(booking.pickupTime)}
          </p>
        </div>
        <CancelBookingButton bookingId={booking.id} />
      </div>

      <QuickActions customerId={booking.customer.id} leadId={booking.leadId} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total" value={formatCurrency(booking.totalPrice)} />
        <Stat label="Deposit Paid" value={formatCurrency(booking.deposit)} />
        <Stat label="Balance Due" value={formatCurrency(booking.remainingBalance)} />
        <Stat label="Passengers" value={String(booking.passengers)} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <SectionCard title="Trip Details">
            <dl className="grid grid-cols-2 gap-4 text-[13px] sm:grid-cols-3">
              <Info icon={MapPin} label="Pickup" value={booking.pickupAddress} />
              <Info icon={MapPin} label="Drop-off" value={booking.dropoffAddress} />
              <Info icon={Clock} label="End Time" value={booking.endTime ? formatTime12h(booking.endTime) : null} />
              <Info icon={Users} label="Passengers" value={String(booking.passengers)} />
            </dl>
            {stops.length > 0 && (
              <div className="mt-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">Additional Stops</p>
                <ul className="mt-1 list-inside list-disc text-[13px] text-[var(--text)]">
                  {stops.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            )}
            {amenities.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {amenities.map((a) => <span key={a} className="badge badge-neutral">{a}</span>)}
              </div>
            )}
            {booking.specialInstructions && (
              <div className="mt-3 rounded-lg border border-dashed border-[var(--border)] bg-white/[0.02] p-3 text-[13px] text-[var(--text-muted)]">{booking.specialInstructions}</div>
            )}
          </SectionCard>

          {(booking.flightNumber || booking.serviceType === "AIRPORT_TRANSFER") && (
            <SectionCard title="Flight Information" action={<Plane size={14} className="text-[var(--text-faint)]" />}>
              <dl className="grid grid-cols-2 gap-4 text-[13px] sm:grid-cols-3">
                <Info label="Airline" value={booking.flightAirline} />
                <Info label="Flight #" value={booking.flightNumber} />
                <Info label="Airport" value={booking.flightAirport} />
              </dl>
              <div className="mt-3 flex items-center gap-2">
                <span className="label !mb-0">Status:</span>
                <FlightStatusControl bookingId={booking.id} status={booking.flightStatus} />
                {booking.flightStatus && <StatusBadge options={FLIGHT_STATUSES} value={booking.flightStatus} />}
              </div>
            </SectionCard>
          )}

          <SectionCard title="Payments">
            <PaymentSection customerId={booking.customer.id} bookingId={booking.id} payments={booking.payments} />
          </SectionCard>

          <SectionCard title="Activity">
            <ActivityTimeline activities={booking.activities} />
          </SectionCard>
        </div>

        <div className="space-y-5">
          <SectionCard title="Vehicle &amp; Chauffeur">
            <div className="space-y-3">
              <div>
                <p className="label">Vehicle</p>
                <VehicleAssignControl bookingId={booking.id} vehicleId={booking.vehicleId} vehicles={vehicles} />
              </div>
              <div>
                <p className="label">Chauffeur</p>
                <DriverAssignControl bookingId={booking.id} driverId={booking.driverId} drivers={drivers} />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Pricing Breakdown">
            <dl className="space-y-1.5 text-[13px]">
              <Row label="Base Rate" value={formatCurrency(booking.baseRate)} />
              <Row label="Chauffeur Fee" value={formatCurrency(booking.driverFee)} />
              <Row label="Mileage Fee" value={formatCurrency(booking.mileageFee)} />
              <Row label="Additional Fees" value={formatCurrency(booking.additionalFees)} />
              {booking.discount > 0 && <Row label="Discount" value={`-${formatCurrency(booking.discount)}`} />}
              <Row label="Tax" value={formatCurrency(booking.taxAmount)} />
              <div className="divider !my-2" />
              <Row label="Total" value={formatCurrency(booking.totalPrice)} bold />
            </dl>
          </SectionCard>

          <SectionCard title="Tasks">
            {booking.tasks.length === 0 ? <EmptyRow>No tasks linked.</EmptyRow> : (
              <ul className="space-y-2">
                {booking.tasks.map((t) => (
                  <li key={t.id} className="rounded-lg border border-[var(--border)] px-3 py-2 text-[12.5px]">
                    <p className="font-medium text-[var(--text)]">{t.title}</p>
                    <p className="text-[11px] text-[var(--text-faint)]">Due {formatDate(t.dueDate)}</p>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function Info({ icon: Icon, label, value }: { icon?: React.ComponentType<{ size?: number; className?: string }>; label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start gap-2">
      {Icon && <Icon size={13} className="mt-0.5 shrink-0 text-[var(--text-faint)]" />}
      <div className="min-w-0">
        <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">{label}</dt>
        <dd className="truncate text-[var(--text)]">{value || "—"}</dd>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${bold ? "font-semibold text-[var(--text)]" : "text-[var(--text-muted)]"}`}>
      <span>{label}</span>
      <span className={bold ? "text-[var(--text)]" : ""}>{value}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="font-display text-xl font-medium text-[var(--text)]">{value}</p>
      <p className="mt-0.5 text-[11px] font-medium text-[var(--text-muted)]">{label}</p>
    </div>
  );
}
