import { notFound } from "next/navigation";
import Link from "next/link";
import { Mail, Phone, MapPin, Star } from "lucide-react";
import { requireScope } from "@/lib/queries/scope";
import { getCustomerProfile } from "@/lib/queries/customers";
import { ensureFollowUpsFresh } from "@/lib/queries/followups";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, ColorPill, StatusBadge } from "@/components/ui/Badge";
import { SectionCard, EmptyRow } from "@/components/ui/SectionCard";
import { ActivityTimeline } from "@/components/customers/ActivityTimeline";
import { QuickActions } from "@/components/actions/QuickActions";
import { FollowUpsSection } from "@/components/customers/FollowUpsSection";
import { TierControl } from "@/components/customers/TierControl";
import { formatCurrency, formatDate, formatTime12h, formatTimeAgo } from "@/lib/format";
import { optionLabel, CONTACT_METHODS, COMMUNICATION_TYPES, TASK_STATUSES, BOOKING_STATUSES, PAYMENT_RECORD_STATUSES, QUOTE_STATUSES } from "@/lib/constants";

export default async function CustomerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireScope();
  await ensureFollowUpsFresh();
  const customer = await getCustomerProfile(id);
  if (!customer) notFound();

  const activeLead = customer.leads.find((l) => l.status === "ACTIVE") ?? customer.leads[0] ?? null;

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6 lg:p-8">
      <div className="card p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <Avatar firstName={customer.firstName} lastName={customer.lastName} size="lg" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-medium text-[var(--text)]">{customer.firstName} {customer.lastName}</h1>
                <TierControl customerId={customer.id} tier={customer.tier} />
                {activeLead?.isVip && <Star size={16} className="text-[var(--brand-bright)]" fill="currentColor" />}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-[var(--text-muted)]">
                {customer.phone && <span className="flex items-center gap-1"><Phone size={13} /> {customer.phone}</span>}
                {customer.email && <span className="flex items-center gap-1"><Mail size={13} /> {customer.email}</span>}
                {customer.city && <span className="flex items-center gap-1"><MapPin size={13} /> {customer.city}, {customer.state}</span>}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-[12.5px]">
                {activeLead && <ColorPill color={activeLead.stage.color}>{activeLead.stage.name}</ColorPill>}
                <span className="text-[var(--text-faint)]">Owner: {customer.owner.firstName} {customer.owner.lastName}</span>
              </div>
            </div>
          </div>
          <Link href={`/customers/${customer.id}/edit`} className="text-xs font-semibold text-[var(--brand-bright)] hover:underline">Edit Profile</Link>
        </div>
        <div className="mt-4 border-t border-[var(--border)] pt-4">
          <QuickActions customerId={customer.id} leadId={activeLead?.id ?? null} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total Spent" value={formatCurrency(customer.stats.totalSpent)} />
        <Stat label="Avg Booking Value" value={formatCurrency(customer.stats.avgBookingValue)} />
        <Stat label="Total Bookings" value={String(customer.stats.totalBookings)} />
        <Stat label="Completed Trips" value={String(customer.stats.completedBookings)} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <SectionCard title="Preferences &amp; Contact">
            <dl className="grid grid-cols-2 gap-4 text-[13px] sm:grid-cols-3">
              <Info label="Preferred Contact" value={optionLabel(CONTACT_METHODS, customer.preferredContactMethod)} />
              <Info label="Preferred Vehicle" value={customer.preferredVehicle?.name ?? (customer.stats.preferredVehicles[0]?.[0] ?? null)} />
              <Info label="Preferred Chauffeur" value={customer.preferredDriver ? `${customer.preferredDriver.firstName} ${customer.preferredDriver.lastName}` : null} />
              <Info label="Address" value={customer.address} />
              <Info label="City / State / Zip" value={[customer.city, customer.state, customer.zip].filter(Boolean).join(", ") || null} />
              <Info label="Company" value={customer.company} />
            </dl>
            {customer.specialRequests && (
              <div className="mt-4 border-t border-[var(--border)] pt-4 text-[13px]">
                <span className="font-semibold text-[var(--text)]">Special Requests: </span>
                <span className="text-[var(--text-muted)]">{customer.specialRequests}</span>
              </div>
            )}
            {customer.notes && (
              <div className="mt-2 text-[13px]">
                <span className="font-semibold text-[var(--text)]">Notes: </span>
                <span className="text-[var(--text-muted)]">{customer.notes}</span>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Follow-Ups">
            <FollowUpsSection followUps={customer.followUps} />
          </SectionCard>

          <SectionCard title="Bookings">
            {customer.bookings.length === 0 ? (
              <EmptyRow>No bookings yet.</EmptyRow>
            ) : (
              <ul className="space-y-2">
                {customer.bookings.map((b) => (
                  <li key={b.id}>
                    <Link href={`/bookings/${b.id}`} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3.5 py-2.5 hover:bg-white/[0.03]">
                      <div>
                        <p className="text-[13px] font-medium text-[var(--text)]">{b.serviceType.replace(/_/g, " ")} — {b.vehicle?.name ?? "Vehicle TBD"}</p>
                        <p className="text-[11.5px] text-[var(--text-faint)]">{formatDate(b.date)} at {formatTime12h(b.pickupTime)}{b.driver ? ` · ${b.driver.firstName} ${b.driver.lastName}` : ""}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] text-[var(--text-muted)]">{formatCurrency(b.totalPrice)}</span>
                        <StatusBadge options={BOOKING_STATUSES} value={b.bookingStatus} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Quotes">
            {customer.quotes.length === 0 ? (
              <EmptyRow>No quotes yet.</EmptyRow>
            ) : (
              <ul className="space-y-2">
                {customer.quotes.map((q) => (
                  <li key={q.id}>
                    <Link href={`/quotes/${q.id}`} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3.5 py-2.5 hover:bg-white/[0.03]">
                      <span className="text-[13px] font-medium text-[var(--text)]">Quote {q.quoteNumber}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] text-[var(--text-muted)]">{formatCurrency(q.totalPrice)}</span>
                        <StatusBadge options={QUOTE_STATUSES} value={q.status} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Payment History">
            {customer.payments.length === 0 ? (
              <EmptyRow>No payments on file.</EmptyRow>
            ) : (
              <ul className="space-y-2">
                {customer.payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3.5 py-2.5">
                    <div>
                      <p className="text-[13px] font-medium text-[var(--text)]">{p.type} · {formatCurrency(p.amount)}</p>
                      <p className="text-[11.5px] text-[var(--text-faint)]">{formatTimeAgo(p.createdAt)} · {p.method}</p>
                    </div>
                    <StatusBadge options={PAYMENT_RECORD_STATUSES} value={p.status} />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Tasks">
            {customer.tasks.length === 0 ? (
              <EmptyRow>No tasks yet.</EmptyRow>
            ) : (
              <ul className="space-y-2">
                {customer.tasks.map((t) => (
                  <li key={t.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3.5 py-2.5">
                    <div>
                      <p className="text-[13px] font-medium text-[var(--text)]">{t.title}</p>
                      <p className="text-[11.5px] text-[var(--text-faint)]">Due {formatDate(t.dueDate)}{t.dueTime ? ` at ${formatTime12h(t.dueTime)}` : ""} · {t.assignee ? `${t.assignee.firstName} ${t.assignee.lastName}` : "Unassigned"}</p>
                    </div>
                    <Badge variant={t.status === "COMPLETED" ? "success" : t.status === "CANCELLED" ? "neutral" : "info"}>{optionLabel(TASK_STATUSES, t.status)}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Communications">
            {customer.communications.length === 0 ? (
              <EmptyRow>No communications logged.</EmptyRow>
            ) : (
              <ul className="space-y-2">
                {customer.communications.map((c) => (
                  <li key={c.id} className="rounded-lg border border-[var(--border)] px-3.5 py-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-medium text-[var(--text)]">{optionLabel(COMMUNICATION_TYPES, c.type)} · {c.direction === "INBOUND" ? "Inbound" : "Outbound"}</span>
                      <span className="text-[11px] text-[var(--text-faint)]">{formatTimeAgo(c.occurredAt)}</span>
                    </div>
                    <p className="mt-1 text-[12.5px] text-[var(--text-muted)]">{c.summary}</p>
                    <p className="mt-1 text-[11px] text-[var(--text-faint)]">Logged by {c.actor ? `${c.actor.firstName} ${c.actor.lastName}` : "System"}</p>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Notes">
            {customer.notes_.length === 0 ? (
              <EmptyRow>No notes yet.</EmptyRow>
            ) : (
              <ul className="space-y-2">
                {customer.notes_.map((n) => (
                  <li key={n.id} className="rounded-lg border border-[var(--border)] px-3.5 py-2.5">
                    <p className="text-[13px] text-[var(--text)]">{n.body}</p>
                    <p className="mt-1 text-[11px] text-[var(--text-faint)]">{n.author.firstName} {n.author.lastName} · {formatTimeAgo(n.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        <div className="space-y-5">
          <SectionCard title="Activity Timeline">
            <ActivityTimeline activities={customer.activities} />
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">{label}</dt>
      <dd className="mt-0.5 text-[var(--text)]">{value || "—"}</dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="font-display text-2xl font-medium text-[var(--text)]">{value}</p>
      <p className="mt-0.5 text-[11px] font-medium text-[var(--text-muted)]">{label}</p>
    </div>
  );
}
