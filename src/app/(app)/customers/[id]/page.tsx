import { notFound } from "next/navigation";
import Link from "next/link";
import { Mail, Phone, MapPin, Clock } from "lucide-react";
import { requireScope } from "@/lib/queries/scope";
import { getCustomerProfile } from "@/lib/queries/customers";
import { ensureFollowUpsFresh } from "@/lib/queries/followups";
import { prisma } from "@/lib/prisma";
import { Avatar } from "@/components/ui/Avatar";
import { TemperatureBadge, Badge, ColorPill } from "@/components/ui/Badge";
import { SectionCard, EmptyRow } from "@/components/ui/SectionCard";
import { ActivityTimeline } from "@/components/customers/ActivityTimeline";
import { ProfileActions } from "@/components/customers/ProfileActions";
import { FollowUpsSection } from "@/components/customers/FollowUpsSection";
import { formatCurrency, formatDate, formatRelativeDay, formatTime12h, formatTimeAgo } from "@/lib/format";
import {
  optionLabel, CONTACT_METHODS, CONTACT_TIMES, PURCHASE_TIMEFRAMES, FINANCE_TYPES,
  CREDIT_APP_STATUSES, APPOINTMENT_STATUSES, APPRAISAL_STATUSES, COMMUNICATION_TYPES,
  TASK_STATUSES, OFFER_STATUSES,
} from "@/lib/constants";

