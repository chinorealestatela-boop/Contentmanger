import Link from "next/link";
import { AlertTriangle, CalendarClock, Clock, Settings, DollarSign } from "lucide-react";
import { requireScope } from "@/lib/queries/scope";
import { getPaymentDashboardData, type PaymentListItem } from "@/lib/queries/payments";
import { PaymentRow } from "@/components/payments/PaymentRow";
import { formatCurrency } from "@/lib/format";

export const metadata = { title: "Payments | CRM" };

const RANGE_LABELS: Record<string, string> = { "7": "Next 7 Days", "30": "Next 30 Days", "60": "Next 60 Days", "90": "Next 90 Days" };

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const sp = await searchParams;
  const scope = await requireScope();
  const data = await getPaymentDashboardData(scope);

  const range = sp.range && ["7", "30", "60", "90"].includes(sp.range) ? sp.range : "7";
  const upcoming: PaymentListItem[] = { "7": data.upcoming7, "30": data.upcoming30, "60": data.upcoming60, "90": data.upcoming90 }[range]!;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text)]">Payments</h1>
          <p className="text-[13.5px] text-[var(--text-muted)]">Every future down-payment installment still owed, across your book.</p>
        </div>
        <Link href="/payments/settings" className="btn btn-secondary btn-sm"><Settings size={13} /> Automation &amp; Templates</Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="card flex items-center gap-3 p-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]"><DollarSign size={18} /></div>
          <div><p className="text-xl font-bold text-[var(--text)] tabular-nums">{formatCurrency(data.totalOwed)}</p><p className="text-[11.5px] font-medium text-[var(--text-muted)]">Total Outstanding</p></div>
        </div>
        <div className="card flex items-center gap-3 p-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700"><Clock size={18} /></div>
          <div><p className="text-xl font-bold text-[var(--text)] tabular-nums">{data.dueToday.length}</p><p className="text-[11.5px] font-medium text-[var(--text-muted)]">Due Today</p></div>
        </div>
        <div className="card flex items-center gap-3 p-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-700"><AlertTriangle size={18} /></div>
          <div><p className="text-xl font-bold text-[var(--text)] tabular-nums">{data.overdue.length}</p><p className="text-[11.5px] font-medium text-[var(--text-muted)]">Overdue ({formatCurrency(data.overdueTotal)})</p></div>
        </div>
      </div>

      <section className="card">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div className="flex items-center gap-1.5"><Clock size={16} className="text-amber-600" /><h2 className="text-[15px] font-semibold text-[var(--text)]">Today&rsquo;s Payments</h2></div>
          <span className="badge bg-amber-100 text-amber-800">{data.dueToday.length}</span>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {data.dueToday.length === 0 && <p className="px-5 py-8 text-center text-sm text-[var(--text-muted)]">Nothing due today.</p>}
          {data.dueToday.map((item) => <PaymentRow key={item.id} item={item} />)}
        </div>
      </section>

      {data.overdue.length > 0 && (
        <section className="card border-red-200">
          <div className="flex items-center justify-between border-b border-red-200 bg-red-50 px-5 py-4">
            <div className="flex items-center gap-1.5"><AlertTriangle size={16} className="text-red-600" /><h2 className="text-[15px] font-semibold text-red-900">Overdue</h2></div>
            <span className="badge bg-red-100 text-red-800">{data.overdue.length}</span>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {data.overdue.map((item) => <PaymentRow key={item.id} item={item} />)}
          </div>
        </section>
      )}

      <section className="card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-5 py-4">
          <div className="flex items-center gap-1.5"><CalendarClock size={16} className="text-[var(--appointment)]" /><h2 className="text-[15px] font-semibold text-[var(--text)]">Upcoming Payments</h2></div>
          <div className="flex gap-1">
            {Object.entries(RANGE_LABELS).map(([value, label]) => (
              <Link key={value} href={`/payments?range=${value}`} className={`rounded-lg px-2.5 py-1 text-[11.5px] font-semibold ${range === value ? "bg-[var(--brand)] text-white" : "bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:bg-[var(--border)]"}`}>
                {label.replace("Next ", "")}
              </Link>
            ))}
          </div>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {upcoming.length === 0 && <p className="px-5 py-8 text-center text-sm text-[var(--text-muted)]">No payments due in this window.</p>}
          {upcoming.map((item) => <PaymentRow key={item.id} item={item} />)}
        </div>
      </section>
    </div>
  );
}
