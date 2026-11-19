// Shared color legend — First Payment (red, money owed to the bank/
// lender) vs Pick Payment (green, money owed to the dealership). Placed
// at the top of every view that shows both kinds of dates together.
export function PaymentTypeLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] px-3.5 py-2 text-[12px]">
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#DC2626" }} />
        <span className="font-semibold text-[var(--text)]">FIRST</span>
        <span className="text-[var(--text-muted)]">— first bank/lender payment</span>
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#16A34A" }} />
        <span className="font-semibold text-[var(--text)]">PICK</span>
        <span className="text-[var(--text-muted)]">— dealership down payment</span>
      </span>
    </div>
  );
}
