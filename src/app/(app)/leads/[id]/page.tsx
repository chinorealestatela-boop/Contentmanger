import Link from "next/link";
import { notFound } from "next/navigation";
import { Sparkles, MapPin, Users, Clock, Car, DollarSign } from "lucide-react";
import { getLeadById } from "@/lib/queries/leads";
import { prisma } from "@/lib/prisma";
import { Avatar } from "@/components/ui/Avatar";
import { TierBadge, StatusBadge } from "@/components/ui/Badge";
import { QuickActions } from "@/components/actions/QuickActions";
import { ActivityTimeline } from "@/components/customers/ActivityTimeline";
import { LeadStageSelect, VipToggleButton, ParseWithAiButton, LeadHeaderActions } from "@/components/leads/LeadActions";
import { SectionCard, EmptyRow } from "@/components/ui/SectionCard";
import { optionLabel, SERVICE_TYPES, QUOTE_STATUSES, BOOKING_STATUSES } from "@/lib/constants";
import { formatCurrency, formatDate, formatTime12h, formatTimeAgo, fullName } from "@/lib/format";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [lead, stages, lostReasons] = await Promise.all([
    getLeadById(id),
    prisma.pipelineStage.findMany({ where: { active: true }, orderBy: { order: "asc" } }),
    prisma.lostReason.findMany({ where: { active: true }, orderBy: { order: "asc" } }),
  ]);
  if (!lead) notFound();

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3.5">
          <Avatar firstName={lead.customer.firstName} lastName={lead.customer.lastName} size="lg" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/customers/${lead.customer.id}`} className="font-display text-2xl font-medium text-[var(--text)] hover:text-[var(--brand-bright)]">
                {fullName(lead.customer)}
              </Link>
              {lead.customer.tier !== "STANDARD" && <TierBadge tier={lead.customer.tier} />}
            </div>
            <p className="mt-0.5 text-[13px] text-[var(--text-muted)]">
              {lead.customer.phone ?? "No phone"} {lead.customer.email ? `· ${lead.customer.email}` : ""} {lead.customer.company ? `· ${lead.customer.company}` : ""}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <LeadStageSelect leadId={lead.id} stageId={lead.stageId} stages={stages} />
              <VipToggleButton leadId={lead.id} isVip={lead.isVip} />
              <span className="badge badge-gold">score {lead.score}</span>
            </div>
          </div>
        </div>
        <LeadHeaderActions leadId={lead.id} customerId={lead.customer.id} status={lead.status} lostReasons={lostReasons} />
      </div>

      <QuickActions customerId={lead.customer.id} leadId={lead.id} />

      {lead.aiSummary && (
        <div className="card flex items-start gap-3 border-[var(--brand-line)] bg-[var(--brand-soft)] p-4">
          <Sparkles size={16} className="mt-0.5 shrink-0 text-[var(--brand-bright)]" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--brand-bright)]">AI Summary</p>
            <p className="mt-1 text-[13.5px] leading-relaxed text-[var(--text)]">{lead.aiSummary}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <SectionCard title="Trip Details" action={<ParseWithAiButton leadId={lead.id} hasRawInquiry={!!lead.rawInquiry} />}>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Detail icon={Car} label="Service" value={lead.serviceRequested ? optionLabel(SERVICE_TYPES, lead.serviceRequested) : "—"} />
              <Detail icon={MapPin} label="Pickup" value={lead.pickupLocation ?? "—"} />
              <Detail icon={MapPin} label="Drop-off" value={lead.dropoffLocation ?? "—"} />
              <Detail icon={Clock} label="Date & Time" value={lead.serviceDate ? `${formatDate(lead.serviceDate)}${lead.pickupTime ? ` · ${formatTime12h(lead.pickupTime)}` : ""}` : "—"} />
              <Detail icon={Users} label="Passengers" value={lead.passengers?.toString() ?? "—"} />
              <Detail icon={Car} label="Vehicle Requested" value={lead.vehicle?.name ?? lead.vehicleRequested ?? "—"} />
              <Detail icon={DollarSign} label="Estimated Price" value={lead.estimatedPrice ? formatCurrency(lead.estimatedPrice) : "—"} />
              <Detail icon={DollarSign} label="Client Budget" value={lead.budget ? formatCurrency(lead.budget) : "—"} />
              <Detail icon={Clock} label="Service Type" value={lead.chauffeurRequested ? "Chauffeured" : "Self-Drive Rental"} />
            </div>
            {lead.rawInquiry && (
              <div className="mt-4 rounded-lg border border-dashed border-[var(--border)] bg-white/[0.02] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">Original inquiry</p>
                <p className="mt-1 text-[13px] italic text-[var(--text-muted)]">&ldquo;{lead.rawInquiry}&rdquo;</p>
              </div>
            )}
            {lead.notes && (
              <div className="mt-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">Notes</p>
                <p className="mt-1 whitespace-pre-wrap text-[13px] text-[var(--text)]">{lead.notes}</p>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Quotes &amp; Bookings">
            {lead.quotes.length === 0 && lead.bookings.length === 0 && <EmptyRow>No quotes or bookings yet for this lead.</EmptyRow>}
            <div className="space-y-2">
              {lead.quotes.map((q) => (
                <Link key={q.id} href={`/quotes/${q.id}`} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3.5 py-2.5 hover:bg-white/[0.03]">
                  <span className="text-[13px] font-medium text-[var(--text)]">Quote {q.quoteNumber}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] text-[var(--text-muted)]">{formatCurrency(q.totalPrice)}</span>
                    <StatusBadge options={QUOTE_STATUSES} value={q.status} />
                  </div>
                </Link>
              ))}
              {lead.bookings.map((b) => (
                <Link key={b.id} href={`/bookings/${b.id}`} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3.5 py-2.5 hover:bg-white/[0.03]">
                  <span className="text-[13px] font-medium text-[var(--text)]">Booking {b.bookingNumber}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] text-[var(--text-muted)]">{formatDate(b.date)}</span>
                    <StatusBadge options={BOOKING_STATUSES} value={b.bookingStatus} />
                  </div>
                </Link>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Activity">
            <ActivityTimeline activities={lead.activities} />
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title="Lead Info">
            <dl className="space-y-2.5 text-[13px]">
              <Row label="Source" value={lead.source?.name ?? "Unknown"} />
              <Row label="Assigned To" value={lead.assignee ? fullName(lead.assignee) : "Unassigned"} />
              <Row label="Status" value={lead.status} />
              <Row label="Created" value={formatTimeAgo(lead.createdAt)} />
              <Row label="Last Contacted" value={lead.lastContactedAt ? formatTimeAgo(lead.lastContactedAt) : "Never"} />
              <Row label="Next Follow-Up" value={lead.nextFollowUpAt ? formatDate(lead.nextFollowUpAt) : "—"} />
              {lead.lostReason && <Row label="Lost Reason" value={lead.lostReason.name} />}
            </dl>
          </SectionCard>

          <SectionCard title="Open Tasks">
            {lead.tasks.filter((t) => t.status === "PENDING").length === 0 && <EmptyRow>No open tasks.</EmptyRow>}
            <div className="space-y-2">
              {lead.tasks.filter((t) => t.status === "PENDING").map((t) => (
                <div key={t.id} className="rounded-lg border border-[var(--border)] px-3 py-2">
                  <p className="text-[12.5px] font-medium text-[var(--text)]">{t.title}</p>
                  <p className="text-[11px] text-[var(--text-faint)]">Due {formatDate(t.dueDate)}</p>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function Detail({ icon: Icon, label, value }: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon size={14} className="mt-0.5 shrink-0 text-[var(--text-faint)]" />
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">{label}</p>
        <p className="truncate text-[13px] text-[var(--text)]">{value}</p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-[var(--text-muted)]">{label}</dt>
      <dd className="truncate text-right font-medium text-[var(--text)]">{value}</dd>
    </div>
  );
}
