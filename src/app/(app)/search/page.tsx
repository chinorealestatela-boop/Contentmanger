import Link from "next/link";
import { Car, CalendarClock, Users } from "lucide-react";
import { requireScope } from "@/lib/queries/scope";
import { globalSearch } from "@/lib/queries/search";
import { CustomerRow } from "@/components/customers/CustomerRow";
import { SearchInput } from "@/components/ui/SearchInput";
import { formatCurrency, formatDate, formatTime12h } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { VEHICLE_STATUSES, optionLabel } from "@/lib/constants";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const sp = await searchParams;
  const q = sp.q ?? "";
  const scope = await requireScope();
  const results = q ? await globalSearch(scope, q) : { customers: [], vehicles: [], appointments: [] };
  const totalResults = results.customers.length + results.vehicles.length + results.appointments.length;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text)]">Search</h1>
        <p className="text-[13px] text-[var(--text-muted)]">Customers, phone, email, VIN, stock #, vehicle, source, stage, temperature, notes.</p>
      </div>
      <form>
        <SearchInput defaultValue={q} placeholder="Search everything…" />
      </form>

      {q && (
        <p className="text-xs text-[var(--text-muted)]">{totalResults} result{totalResults === 1 ? "" : "s"} for &ldquo;{q}&rdquo;</p>
      )}

      {results.customers.length > 0 && (
        <section className="space-y-2.5">
          <h2 className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--text-muted)]"><Users size={14} /> Customers</h2>
          {results.customers.map((c) => (
            <CustomerRow key={c.id} customer={{ ...c, vehicleInterests: [] } as never} />
          ))}
        </section>
      )}

      {results.vehicles.length > 0 && (
        <section className="space-y-2.5">
          <h2 className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--text-muted)]"><Car size={14} /> Vehicles</h2>
          {results.vehicles.map((v) => (
            <Link key={v.id} href="/vehicles" className="card flex items-center justify-between p-4 hover:shadow-md">
              <div>
                <p className="text-[13.5px] font-semibold text-[var(--text)]">{v.year} {v.make} {v.model} {v.trim}</p>
                <p className="text-[12px] text-[var(--text-muted)]">#{v.stockNumber} · VIN {v.vin}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={v.status === "AVAILABLE" ? "sold" : "neutral"}>{optionLabel(VEHICLE_STATUSES, v.status)}</Badge>
                <span className="text-[13px] font-semibold text-[var(--text)]">{formatCurrency(v.internetPrice ?? v.sellingPrice)}</span>
              </div>
            </Link>
          ))}
        </section>
      )}

      {results.appointments.length > 0 && (
        <section className="space-y-2.5">
          <h2 className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--text-muted)]"><CalendarClock size={14} /> Appointments</h2>
          {results.appointments.map((a) => (
            <Link key={a.id} href={`/customers/${a.customerId}`} className="card flex items-center justify-between p-4 hover:shadow-md">
              <div>
                <p className="text-[13.5px] font-semibold text-[var(--text)]">{a.customer.firstName} {a.customer.lastName}</p>
                <p className="text-[12px] text-[var(--text-muted)]">{a.type.replace(/_/g, " ")} — {formatDate(a.date)} at {formatTime12h(a.time)}</p>
              </div>
              <Badge variant="appointment">{a.status}</Badge>
            </Link>
          ))}
        </section>
      )}

      {q && totalResults === 0 && <div className="card p-10 text-center text-sm text-[var(--text-muted)]">No results for &ldquo;{q}&rdquo;.</div>}
    </div>
  );
}
