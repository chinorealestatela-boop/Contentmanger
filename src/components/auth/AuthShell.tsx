import Link from "next/link";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full">
      <div className="hidden lg:flex lg:w-[46%] flex-col justify-between bg-[var(--sidebar-bg)] p-12 text-white">
        <Link href="/login" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--brand)] font-bold">D</div>
          <span className="text-lg font-semibold">Driveline CRM</span>
        </Link>
        <div className="max-w-md">
          <h1 className="text-3xl font-semibold leading-tight text-white">
            Know exactly who to work, right now.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-slate-400">
            Hot leads, overdue follow-ups, today&rsquo;s appointments, and every customer conversation —
            organized into one action-first command center built for the sales floor.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-slate-300">
            {[
              "Never let a lead go cold again",
              "Automated follow-up cadences, day 0 through 30",
              "Pipeline, tasks, and appointments in one view",
            ].map((t) => (
              <li key={t} className="flex items-center gap-2.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-xs">✓</span>
                {t}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-slate-500">© {new Date().getFullYear()} AutoMax LV. Internal use only.</p>
      </div>

      <div className="flex flex-1 items-center justify-center bg-[var(--bg)] px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--brand)] font-bold text-white">D</div>
            <span className="text-base font-semibold">Driveline CRM</span>
          </div>
          <h2 className="text-2xl font-semibold text-[var(--text)]">{title}</h2>
          {subtitle && <p className="mt-1.5 text-sm text-[var(--text-muted)]">{subtitle}</p>}
          <div className="mt-7">{children}</div>
          {footer && <div className="mt-6 text-center text-sm text-[var(--text-muted)]">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
