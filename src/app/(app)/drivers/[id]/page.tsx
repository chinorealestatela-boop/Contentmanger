import { notFound } from "next/navigation";
import Link from "next/link";
import { Star, Car } from "lucide-react";
import { getDriverDetail } from "@/lib/queries/drivers";
import { Avatar } from "@/components/ui/Avatar";
import { SectionCard, EmptyRow } from "@/components/ui/SectionCard";
import { StatusBadge } from "@/components/ui/Badge";
import { DriverStatusControl } from "@/components/drivers/DriverStatusControl";
import { formatDate, formatTime12h, fullName } from "@/lib/format";
import { BOOKING_STATUSES } from "@/lib/constants";

export default async function DriverDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const driver = await getDriverDetail(id);
  if (!driver) notFound();

  const certifications: string[] = driver.certifications ? JSON.parse(driver.certifications) : [];

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6 lg:p-8">
      <div className="card p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <Avatar firstName={driver.firstName} lastName={driver.lastName} size="lg" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-medium text-[var(--text)]">{fullName(driver)}</h1>
                <DriverStatusControl driverId={driver.id} status={driver.status} />
              </div>
              <p className="mt-1 text-[13px] text-[var(--text-muted)]">{driver.phone ?? "No phone"} {driver.email ? `· ${driver.email}` : ""}</p>
              <div className="mt-2 flex items-center gap-3 text-[12.5px] text-[var(--text-faint)]">
                <span className="flex items-center gap-1"><Star size={12} className="text-[var(--brand-bright)]" fill="currentColor" /> {driver.rating?.toFixed(2) ?? "—"} rating</span>
                <span>{driver.completedTrips} completed trips</span>
              </div>
            </div>
          </div>
          <Link href={`/drivers/${driver.id}/edit`} className="text-xs font-semibold text-[var(--brand-bright)] hover:underline">Edit Chauffeur</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <SectionCard title="Trips">
            {driver.bookings.length === 0 ? (
              <EmptyRow>No trips assigned yet.</EmptyRow>
            ) : (
              <ul className="space-y-2">
                {driver.bookings.map((b) => (
                  <li key={b.id}>
                    <Link href={`/bookings/${b.id}`} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3.5 py-2.5 hover:bg-white/[0.03]">
                      <div>
                        <p className="text-[13px] font-medium text-[var(--text)]">{fullName(b.customer)} · {b.vehicle?.name ?? "Vehicle TBD"}</p>
                        <p className="text-[11.5px] text-[var(--text-faint)]">{formatDate(b.date)} at {formatTime12h(b.pickupTime)}</p>
                      </div>
                      <StatusBadge options={BOOKING_STATUSES} value={b.bookingStatus} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        <div className="space-y-5">
          <SectionCard title="License &amp; Certifications">
            <p className="text-[13px] text-[var(--text)]">{driver.licenseNumber ?? "No license on file"}</p>
            {driver.licenseExpiresAt && <p className="mt-1 text-[11.5px] text-[var(--text-faint)]">Expires {formatDate(driver.licenseExpiresAt)}</p>}
            {certifications.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {certifications.map((c) => <li key={c} className="badge badge-neutral">{c}</li>)}
              </ul>
            )}
          </SectionCard>

          {driver.assignedVehicles.length > 0 && (
            <SectionCard title="Assigned Vehicle">
              <ul className="space-y-1.5">
                {driver.assignedVehicles.map((v) => (
                  <li key={v.id}><Link href={`/fleet/${v.id}`} className="flex items-center gap-1.5 text-[13px] text-[var(--text)] hover:text-[var(--brand-bright)]"><Car size={13} /> {v.name}</Link></li>
                ))}
              </ul>
            </SectionCard>
          )}

          {driver.notes && (
            <SectionCard title="Notes">
              <p className="whitespace-pre-wrap text-[13px] text-[var(--text)]">{driver.notes}</p>
            </SectionCard>
          )}
        </div>
      </div>
    </div>
  );
}
