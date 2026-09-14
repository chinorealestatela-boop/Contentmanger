import { notFound } from "next/navigation";
import { getQuoteDetail } from "@/lib/queries/quotes";
import { QuoteStaffActions, QuoteClientActions } from "@/components/quotes/QuoteActions";
import { StatusBadge } from "@/components/ui/Badge";
import { formatCurrency, formatDate, formatTime12h, fullName } from "@/lib/format";
import { optionLabel, SERVICE_TYPES, QUOTE_STATUSES } from "@/lib/constants";

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const quote = await getQuoteDetail(id);
  if (!quote) notFound();

  const stops: string[] = quote.additionalStops ? JSON.parse(quote.additionalStops) : [];
  const amenities: string[] = quote.amenities ? JSON.parse(quote.amenities) : [];

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6 lg:p-10">
      <div className="flex items-center justify-between">
        <StatusBadge options={QUOTE_STATUSES} value={quote.status} />
        <QuoteStaffActions quoteId={quote.id} status={quote.status} />
      </div>

      <div className="card overflow-hidden">
        <div className="relative border-b border-[var(--border)] p-8 text-center" style={{ background: "linear-gradient(180deg, var(--brand-soft), transparent)" }}>
          <p className="font-display text-3xl tracking-[0.15em] text-[var(--text)]">STRATOS EXOTICS</p>
          <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.3em] text-[var(--brand-bright)]">&amp; Lifestyle</p>
          <p className="mt-4 text-[13px] text-[var(--text-muted)]">Reservation Proposal · {quote.quoteNumber}</p>
        </div>

        <div className="grid grid-cols-1 gap-8 p-8 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">Prepared For</p>
            <p className="mt-1 font-display text-xl font-medium text-[var(--text)]">{fullName(quote.customer)}</p>
            <p className="text-[13px] text-[var(--text-muted)]">{quote.customer.phone ?? quote.customer.email ?? ""}</p>
          </div>
          <div className="sm:text-right">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">Valid Until</p>
            <p className="mt-1 text-[13px] text-[var(--text)]">{quote.validUntil ? formatDate(quote.validUntil) : "—"}</p>
          </div>
        </div>

        <div className="hairline mx-8" />

        <div className="grid grid-cols-1 gap-8 p-8 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">Trip Details</p>
            <dl className="mt-2 space-y-2 text-[13px]">
              <Row label="Service" value={quote.serviceType ? optionLabel(SERVICE_TYPES, quote.serviceType) : "—"} />
              <Row label="Date" value={quote.serviceDate ? formatDate(quote.serviceDate) : "—"} />
              <Row label="Time" value={quote.pickupTime ? formatTime12h(quote.pickupTime) : "—"} />
              <Row label="Pickup" value={quote.pickupLocation ?? "—"} />
              <Row label="Drop-off" value={quote.dropoffLocation ?? "—"} />
              {stops.length > 0 && <Row label="Stops" value={stops.join(", ")} />}
              <Row label="Duration" value={quote.hours ? `${quote.hours} hrs` : "—"} />
            </dl>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">Vehicle &amp; Chauffeur</p>
            <dl className="mt-2 space-y-2 text-[13px]">
              <Row label="Vehicle" value={quote.vehicle?.name ?? "To be assigned"} />
              <Row label="Chauffeur" value={quote.driver ? fullName(quote.driver) : "To be assigned"} />
            </dl>
            {amenities.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {amenities.map((a) => <span key={a} className="badge badge-gold">{a}</span>)}
              </div>
            )}
          </div>
        </div>

        <div className="hairline mx-8" />

        <div className="space-y-2 p-8 text-[13px]">
          <Row label="Base Rate" value={formatCurrency(quote.baseRate)} />
          <Row label="Chauffeur Fee" value={formatCurrency(quote.driverFee)} />
          <Row label="Mileage Fee" value={formatCurrency(quote.mileageFee)} />
          <Row label="Additional Fees" value={formatCurrency(quote.additionalFees)} />
          {quote.discount > 0 && <Row label="Discount" value={`-${formatCurrency(quote.discount)}`} />}
          <Row label="Tax" value={formatCurrency(quote.taxAmount)} />
          <div className="divider !my-3" />
          <Row label="Total" value={formatCurrency(quote.totalPrice)} bold />
          <Row label="Deposit Due Now" value={formatCurrency(quote.depositAmount)} bold gold />
          <Row label="Balance Due" value={formatCurrency(quote.totalPrice - quote.depositAmount)} />
        </div>

        {quote.termsText && (
          <div className="border-t border-[var(--border)] bg-white/[0.02] p-8">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">Terms &amp; Conditions</p>
            <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--text-muted)]">{quote.termsText}</p>
          </div>
        )}

        <div className="border-t border-[var(--border)] p-8">
          <QuoteClientActions quoteId={quote.id} customerId={quote.customerId} depositAmount={quote.depositAmount} status={quote.status} />
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold, gold }: { label: string; value: string; bold?: boolean; gold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={bold ? "font-semibold text-[var(--text)]" : "text-[var(--text-muted)]"}>{label}</span>
      <span className={gold ? "font-semibold text-[var(--brand-bright)]" : bold ? "font-semibold text-[var(--text)]" : "text-[var(--text)]"}>{value}</span>
    </div>
  );
}
