export function SectionCard({
  title,
  action,
  children,
  id,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="card scroll-mt-20">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3.5">
        <h2 className="text-[13.5px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{title}</h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function EmptyRow({ children }: { children: React.ReactNode }) {
  return <p className="py-3 text-center text-[13px] text-[var(--text-faint)]">{children}</p>;
}
