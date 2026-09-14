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
    <div className="flex min-h-screen w-full" style={{ background: "var(--bg-app)" }}>
      <div className="relative hidden lg:flex lg:w-[48%] flex-col justify-between overflow-hidden p-14 text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              "radial-gradient(700px 500px at 20% 0%, rgba(201,162,75,0.16), transparent 60%), radial-gradient(600px 500px at 100% 100%, rgba(127,168,201,0.10), transparent 55%)",
          }}
        />
        <Link href="/login" className="relative z-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--brand-line)] font-display text-lg text-[var(--brand-bright)]">S</div>
          <span className="font-display text-xl tracking-wide text-white">STRATOS EXOTICS <span className="text-[var(--text-faint)]">&amp; LIFESTYLE</span></span>
        </Link>

        <div className="relative z-10 max-w-md">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-[var(--brand-bright)]">Operations Platform</p>
          <h1 className="font-display text-4xl font-medium leading-[1.15] text-white">
            The operating system for Stratos Exotics.
          </h1>
          <p className="mt-5 text-[15px] leading-relaxed text-[var(--text-muted)]">
            Every lead, quote, reservation, chauffeur, and vehicle — from first inquiry to
            repeat client — in one elegant command center built for a luxury fleet.
          </p>
          <ul className="mt-9 space-y-3.5 text-sm text-[var(--text-muted)]">
            {[
              "Concierge-grade lead response, every time",
              "Live fleet, chauffeur, and trip visibility",
              "Quotes, deposits, and balances handled automatically",
            ].map((t) => (
              <li key={t} className="flex items-center gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--brand-line)] text-[10px] text-[var(--brand-bright)]">✓</span>
                {t}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-xs text-[var(--text-faint)]">© {new Date().getFullYear()} Stratos Exotics &amp; Lifestyle. Internal use only.</p>
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="card w-full max-w-sm p-8">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--brand-line)] font-display text-[var(--brand-bright)]">S</div>
            <span className="font-display text-lg tracking-wide">STRATOS EXOTICS</span>
          </div>
          <h2 className="font-display text-3xl font-medium text-[var(--text)]">{title}</h2>
          {subtitle && <p className="mt-2 text-sm text-[var(--text-muted)]">{subtitle}</p>}
          <div className="mt-7">{children}</div>
          {footer && <div className="mt-6 text-center text-sm text-[var(--text-muted)]">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
