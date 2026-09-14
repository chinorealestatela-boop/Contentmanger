import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/ui/Badge";
import { PAYMENT_RECORD_STATUSES, PAYMENT_TYPES, optionLabel } from "@/lib/constants";
import { formatCurrency, formatDateTime, fullName } from "@/lib/format";
import { CreditCard, Wallet, AlertTriangle, CheckCircle2 } from "lucide-react";

export default async function PaymentsPage() {
  const [payments, outstandingBookings, totals] = await Promise.all([
    prisma.payment.findMany({ include: { customer: true, booking: true }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.booking.findMany({ where: { remainingBalance: { gt: 0 }, bookingStatus: { notIn: ["CANCELLED"] } }, include: { customer: true }, orderBy: { date: "asc" }, take: 20 }),
    prisma.payment.aggregate({ where: { status: "SUCCEEDED" }, _sum: { amount: true } }),
  ]);

  const failedCount = payments.filter((p) => p.status === "FAILED").length;
  const outstandingTotal = outstandingBookings.reduce((s, b) => s + b.remainingBalance, 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="font-display text-3xl font-medium text-[var(--text)]">Payments</h1>
        <p className="text-[13px] text-[var(--text-muted)]">Deposits, balances, and refunds across every client.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={Wallet} label="Total Collected" value={formatCurrency(totals._sum.amount ?? 0)} />
        <Stat icon={AlertTriangle} label="Outstanding" value={formatCurrency(outstandingTotal)} tone="warning" />
        <Stat icon={CreditCard} label="Failed Payments" value={String(failedCount)} tone="danger" />
        <Stat icon={CheckCircle2} label="Transactions" value={String(payments.length)} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-2.5 text-[12px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Recent Transactions</h2>
          <div className="card divide-y divide-[var(--border)]">
            {payments.length === 0 && <p className="px-4 py-8 text-center text-[13px] text-[var(--text-muted)]">No payments recorded yet.</p>}
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-[var(--text)]">
                    {fullName(p.customer)} · {optionLabel(PAYMENT_TYPES, p.type)}
                    {p.booking && <Link href={`/bookings/${p.booking.id}`} className="ml-1.5 text-[11px] text-[var(--brand-bright)] hover:underline">#{p.booking.bookingNumber}</Link>}
                  </p>
                  <p className="text-[11px] text-[var(--text-faint)]">{formatDateTime(p.createdAt)} · {p.method}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-[var(--text)]">{formatCurrency(p.amount)}</span>
                  <StatusBadge options={PAYMENT_RECORD_STATUSES} value={p.status} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="mb-2.5 text-[12px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Outstanding Balances</h2>
          <div className="card divide-y divide-[var(--border)]">
            {outstandingBookings.length === 0 && <p className="px-4 py-8 text-center text-[13px] text-[var(--text-muted)]">Everything is paid up.</p>}
            {outstandingBookings.map((b) => (
              <Link key={b.id} href={`/bookings/${b.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-white/[0.03]">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-[var(--text)]">{fullName(b.customer)}</p>
                  <p className="text-[11px] text-[var(--text-faint)]">#{b.bookingNumber}</p>
                </div>
                <span className="text-[13px] font-semibold text-[var(--warning)]">{formatCurrency(b.remainingBalance)}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone = "default" }: { icon: React.ComponentType<{ size?: number }>; label: string; value: string; tone?: "default" | "warning" | "danger" }) {
  const colors: Record<string, string> = { default: "text-[var(--brand-bright)]", warning: "text-[var(--warning)]", danger: "text-[var(--danger)]" };
  return (
    <div className="card flex items-center gap-3 p-3.5">
      <Icon size={16} />
      <div>
        <p className={`font-display text-xl font-medium ${colors[tone]}`}>{value}</p>
        <p className="text-[10.5px] font-medium text-[var(--text-muted)]">{label}</p>
      </div>
    </div>
  );
}