export default async function CustomerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireScope();
  await ensureFollowUpsFresh();
  const customer = await getCustomerProfile(id);
  if (!customer) notFound();

  const [stages, lostReasons, availableVehicles] = await Promise.all([
    prisma.pipelineStage.findMany({ orderBy: { order: "asc" } }),
    prisma.lostReason.findMany({ where: { active: true }, orderBy: { order: "asc" } }),
    prisma.vehicle.findMany({ where: { status: { in: ["AVAILABLE", "HOLD", "IN_TRANSIT"] } }, orderBy: { createdAt: "desc" } }),
  ]);

  const activeLead = customer.leads.find((l) => l.status === "ACTIVE") ?? customer.leads[0] ?? null;

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
      {/* Header */}
      <div className="card p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <Avatar firstName={customer.firstName} lastName={customer.lastName} size="lg" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold text-[var(--text)]">{customer.firstName} {customer.lastName}</h1>
                {activeLead && <TemperatureBadge temperature={activeLead.temperature} />}
                {activeLead?.status === "SOLD" && <Badge variant="sold">Sold</Badge>}
                {activeLead?.status === "LOST" && <Badge variant="lost">Lost</Badge>}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-[var(--text-muted)]">
                {customer.phone && <span className="flex items-center gap-1"><Phone size={13} /> {customer.phone}</span>}
                {customer.email && <span className="flex items-center gap-1"><Mail size={13} /> {customer.email}</span>}
                {customer.city && <span className="flex items-center gap-1"><MapPin size={13} /> {customer.city}, {customer.state}</span>}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-[12.5px]">
                {activeLead && <ColorPill color={activeLead.stage.color}>{activeLead.stage.name}</ColorPill>}
                {activeLead && <span className="font-semibold text-[var(--text)]">Score: <span className="tabular-nums">{activeLead.score}</span></span>}
                {activeLead?.nextFollowUpAt && (
                  <span className="flex items-center gap-1 text-[var(--text-muted)]">
                    <Clock size={12} /> Next follow-up: {formatRelativeDay(activeLead.nextFollowUpAt)}
                  </span>
                )}
                <span className="text-[var(--text-faint)]">Owner: {customer.owner.firstName} {customer.owner.lastName}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-4 border-t border-[var(--border)] pt-4">
          <ProfileActions
            customerId={customer.id}
            customerName={`${customer.firstName} ${customer.lastName}`}
            customerPhone={customer.phone}
            leadId={activeLead?.id ?? null}
            stages={stages}
            lostReasons={lostReasons}
            vehicles={availableVehicles}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* Contact info */}
          <SectionCard title="Contact Information" action={<EditCustomerLink id={customer.id} />}>
            <dl className="grid grid-cols-2 gap-4 text-[13px] sm:grid-cols-3">
              <Info label="Phone" value={customer.phone} />
              <Info label="Email" value={customer.email} />
              <Info label="Preferred Contact" value={optionLabel(CONTACT_METHODS, customer.preferredContactMethod)} />
              <Info label="Best Time" value={optionLabel(CONTACT_TIMES, customer.bestContactTime)} />
              <Info label="Address" value={customer.address} />
              <Info label="City / State / Zip" value={[customer.city, customer.state, customer.zip].filter(Boolean).join(", ") || null} />
            </dl>
          </SectionCard>

          {/* Buying profile */}
          {activeLead && (
            <SectionCard title="Buying Profile">
              <dl className="grid grid-cols-2 gap-4 text-[13px] sm:grid-cols-3">
                <Info label="Purchase Timeframe" value={optionLabel(PURCHASE_TIMEFRAMES, activeLead.purchaseTimeframe)} />
                <Info label="Lead Source" value={activeLead.source?.name ?? null} />
                <Info label="Finance Type" value={optionLabel(FINANCE_TYPES, activeLead.financeType)} />
                <Info label="Desired Payment" value={activeLead.desiredPayment ? `${formatCurrency(activeLead.desiredPayment)}/mo` : null} />
                <Info label="Down Payment" value={activeLead.downPayment ? formatCurrency(activeLead.downPayment) : null} />
                <Info label="Credit Application" value={optionLabel(CREDIT_APP_STATUSES, activeLead.creditAppStatus)} />
                <Info label="Co-Buyer" value={activeLead.hasCoBuyer ? (activeLead.coBuyerName || "Yes") : "No"} />
                <Info label="Preferred Body Style" value={activeLead.prefBodyStyle} />
                <Info label="Max Price" value={activeLead.prefMaxPrice ? formatCurrency(activeLead.prefMaxPrice) : null} />
              </dl>
              {(activeLead.customerNeeds || activeLead.customerWants || activeLead.objections || activeLead.salesNotes) && (
                <div className="mt-4 space-y-2.5 border-t border-[var(--border)] pt-4 text-[13px]">
                  {activeLead.customerNeeds && <p><span className="font-semibold text-[var(--text)]">Needs: </span><span className="text-[var(--text-muted)]">{activeLead.customerNeeds}</span></p>}
                  {activeLead.customerWants && <p><span className="font-semibold text-[var(--text)]">Wants: </span><span className="text-[var(--text-muted)]">{activeLead.customerWants}</span></p>}
                  {activeLead.objections && <p><span className="font-semibold text-[var(--text)]">Objections: </span><span className="text-[var(--text-muted)]">{activeLead.objections}</span></p>}
                  {activeLead.salesNotes && <p><span className="font-semibold text-[var(--text)]">Sales Notes: </span><span className="text-[var(--text-muted)]">{activeLead.salesNotes}</span></p>}
                </div>
              )}
            </SectionCard>
          )}

          {/* Vehicles of interest */}
          <SectionCard title="Vehicles of Interest">
            {customer.vehicleInterests.length === 0 ? (
              <EmptyRow>No vehicles noted yet.</EmptyRow>
            ) : (
              <ul className="space-y-2">
                {customer.vehicleInterests.map((vi) => (
                  <li key={vi.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3.5 py-2.5">
                    <div>
                      <p className="text-[13px] font-medium text-[var(--text)]">
                        {vi.vehicle ? `${vi.vehicle.year} ${vi.vehicle.make} ${vi.vehicle.model} ${vi.vehicle.trim ?? ""}` : [vi.year, vi.make, vi.model, vi.trim].filter(Boolean).join(" ")}
                      </p>
                      {vi.vehicle && <p className="text-[11.5px] text-[var(--text-faint)]">#{vi.vehicle.stockNumber} · {vi.vehicle.condition} · {formatCurrency(vi.vehicle.internetPrice ?? vi.vehicle.sellingPrice)}</p>}
                    </div>
                    <Badge variant={vi.interestLevel === "STRONG" ? "hot" : vi.interestLevel === "PURCHASED" ? "sold" : "neutral"}>{vi.interestLevel}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {/* Trade-ins */}
          <SectionCard title="Trade-In">
            {customer.tradeIns.length === 0 ? (
              <EmptyRow>No trade-in on file.</EmptyRow>
            ) : (
              <ul className="space-y-2">
                {customer.tradeIns.map((t) => {
                  const equity = t.estimatedValue - t.payoff;
                  return (
                    <li key={t.id} className="rounded-lg border border-[var(--border)] px-3.5 py-2.5">
                      <div className="flex items-center justify-between">
                        <p className="text-[13px] font-medium text-[var(--text)]">{[t.year, t.make, t.model, t.trim].filter(Boolean).join(" ") || "Trade vehicle"}</p>
                        <Badge variant={t.appraisalStatus === "ACCEPTED" ? "sold" : "neutral"}>{optionLabel(APPRAISAL_STATUSES, t.appraisalStatus)}</Badge>
                      </div>
                      <p className="mt-1 text-[11.5px] text-[var(--text-muted)]">
                        {t.mileage ? `${t.mileage.toLocaleString()} mi · ` : ""}Payoff {formatCurrency(t.payoff)} · Est. value {formatCurrency(t.estimatedValue)} ·{" "}
                        <span className={equity >= 0 ? "font-semibold text-emerald-600" : "font-semibold text-red-600"}>
                          {equity >= 0 ? "Equity" : "Negative equity"} {formatCurrency(Math.abs(equity))}
                        </span>
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>

          {/* Follow-ups */}
          <SectionCard title="Follow-Ups">
            <FollowUpsSection followUps={customer.followUps} />
          </SectionCard>

          {/* Appointments */}
          <SectionCard title="Appointments">
            {customer.appointments.length === 0 ? (
              <EmptyRow>No appointments scheduled.</EmptyRow>
            ) : (
              <ul className="space-y-2">
                {customer.appointments.map((a) => (
                  <li key={a.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3.5 py-2.5">
                    <div>
                      <p className="text-[13px] font-medium text-[var(--text)]">{a.type.replace(/_/g, " ")}{a.vehicle ? ` · ${a.vehicle.year} ${a.vehicle.make} ${a.vehicle.model}` : ""}</p>
                      <p className="text-[11.5px] text-[var(--text-faint)]">{formatDate(a.date)} at {formatTime12h(a.time)} · {a.salesperson.firstName} {a.salesperson.lastName}</p>
                    </div>
                    <Badge variant={a.status === "NO_SHOW" ? "overdue" : a.status === "COMPLETED" || a.status === "SHOWED" ? "sold" : "appointment"}>{optionLabel(APPOINTMENT_STATUSES, a.status)}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {/* Test drives */}
          <SectionCard title="Test Drives">
            {customer.testDrives.length === 0 ? (
              <EmptyRow>No test drives logged.</EmptyRow>
            ) : (
              <ul className="space-y-2">
                {customer.testDrives.map((t) => (
                  <li key={t.id} className="rounded-lg border border-[var(--border)] px-3.5 py-2.5">
                    <p className="text-[13px] font-medium text-[var(--text)]">{t.vehicle.year} {t.vehicle.make} {t.vehicle.model}</p>
                    <p className="text-[11.5px] text-[var(--text-faint)]">{formatDate(t.date)} · {t.salesperson.firstName} {t.salesperson.lastName}{t.customerReaction ? ` · Reaction: ${t.customerReaction}` : ""}</p>
                    {t.nextStep && <p className="mt-1 text-[12px] text-[var(--text-muted)]">Next step: {t.nextStep}</p>}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {/* Offers */}
          <SectionCard title="Offers">
            {customer.offers.length === 0 ? (
              <EmptyRow>No offers on file.</EmptyRow>
            ) : (
              <ul className="space-y-2">
                {customer.offers.map((o) => (
                  <li key={o.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3.5 py-2.5">
                    <div>
                      <p className="text-[13px] font-medium text-[var(--text)]">{o.vehicle ? `${o.vehicle.year} ${o.vehicle.make} ${o.vehicle.model}` : "Vehicle"} · {formatCurrency(o.offerPrice)}</p>
                      <p className="text-[11.5px] text-[var(--text-faint)]">{o.monthlyPayment ? `${formatCurrency(o.monthlyPayment)}/mo · ` : ""}{o.term ? `${o.term} mo term` : ""}</p>
                    </div>
                    <Badge variant={o.status === "ACCEPTED" ? "sold" : "neutral"}>{optionLabel(OFFER_STATUSES, o.status)}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {/* Sales history */}
          <SectionCard title="Sales History">
            {customer.sales.length === 0 ? (
              <EmptyRow>No completed sales yet.</EmptyRow>
            ) : (
              <ul className="space-y-2">
                {customer.sales.map((s) => (
                  <li key={s.id} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5">
                    <p className="text-[13px] font-semibold text-emerald-800">{s.vehicle.year} {s.vehicle.make} {s.vehicle.model} — {formatCurrency(s.salePrice)}</p>
                    <p className="text-[11.5px] text-emerald-700">{formatDate(s.saleDate)} · {optionLabel(FINANCE_TYPES, s.financeType)} · {s.salesperson.firstName} {s.salesperson.lastName}</p>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {/* Tasks */}
          <SectionCard title="Tasks">
            {customer.tasks.length === 0 ? (
              <EmptyRow>No tasks yet.</EmptyRow>
            ) : (
              <ul className="space-y-2">
                {customer.tasks.map((t) => (
                  <li key={t.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3.5 py-2.5">
                    <div>
                      <p className="text-[13px] font-medium text-[var(--text)]">{t.title}</p>
                      <p className="text-[11.5px] text-[var(--text-faint)]">Due {formatDate(t.dueDate)}{t.dueTime ? ` at ${formatTime12h(t.dueTime)}` : ""} · {t.assignee.firstName} {t.assignee.lastName}</p>
                    </div>
                    <Badge variant={t.status === "COMPLETED" ? "sold" : t.status === "CANCELLED" ? "lost" : "neutral"}>{optionLabel(TASK_STATUSES, t.status)}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {/* Communications */}
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
                    <p className="mt-1 text-[11px] text-[var(--text-faint)]">Logged by {c.actor.firstName} {c.actor.lastName}</p>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {/* Notes */}
          <SectionCard title="Notes">
            {customer.notes.length === 0 ? (
              <EmptyRow>No notes yet.</EmptyRow>
            ) : (
              <ul className="space-y-2">
                {customer.notes.map((n) => (
                  <li key={n.id} className="rounded-lg border border-[var(--border)] px-3.5 py-2.5">
                    <p className="text-[13px] text-[var(--text)]">{n.body}</p>
                    <p className="mt-1 text-[11px] text-[var(--text-faint)]">{n.author.firstName} {n.author.lastName} · {formatTimeAgo(n.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        {/* Right column: timeline */}
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

function EditCustomerLink({ id }: { id: string }) {
  return (
    <Link href={`/customers/${id}/edit`} className="text-xs font-semibold text-[var(--brand)] hover:underline">
      Edit
    </Link>
  );
}
