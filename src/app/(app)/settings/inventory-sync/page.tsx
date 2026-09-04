import { redirect } from "next/navigation";
import Link from "next/link";
import { requireScope } from "@/lib/queries/scope";
import { prisma } from "@/lib/prisma";
import { SettingsShell } from "@/components/settings/SettingsShell";
import { InventorySyncPanel } from "@/components/settings/InventorySyncPanel";
import { CsvImportPanel } from "@/components/settings/CsvImportPanel";
import { Badge } from "@/components/ui/Badge";
import { formatTimeAgo, formatDateTime } from "@/lib/format";

export default async function InventorySyncPage() {
  const scope = await requireScope();
  if (scope.role === "SALESPERSON") redirect("/settings");

  const [lastRun, recentRuns, counts, flagged] = await Promise.all([
    prisma.inventorySyncRun.findFirst({ where: { status: "SUCCESS" }, orderBy: { startedAt: "desc" } }),
    prisma.inventorySyncRun.findMany({ orderBy: { startedAt: "desc" }, take: 10 }),
    prisma.vehicle.groupBy({ by: ["source", "status"], _count: true }),
    prisma.vehicle.findMany({ where: { syncStatus: "NEEDS_REVIEW" }, orderBy: { updatedAt: "desc" }, take: 20 }),
  ]);

  const synced = counts.filter((c) => c.source === "AUTOMAXLV");
  const available = synced.filter((c) => c.status === "AVAILABLE").reduce((s, c) => s + c._count, 0);
  const unavailable = synced.filter((c) => c.status !== "AVAILABLE").reduce((s, c) => s + c._count, 0);

  return (
    <SettingsShell
      isAdmin={scope.role === "ADMIN"}
      title="Inventory Sync"
      subtitle="Vehicle inventory is AutoMax LV's — the only source of truth for what's available to test drive. See src/lib/inventory/ in the codebase for how this works."
    >
      <div className="card space-y-4 p-5">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Available" value={available} />
          <Stat label="Unavailable / Sold" value={unavailable} />
          <Stat label="Flagged for review" value={flagged.length} />
          <Stat label="Last synced" value={lastRun ? formatTimeAgo(lastRun.startedAt) : "Never"} small />
        </div>
      </div>

      <div className="card space-y-3 p-5">
        <div>
          <p className="text-[13px] font-semibold text-[var(--text)]">Upload Inventory <span className="text-[var(--brand)]">(Recommended)</span></p>
          <p className="mt-1 text-[12.5px] text-[var(--text-muted)]">
            automaxlv.com blocks automated access (Cloudflare bot protection returns a &ldquo;security verification&rdquo; page instead of vehicle data,
            confirmed from production logs) — uploading your own export is the reliable way to keep inventory current.
          </p>
        </div>
        <CsvImportPanel />
      </div>

      <div className="card space-y-3 p-5">
        <div>
          <p className="text-[13px] font-semibold text-[var(--text)]">Automatic Sync from automaxlv.com</p>
          <p className="mt-1 text-[12.5px] text-[var(--text-muted)]">
            Attempts a live scrape of the site. Currently blocked by the site&rsquo;s bot protection (see above) — kept in case that changes; use the
            upload above in the meantime.
          </p>
        </div>
        <InventorySyncPanel />
      </div>

      {flagged.length > 0 && (
        <div className="card p-5">
          <p className="mb-3 text-[13px] font-semibold text-[var(--text)]">Flagged for review ({flagged.length})</p>
          <p className="mb-3 text-[12.5px] text-[var(--text-muted)]">
            These listings couldn&rsquo;t be confidently read from the site (missing year/make/model, VIN, or stock #). Nothing was guessed — check them manually on{" "}
            <a href="https://www.automaxlv.com/inventory/" target="_blank" rel="noreferrer" className="text-[var(--brand)] underline">automaxlv.com</a> and edit the record if needed.
          </p>
          <div className="space-y-2">
            {flagged.map((v) => (
              <Link key={v.id} href={`/vehicles/${v.id}`} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 hover:bg-[var(--bg-subtle)]">
                <span className="text-[13px] font-medium text-[var(--text)]">
                  {v.year} {v.make} {v.model} {v.trim ?? ""} <span className="text-[var(--text-faint)]">· Stock {v.stockNumber}</span>
                </span>
                <Badge variant="warm">Needs Review</Badge>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="card p-5">
        <p className="mb-3 text-[13px] font-semibold text-[var(--text)]">Recent sync runs</p>
        <div className="space-y-2">
          {recentRuns.length === 0 && <p className="text-[12.5px] text-[var(--text-faint)]">No sync runs yet.</p>}
          {recentRuns.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-[12.5px]">
              <div className="flex items-center gap-2">
                <Badge variant={r.status === "SUCCESS" ? "sold" : r.status === "FAILED" ? "lost" : "neutral"}>{r.status}</Badge>
                <span className="text-[var(--text-muted)]">{r.trigger === "MANUAL" ? "Manual" : "Scheduled"}</span>
              </div>
              <div className="text-right text-[var(--text-faint)]">
                {r.status === "SUCCESS" && <span>{r.vehiclesCreated} new · {r.vehiclesUpdated} updated · {r.vehiclesRetired} retired</span>}
                {r.status === "FAILED" && <span className="text-red-600">{r.errorMessage}</span>}
                <span className="ml-2">{formatDateTime(r.startedAt)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </SettingsShell>
  );
}

function Stat({ label, value, small }: { label: string; value: string | number; small?: boolean }) {
  return (
    <div className="rounded-lg border border-[var(--border)] p-3">
      <p className={small ? "text-[15px] font-bold text-[var(--text)]" : "text-2xl font-bold text-[var(--text)]"}>{value}</p>
      <p className="text-[11.5px] text-[var(--text-muted)]">{label}</p>
    </div>
  );
}
