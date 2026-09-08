"use client";

import { useMemo, useState } from "react";
import { formatCurrency } from "@/lib/format";

/** A real, live-computed estimate (not a fabricated static number) — the
 * customer can adjust every input and see the math change. Deliberately
 * labeled as an estimate throughout: this is not a financing offer, rate
 * quote, or approval of any kind. */
export function PaymentEstimator({ price }: { price: number }) {
  const [down, setDown] = useState(Math.round(price * 0.1));
  const [apr, setApr] = useState(7.9);
  const [termMonths, setTermMonths] = useState(60);

  const monthly = useMemo(() => {
    const principal = Math.max(0, price - down);
    const rate = apr / 100 / 12;
    if (rate === 0) return principal / termMonths;
    return (principal * rate) / (1 - Math.pow(1 + rate, -termMonths));
  }, [price, down, apr, termMonths]);

  return (
    <div className="card p-5">
      <h3 className="text-[14px] font-bold text-[var(--text)]">Estimated Monthly Payment</h3>
      <p className="mt-3 text-[28px] font-extrabold text-[var(--brand)]">
        {formatCurrency(Math.round(monthly))}<span className="text-[14px] font-semibold text-[var(--text-muted)]">/mo</span>
      </p>

      <div className="mt-4 space-y-3">
        <div>
          <label className="label mb-1 flex items-center justify-between">
            <span>Down payment</span>
            <span className="font-semibold text-[var(--text)]">{formatCurrency(down)}</span>
          </label>
          <input type="range" min={0} max={price} step={500} value={down} onChange={(e) => setDown(Number(e.target.value))} className="w-full" />
        </div>
        <div>
          <label className="label mb-1 flex items-center justify-between">
            <span>Estimated APR</span>
            <span className="font-semibold text-[var(--text)]">{apr.toFixed(1)}%</span>
          </label>
          <input type="range" min={0} max={24} step={0.1} value={apr} onChange={(e) => setApr(Number(e.target.value))} className="w-full" />
        </div>
        <div>
          <label className="label mb-1" htmlFor="term">Loan term</label>
          <select id="term" value={termMonths} onChange={(e) => setTermMonths(Number(e.target.value))} className="input">
            {[36, 48, 60, 72, 84].map((t) => (
              <option key={t} value={t}>{t} months</option>
            ))}
          </select>
        </div>
      </div>

      <p className="mt-4 text-[11px] text-[var(--text-faint)]">
        Estimate only — not a financing offer or credit approval. Your actual rate and payment depend on credit, term, taxes, fees, and lender approval.
      </p>
    </div>
  );
}
