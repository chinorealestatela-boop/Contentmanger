import Link from "next/link";
import { AlertTriangle, CalendarClock, Clock, Settings, DollarSign, CheckCircle2, ListFilter } from "lucide-react";
import { requireScope } from "@/lib/queries/scope";
import { getPaymentDashboardData, type PaymentListItem } from "@/lib/queries/payments";
import { PaymentRow } from "@/components/payments/PaymentRow";
import { formatCurrency } from "@/lib/format";
import { PAYMENT_STATUS_OPTIONS, getPaymentDisplayStatus } from "@/lib/payments/status";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Payments | CRM" };

const RANGE_LABELS: Record<string, string> = { "7": "Next 7 Days", "30": "Next 30 Days", "60": "Next 60 Days", "90": "Next 90 Days" };

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ range?: string; status?: string; customer?: string; salesperson?: string }> }) {
  const sp = await searchParams;
  const scope = await requireScope();
  const [data, users] = await Promise.all([
    getPaymentDashboardData(scope),
    prisma.user.findMany({ where: { isActive: true }, orderBy: { firstName: "asc" } }),
  ]);

  const range = sp.range && ["7", "30", "60", "90"].includes(sp.range) ? sp.range : "7";
  const upcoming: PaymentListItem[] = { "7": data.upcoming7, "30": data.upcoming30, "60": data.upcoming60, "90": data.upcoming90 }[range]!;

  const hasFilters = !!(sp.status || sp.customer || sp.salesperson);
  const filtered = hasFilters
    ? data.all.filter((p) => {
        if (sp.status && getPaymentDisplayStatus(p) !== sp.status) return false;
        if (sp.customer && !p.customerName.toLowerCase().includes(sp.customer.toLowerCase())) return false;
        if (sp.salesperson && p.salespersonId !== sp.salesperson) return false;
        return true;
      })
    : [];

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text)]">Payments</h1>
          <p className="text-[13.5px] text-[var(--text-muted)]">Every scheduled down-payment installment still owed, across your book.</p>
        </div>
        <Link href="/payments/settings" className="btn btn-secondary btn-sm"><Settings size={13} /> Automation &amp; Templates</Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card flex items-center gap-3 p-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]"><DollarSign size={18} /></div>
          <div><p className="text-xl font-bold text-[var(--text)] tabular-nums">{formatCurrency(data.totalOwed)}</p><p className="text-[11.5px] font-medium text-[var(--text-muted)]">Total Outstanding</p></div>
        </div>
        <div className="card flex items-center gap-3 p-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><CheckCircle2 size={18} /></div>
          <div><p className="text-xl font-bold text-[var(--text)] tabular-nums">{formatCurrency(data.totalCollected)}</p><p className="text-[11.5px] font-medium text-[var(--text-muted)]">Total Collected</p></div>
        </div>
        <div className="card flex items-center gap-3 p-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700"><Clock size={18} /></div>
          <div><p className="text-xl font-bold text-[var(--text)] tabular-nums">{data.dueToday.length}</p><p className="text-[11.5px] font-medium text-[var(--text-muted)]">Due Today</p></div>
        </div>
        <div className="card flex items-center gap-3 p-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-700"><AlertTriangle size={18} /></div>
          <div><p className="text-xl font-bold text-[var(--text)] tabular-nums">{data.overdue.length}</p><p className="text-[11.5px] font-medium text-[var(--text-muted)]">Late ({formatCurrency(data.overdueTotal)})</p></div>
        </div>
        <div className="card flex items-center gap-3 p-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700"><Clock size={18} /></div>
          <div><p className="text-xl font-bold text-[var(--text)] tabular-nums">{data.dueTomorrow.length}</p><p className="text-[11.5px] font-medium text-[var(--text-muted)]">Due Tomorrow</p></div>
        </div>
        <div className="card flex items-center gap-3 p-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-700"><Clock size={18} /></div>
          <div><p className="text-xl font-bold text-[var(--text)] tabular-nums">{data.due3Days.length}</p><p className="text-[11.5px] font-medium text-[var(--text-muted)]">Due in 3 Days</p></div>
        </div>
        <div className="card flex items-center gap-3 p-3.5 sm:col-span-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-subtle)] text-[var(--text-muted)]"><DollarSign size={18} /></div>
          <div><p className="text-xl font-bold text-[var(--text)] tabular-nums">{data.totalScheduled}</p><p className="text-[11.5px] font-medium text-[var(--text-muted)]">Total Scheduled Payments</p></div>
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
            <div className="flex items-center gap-1.5"><AlertTriangle size={16} className="text-red-600" /><h2 className="text-[15px] font-semibold text-red-900">Late</h2></div>
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

      <section className="card">
        <div className="flex items-center gap-1.5 border-b border-[var(--border)] px-5 py-4">
          <ListFilter size={16} className="text-[var(--text-muted)]" />
          <h2 className="text-[15px] font-semibold text-[var(--text)]">Search &amp; Filter</h2>
        </div>
        <form className="grid grid-cols-1 gap-3 border-b border-[var(--border)] p-4 sm:grid-cols-4" action="/payments">
          <input name="customer" defaultValue={sp.customer} placeholder="Customer name…" className="input" />
          <select name="status" defaultValue={sp.status ?? ""} className="input">
            <option value="">Any status</option>
            <option value="UPCOMING">Upcoming</option>
            <option value="DUE_SOON">Due Soon</option>
            <option value="DUE_TODAY">Due Today</option>
            {PAYMENT_STATUS_OPTIONS.filter((s) => s.value !== "PENDING").map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select name="salesperson" defaultValue={sp.salesperson ?? ""} className="input">
            <option value="">Any salesperson</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
          </select>
          <button type="submit" className="btn btn-primary">Filter</button>
        </form>
        <div className="divide-y divide-[var(--border)]">
          {!hasFilters && <p className="px-5 py-8 text-center text-sm text-[var(--text-muted)]">Use the filters above to search every scheduled payment by status, customer, or salesperson.</p>}
          {hasFilters && filtered.length === 0 && <p className="px-5 py-8 text-center text-sm text-[var(--text-muted)]">No payments match those filters.</p>}
          {filtered.map((item) => <PaymentRow key={item.id} item={item} />)}
        </div>
      </section>
    </div>
  );
}
