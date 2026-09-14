import Link from "next/link";
import { requireScope } from "@/lib/queries/scope";
import { getAnalyticsData } from "@/lib/queries/analytics";
import { ReportStat } from "@/components/reports/ReportStat";
import { CategoricalBarChart, TrendAreaChart } from "@/components/reports/Charts";
import { SectionCard } from "@/components/ui/SectionCard";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

const RANGES = [
  { key: "7", label: "7 Days" },
  { key: "30", label: "30 Days" },
  { key: "90", label: "90 Days" },
  { key: "365", label: "12 Months" },
];

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const sp = await searchParams;
  const rangeDays = sp.range ? Number(sp.range) : 30;
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - rangeDays);

  const scope = await requireScope();
  const data = await getAnalyticsData(scope, from, to);

  const vehicleNames = data.revenueByVehicle.map((v) => v.name);
  const serviceNames = data.revenueByService.map((v) => v.name);
  const driverNames = data.revenueByDriver.map((v) => v.name);
  const sourceNames = data.leadsBySource.map((v) => v.name);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium text-[var(--text)]">Analytics</h1>
          <p className="text-[13px] text-[var(--text-muted)]">The executive view of Stratos Exotics performance.</p>
        </div>
        <div className="flex gap-1.5 rounded-lg border border-[var(--border)] bg-white/[0.02] p-1">
          {RANGES.map((r) => (
            <Link key={r.key} href={`/analytics?range=${r.key}`} className={cn("rounded-md px-3 py-1.5 text-[12.5px] font-medium", rangeDays === Number(r.key) ? "bg-[var(--brand)] text-[#14120a]" : "text-[var(--text-muted)] hover:bg-white/[0.05]")}>
              {r.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ReportStat label="Revenue" value={formatCurrency(data.totalRevenue)} />
        <ReportStat label="Bookings" value={String(data.bookingsCount)} />
        <ReportStat label="Leads" value={String(data.leadsCount)} sublabel={`${data.vipLeadsCount} VIP`} />
        <ReportStat label="Conversion Rate" value={`${data.conversionRate}%`} sublabel="Lead → Booking" />
        <ReportStat label="Avg Booking Value" value={formatCurrency(data.avgBookingValue)} />
        <ReportStat label="Cancellation Rate" value={`${data.cancellationRate}%`} />
        <ReportStat label="Repeat Customers" value={String(data.repeatCustomers)} />
        <ReportStat label="Fleet Utilization" value={`${data.fleetUtilization}%`} />
      </div>

      <SectionCard title="Revenue Trend">
        <TrendAreaChart data={data.revenueTrend} xKey="date" yKey="revenue" valueFormat="currency" />
      </SectionCard>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <SectionCard title="Revenue by Vehicle">
          <CategoricalBarChart data={data.revenueByVehicle} xKey="name" yKey="revenue" knownOrder={vehicleNames} valueFormat="currency" />
        </SectionCard>
        <SectionCard title="Revenue by Service">
          <CategoricalBarChart data={data.revenueByService} xKey="name" yKey="revenue" knownOrder={serviceNames} valueFormat="currency" />
        </SectionCard>
        <SectionCard title="Revenue by Chauffeur">
          <CategoricalBarChart data={data.revenueByDriver} xKey="name" yKey="revenue" knownOrder={driverNames} valueFormat="currency" />
        </SectionCard>
        <SectionCard title="Leads by Source">
          <CategoricalBarChart data={data.leadsBySource} xKey="name" yKey="count" knownOrder={sourceNames} />
        </SectionCard>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <ReportStat label="VIP / VVIP Clients" value={String(data.vipCustomers)} />
        <ReportStat label="Fleet Size" value={String(data.fleetSize)} sublabel="Active vehicles" />
        <ReportStat label="Chauffeurs Earning" value={String(driverNames.length)} />
      </div>
    </div>
  );
}
