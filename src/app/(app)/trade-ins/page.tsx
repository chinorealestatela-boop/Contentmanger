import Link from "next/link";
import { requireScope } from "@/lib/queries/scope";
import { prisma } from "@/lib/prisma";
import { customerScopeWhere } from "@/lib/queries/scope";
import { formatCurrency, formatDate } from "@/lib/format";
import { TradeStatusSelect } from "@/components/tradeins/TradeStatusSelect";

export default async function TradeInsPage() {
  const scope = await requireScope();
  const tradeIns = await prisma.tradeIn.findMany({
    where: { customer: customerScopeWhere(scope) },
    include: { customer: true },
    orderBy: { createdAt: "desc" },
  });

  const totalEquity = tradeIns.reduce((sum, t) => sum + (t.estimatedValue - t.payoff), 0);

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text)]">Trade-Ins</h1>
        <p className="text-[13px] text-[var(--text-muted)]">{tradeIns.length} trade-in{tradeIns.length === 1 ? "" : "s"} on file · Net {totalEquity >= 0 ? "equity" : "negative equity"} {formatCurrency(Math.abs(totalEquity))}</p>
      </div>

      <div className="space-y-2.5">
        {tradeIns.length === 0 && <div className="card p-10 text-center text-sm text-[var(--text-muted)]">No trade-ins yet. Add one from a customer&rsquo;s profile.</div>}
        {tradeIns.map((t) => {
          const equity = t.estimatedValue - t.payoff;
          return (
            <div key={t.id} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Link href={`/customers/${t.customerId}`} className="text-[13.5px] font-semibold text-[var(--text)] hover:text-[var(--brand)]">
                  {t.customer.firstName} {t.customer.lastName}
                </Link>
                <p className="mt-0.5 text-[12.5px] text-[var(--text-muted)]">{[t.year, t.make, t.model, t.trim].filter(Boolean).join(" ") || "Trade vehicle"}{t.mileage ? ` · ${t.mileage.toLocaleString()} mi` : ""}</p>
                <p className="mt-0.5 text-[11.5px] text-[var(--text-faint)]">Payoff {formatCurrency(t.payoff)} · Est. value {formatCurrency(t.estimatedValue)} · {formatDate(t.createdAt)}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-[13px] font-bold ${equity >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {equity >= 0 ? "+" : "−"}{formatCurrency(Math.abs(equity))}
                </span>
                <TradeStatusSelect tradeInId={t.id} customerId={t.customerId} status={t.appraisalStatus} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
