import Link from "next/link";
import { requireScope } from "@/lib/queries/scope";
import { listLostLeads } from "@/lib/queries/lostReactivation";
import { prisma } from "@/lib/prisma";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { ReactivateButton } from "@/components/reactivation/ReactivateButton";
import { formatTimeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

export default async function LostLeadsPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const sp = await searchParams;
  const scope = await requireScope();
  const [leads, lostReasons] = await Promise.all([
    listLostLeads(scope, { lostReasonId: sp.reason }),
    prisma.lostReason.findMany({ orderBy: { order: "asc" } }),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text)]">Lost Leads</h1>
        <p className="text-[13px] text-[var(--text-muted)]">{leads.length} lost lead{leads.length === 1 ? "" : "s"} · nothing is ever deleted — reactivate anytime.</p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Link href="/lost-leads" className={cn("badge", !sp.reason ? "bg-[var(--brand)] text-white" : "badge-neutral")}>All</Link>
        {lostReasons.map((r) => (
          <Link key={r.id} href={`/lost-leads?reason=${r.id}`} className={cn("badge", sp.reason === r.id ? "bg-[var(--brand)] text-white" : "badge-neutral")}>{r.name}</Link>
        ))}
      </div>

      <div className="space-y-2.5">
        {leads.length === 0 && <div className="card p-10 text-center text-sm text-[var(--text-muted)]">No lost leads match this filter.</div>}
        {leads.map((lead) => {
          const vi = lead.vehicleInterests[0];
          const vehicleLabel = vi ? (vi.vehicle ? `${vi.vehicle.year} ${vi.vehicle.make} ${vi.vehicle.model}` : [vi.year, vi.make, vi.model].filter(Boolean).join(" ")) : null;
          return (
            <div key={lead.id} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <Avatar firstName={lead.customer.firstName} lastName={lead.customer.lastName} />
                <div>
                  <Link href={`/customers/${lead.customerId}`} className="text-[13.5px] font-semibold text-[var(--text)] hover:text-[var(--brand)]">
                    {lead.customer.firstName} {lead.customer.lastName}
                  </Link>
                  <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">{vehicleLabel ?? "No vehicle noted"}</p>
                  <p className="mt-0.5 text-[11.5px] text-[var(--text-faint)]">Lost {lead.lostAt ? formatTimeAgo(lead.lostAt) : ""}{lead.lostNotes ? ` · ${lead.lostNotes}` : ""}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="lost">{lead.lostReason?.name ?? "Unspecified"}</Badge>
                <ReactivateButton leadId={lead.id} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
