import Link from "next/link";
import { requireScope } from "@/lib/queries/scope";
import { getReactivationCandidates } from "@/lib/queries/lostReactivation";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { ReactivateButton } from "@/components/reactivation/ReactivateButton";
import { formatTimeAgo } from "@/lib/format";
import { REACTIVATION_WINDOWS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export default async function ReactivationPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const sp = await searchParams;
  const days = sp.days ? Number(sp.days) : 30;
  const scope = await requireScope();
  const { lost, stale } = await getReactivationCandidates(scope, days);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text)]">Reactivation</h1>
        <p className="text-[13px] text-[var(--text-muted)]">Old leads and lost customers worth another look — one click puts them back into an active follow-up sequence.</p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {REACTIVATION_WINDOWS.map((w) => (
          <Link key={w.value} href={`/reactivation?days=${w.value}`} className={cn("badge", String(days) === w.value ? "bg-[var(--brand)] text-white" : "badge-neutral")}>{w.label}+</Link>
        ))}
      </div>

      <section className="space-y-2.5">
        <h2 className="text-[13px] font-semibold text-[var(--text-muted)]">Lost Leads ({lost.length})</h2>
        {lost.length === 0 && <div className="card p-6 text-center text-sm text-[var(--text-muted)]">No lost leads in this window.</div>}
        {lost.map((lead) => {
          const vi = lead.vehicleInterests[0];
          const vehicleLabel = vi ? (vi.vehicle ? `${vi.vehicle.year} ${vi.vehicle.make} ${vi.vehicle.model}` : [vi.year, vi.make, vi.model].filter(Boolean).join(" ")) : null;
          return (
            <div key={lead.id} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <Avatar firstName={lead.customer.firstName} lastName={lead.customer.lastName} />
                <div>
                  <Link href={`/customers/${lead.customerId}`} className="text-[13.5px] font-semibold text-[var(--text)] hover:text-[var(--brand)]">{lead.customer.firstName} {lead.customer.lastName}</Link>
                  <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">{vehicleLabel ?? "No vehicle noted"}</p>
                  <p className="mt-0.5 text-[11.5px] text-[var(--text-faint)]">Lost {lead.lostAt ? formatTimeAgo(lead.lostAt) : ""}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="lost">{lead.lostReason?.name ?? "Unspecified"}</Badge>
                <ReactivateButton leadId={lead.id} />
              </div>
            </div>
          );
        })}
      </section>

      <section className="space-y-2.5">
        <h2 className="text-[13px] font-semibold text-[var(--text-muted)]">Gone Quiet — Still Active ({stale.length})</h2>
        {stale.length === 0 && <div className="card p-6 text-center text-sm text-[var(--text-muted)]">No stale active leads in this window.</div>}
        {stale.map((lead) => {
          const vi = lead.vehicleInterests[0];
          const vehicleLabel = vi ? (vi.vehicle ? `${vi.vehicle.year} ${vi.vehicle.make} ${vi.vehicle.model}` : [vi.year, vi.make, vi.model].filter(Boolean).join(" ")) : null;
          return (
            <div key={lead.id} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <Avatar firstName={lead.customer.firstName} lastName={lead.customer.lastName} />
                <div>
                  <Link href={`/customers/${lead.customerId}`} className="text-[13.5px] font-semibold text-[var(--text)] hover:text-[var(--brand)]">{lead.customer.firstName} {lead.customer.lastName}</Link>
                  <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">{vehicleLabel ?? "No vehicle noted"}</p>
                  <p className="mt-0.5 text-[11.5px] text-[var(--text-faint)]">{lead.lastContactedAt ? `Last contact ${formatTimeAgo(lead.lastContactedAt)}` : "Never contacted"}</p>
                </div>
              </div>
              <Link href={`/customers/${lead.customerId}`} className="btn btn-secondary btn-sm">View Profile</Link>
            </div>
          );
        })}
      </section>
    </div>
  );
}
