export function ReportStat({ label, value, sublabel }: { label: string; value: string; sublabel?: string }) {
  return (
    <div className="card p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
      <p className="mt-1 text-2xl font-bold text-[var(--text)] tabular-nums">{value}</p>
      {sublabel && <p className="mt-0.5 text-[11px] text-[var(--text-faint)]">{sublabel}</p>}
    </div>
  );
}
