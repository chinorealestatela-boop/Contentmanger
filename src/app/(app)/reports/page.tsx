import Link from "next/link";
import { requireScope } from "@/lib/queries/scope";
import { getReportsData } from "@/lib/queries/reports";
import { ReportStat } from "@/components/reports/ReportStat";
import { SingleSeriesBarChart, CategoricalBarChart } from "@/components/reports/Charts";
import { SectionCard } from "@/components/ui/SectionCard";
import { formatCurrency } from "@/lib/format";
import { DEFAULT_LEAD_SOURCES, DEFAULT_LOST_REASONS } from "@/lib/constants";
import { cn } from "@/lib/utils";

const RANGES = [
  { key: "7", label: "7 Days" },
  { key: "30", label: "30 Days" },
  { key: "90", label: "90 Days" },
  { key: "365", label: "12 Months" },
  { key: "3650", label: "All Time" },
];

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const sp = await searchParams;
  const rangeDays = sp.range ? Number(sp.range) : 30;
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - rangeDays);

  const scope = await requireScope();
  const data = await getReportsData(scope, from, to);

  const vehicleNames = data.salesByVehicle.map((v) => v.name);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text)]">Reports</h1>
          <p className="text-[13px] text-[var(--text-muted)]">Performance over the last {rangeDays >= 3650 ? "all time" : `${rangeDays} days`}.</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {RANGES.map((r) => (
            <Link key={r.key} href={`/reports?range=${r.key}`} className={cn("badge", String(rangeDays) === r.key ? "bg-[var(--brand)] text-white" : "badge-neutral")}>{r.label}</Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <ReportStat label="Leads" value={String(data.leadsCount)} />
        <ReportStat label="Contact Rate" value={`${data.contactRate}%`} sublabel={`${data.contactedCount} contacted`} />
        <ReportStat label="Appointments" value={String(data.appointmentsCount)} />
        <ReportStat label="Show Rate" value={`${data.showRate}%`} sublabel={`${data.showed} showed / ${data.noShow} no-show`} />
        <ReportStat label="Test Drives" value={String(data.testDrivesCount)} />
        <ReportStat label="Credit Applications" value={String(data.creditAppsCount)} />
        <ReportStat label="Sales" value={String(data.salesCount)} sublabel={formatCurrency(data.totalRevenue)} />
        <ReportStat label="Close Rate" value={`${data.closeRate}%`} />
        <ReportStat label="Lost Leads" value={String(data.lostCount)} />
        <ReportStat label="Follow-Up Completion" value={`${data.followUpCompletionRate}%`} sublabel={`${data.completedTasks}/${data.relevantTasks} tasks`} />
        <ReportStat label="Avg Response Time" value={data.avgResponseHours !== null ? (data.avgResponseHours < 1 ? `${Math.round(data.avgResponseHours * 60)}m` : `${data.avgResponseHours.toFixed(1)}h`) : "—"} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <SectionCard title="Pipeline Funnel">
          <SingleSeriesBarChart data={data.stageFunnelChart} xKey="name" yKey="count" horizontal />
        </SectionCard>

        <SectionCard title="Leads by Source">
          <CategoricalBarChart data={data.leadsBySource} xKey="name" yKey="count" knownOrder={DEFAULT_LEAD_SOURCES} />
        </SectionCard>

        <SectionCard title="Sales by Lead Source">
          <CategoricalBarChart data={data.salesBySource} xKey="name" yKey="revenue" knownOrder={DEFAULT_LEAD_SOURCES} valueFormat="currency" />
        </SectionCard>

        <SectionCard title="Sales by Vehicle">
          <CategoricalBarChart data={data.salesByVehicle} xKey="name" yKey="revenue" knownOrder={vehicleNames} valueFormat="currency" />
        </SectionCard>

        <SectionCard title="Lost Reasons">
          <CategoricalBarChart data={data.lostReasonChart} xKey="name" yKey="count" knownOrder={DEFAULT_LOST_REASONS} />
        </SectionCard>
      </div>
    </div>
  );
}
