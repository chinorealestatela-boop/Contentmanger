import Link from "next/link";
import { Users, UserPlus, CalendarCheck, Car, IdCard, FileText, CreditCard } from "lucide-react";
import { requireScope } from "@/lib/queries/scope";
import { globalSearch } from "@/lib/queries/search";
import { SearchInput } from "@/components/ui/SearchInput";
import { StatusBadge } from "@/components/ui/Badge";
import { BOOKING_STATUSES, QUOTE_STATUSES, PAYMENT_RECORD_STATUSES, VEHICLE_AVAILABILITY, DRIVER_STATUSES } from "@/lib/constants";
import { formatCurrency, formatDate, fullName } from "@/lib/format";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const sp = await searchParams;
  const q = sp.q ?? "";
  const scope = await requireScope();
  const results = q ? await globalSearch(scope, q) : null;

  const total = results ? Object.values(results).reduce((s, arr) => s + arr.length, 0) : 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="font-display text-3xl font-medium text-[var(--text)]">Search</h1>
        <p className="text-[13px] text-[var(--text-muted)]">Clients, leads, bookings, vehicles, chauffeurs, quotes, and payments — all in one place.</p>
      </div>

      <form>
        <SearchInput name="q" defaultValue={q} placeholder="Search anything…" />
      </form>

      {!q && <p className="py-10 text-center text-sm text-[var(--text-faint)]">Start typing to search across the whole CRM.</p>}
      {q && total === 0 && <p className="py-10 text-center text-sm text-[var(--text-faint)]">No results for &ldquo;{q}&rdquo;.</p>}

      {results && results.customers.length > 0 && (
        <ResultSection title="Clients" icon={Users}>
          {results.customers.map((c) => (
            <Link key={c.id} href={`/customers/${c.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-white/[0.03]">
              <div>
                <p className="text-[13.5px] font-medium text-[var(--text)]">{fullName(c)}</p>
                <p className="text-[11.5px] text-[var(--text-faint)]">{c.phone ?? c.email ?? c.company ?? ""}</p>
              </div>
              <span className="badge badge-gold">{c.tier}</span>
            </Link>
          ))}
        </ResultSection>
      )}

      {results && results.leads.length > 0 && (
        <ResultSection title="Leads" icon={UserPlus}>
          {results.leads.map((l) => (
            <Link key={l.id} href={`/leads/${l.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-white/[0.03]">
              <div>
                <p className="text-[13.5px] font-medium text-[var(--text)]">{fullName(l.customer)}</p>
                <p className="text-[11.5px] text-[var(--text-faint)]">{l.serviceRequested ?? "Inquiry"}</p>
              </div>
              <span className="badge badge-neutral">{l.stage.name}</span>
            </Link>
          ))}
        </ResultSection>
      )}

      {results && results.bookings.length > 0 && (
        <ResultSection title="Bookings" icon={CalendarCheck}>
          {results.bookings.map((b) => (
            <Link key={b.id} href={`/bookings/${b.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-white/[0.03]">
              <div>
                <p className="text-[13.5px] font-medium text-[var(--text)]">{fullName(b.customer)} · #{b.bookingNumber}</p>
                <p className="text-[11.5px] text-[var(--text-faint)]">{formatDate(b.date)} · {b.vehicle?.name ?? "Vehicle TBD"}</p>
              </div>
              <StatusBadge options={BOOKING_STATUSES} value={b.bookingStatus} />
            </Link>
          ))}
        </ResultSection>
      )}

      {results && results.vehicles.length > 0 && (
        <ResultSection title="Fleet" icon={Car}>
          {results.vehicles.map((v) => (
            <Link key={v.id} href={`/fleet/${v.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-white/[0.03]">
              <div>
                <p className="text-[13.5px] font-medium text-[var(--text)]">{v.name}</p>
                <p className="text-[11.5px] text-[var(--text-faint)]">#{v.fleetNumber} · {v.vin}</p>
              </div>
              <StatusBadge options={VEHICLE_AVAILABILITY} value={v.availability} />
            </Link>
          ))}
        </ResultSection>
      )}

      {results && results.drivers.length > 0 && (
        <ResultSection title="Chauffeurs" icon={IdCard}>
          {results.drivers.map((d) => (
            <Link key={d.id} href={`/drivers/${d.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-white/[0.03]">
              <p className="text-[13.5px] font-medium text-[var(--text)]">{fullName(d)}</p>
              <StatusBadge options={DRIVER_STATUSES} value={d.status} />
            </Link>
          ))}
        </ResultSection>
      )}

      {results && results.quotes.length > 0 && (
        <ResultSection title="Quotes" icon={FileText}>
          {results.quotes.map((qt) => (
            <Link key={qt.id} href={`/quotes/${qt.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-white/[0.03]">
              <div>
                <p className="text-[13.5px] font-medium text-[var(--text)]">{fullName(qt.customer)} · #{qt.quoteNumber}</p>
                <p className="text-[11.5px] text-[var(--text-faint)]">{formatCurrency(qt.totalPrice)}</p>
              </div>
              <StatusBadge options={QUOTE_STATUSES} value={qt.status} />
            </Link>
          ))}
        </ResultSection>
      )}

      {results && results.payments.length > 0 && (
        <ResultSection title="Payments" icon={CreditCard}>
          {results.payments.map((p) => (
            <div key={p.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-[13.5px] font-medium text-[var(--text)]">{fullName(p.customer)}</p>
                <p className="text-[11.5px] text-[var(--text-faint)]">{p.type} · {formatCurrency(p.amount)}</p>
              </div>
              <StatusBadge options={PAYMENT_RECORD_STATUSES} value={p.status} />
            </div>
          ))}
        </ResultSection>
      )}
    </div>
  );
}

function ResultSection({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ size?: number }>; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-[var(--text-muted)]"><Icon size={13} /> {title}</h2>
      <div className="card divide-y divide-[var(--border)]">{children}</div>
    </div>
  );
}
