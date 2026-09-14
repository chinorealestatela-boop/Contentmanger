import { requireScope } from "@/lib/queries/scope";
import { getDriverProfileForUser, getDriverTripsToday, getDriverUpcomingTrips } from "@/lib/queries/drivers";
import { TripCard } from "@/components/driver/TripCard";
import { DriverStatusControl } from "@/components/drivers/DriverStatusControl";
import { formatDate, fullName } from "@/lib/format";
import { Route } from "lucide-react";

export default async function DriverConsolePage() {
  const scope = await requireScope();
  const driver = await getDriverProfileForUser(scope.userId);

  if (!driver) {
    return (
      <div className="mx-auto max-w-lg p-6 text-center">
        <Route className="mx-auto mb-3 text-[var(--text-faint)]" size={28} />
        <h1 className="font-display text-2xl font-medium text-[var(--text)]">No chauffeur profile linked</h1>
        <p className="mt-2 text-[13px] text-[var(--text-muted)]">Ask an admin to link your account to a chauffeur profile in Settings → Employees.</p>
      </div>
    );
  }

  const [todaysTrips, upcoming] = await Promise.all([getDriverTripsToday(driver.id), getDriverUpcomingTrips(driver.id)]);

  return (
    <div className="mx-auto max-w-xl space-y-5 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">Welcome back</p>
          <h1 className="font-display text-2xl font-medium text-[var(--text)]">{fullName(driver)}</h1>
        </div>
        <DriverStatusControl driverId={driver.id} status={driver.status} />
      </div>

      <div>
        <h2 className="mb-2.5 text-[12px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Today&rsquo;s Trips — {formatDate(new Date(), "EEEE, MMM d")}</h2>
        {todaysTrips.length === 0 ? (
          <div className="card p-8 text-center text-[13px] text-[var(--text-muted)]">No trips assigned to you today.</div>
        ) : (
          <div className="space-y-3">
            {todaysTrips.map((t) => (
              <TripCard key={t.id} trip={t} />
            ))}
          </div>
        )}
      </div>

      {upcoming.length > 0 && (
        <div>
          <h2 className="mb-2.5 text-[12px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Upcoming</h2>
          <div className="space-y-2">
            {upcoming.map((t) => (
              <div key={t.id} className="card flex items-center justify-between p-3.5">
                <div>
                  <p className="text-[13px] font-medium text-[var(--text)]">{fullName(t.customer)}</p>
                  <p className="text-[11.5px] text-[var(--text-faint)]">{formatDate(t.date)} · {t.pickupAddress}</p>
                </div>
                <span className="text-[12px] text-[var(--text-muted)]">{t.vehicle?.name ?? ""}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
