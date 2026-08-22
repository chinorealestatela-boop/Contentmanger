import Link from "next/link";
import {
  UserPlus,
  Flame,
  Clock,
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  Car,
  Handshake,
  Trophy,
  XCircle,
  Users,
  Sparkles,
} from "lucide-react";
import { requireScope } from "@/lib/queries/scope";
import { getDashboardMetrics, getActionCenter, getHotLeads, getUpcomingActivities } from "@/lib/queries/dashboard";
import { ensureFollowUpsFresh, getFollowUpsDueToday } from "@/lib/queries/followups";
import { StatCard } from "@/components/dashboard/StatCard";
import { ActionCard } from "@/components/dashboard/ActionCard";
import { HotLeadRow } from "@/components/dashboard/HotLeadRow";
import { EventRow } from "@/components/calendar/EventRow";
import { formatTime12h } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  const scope = await requireScope();
  await ensureFollowUpsFresh();
  const [metrics, actionItems, hotLeads, upcoming, followUpsDueToday, user] = await Promise.all([
    getDashboardMetrics(scope),
    getActionCenter(scope, 12),
    getHotLeads(scope, 8),
    getUpcomingActivities(scope),
    getFollowUpsDueToday(scope, 5),
    prisma.user.findUnique({ where: { id: scope.userId } }),
  ]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const stats = [
    { label: "Total Leads", value: metrics.totalLeads, icon: UserPlus, href: "/leads", tone: "default" as const },
    { label: "Active Leads", value: metrics.activeLeads, icon: Users, href: "/leads", tone: "default" as const },
    { label: "Customers", value: metrics.totalCustomers, icon: Users, href: "/customers", tone: "default" as const },
    { label: "Hot Leads", value: metrics.hotLeads, icon: Flame, href: "/leads?temperature=HOT", tone: "hot" as const },
    { label: "Follow-Ups Due Today", value: metrics.followUpCallsDueToday, icon: Clock, href: "/calendar?view=today", tone: "warm" as const },
    { label: "Overdue Follow-Ups", value: metrics.overdueFollowUps, icon: AlertTriangle, href: "/tasks?view=overdue", tone: "overdue" as const },
    { label: "Appointments Today", value: metrics.appointmentsToday, icon: CalendarClock, href: "/calendar?view=today", tone: "appointment" as const },
    { label: "Appointments Tomorrow", value: metrics.appointmentsTomorrow, icon: CalendarDays, href: "/calendar", tone: "appointment" as const },
    { label: "Test Drives", value: metrics.testDrives, icon: Car, href: "/pipeline", tone: "default" as const },
    { label: "Negotiations", value: metrics.negotiations, icon: Handshake, href: "/pipeline", tone: "warm" as const },
    { label: "Sales This Month", value: metrics.salesThisMonth, icon: Trophy, href: "/reports", tone: "sold" as const },
    { label: "Lost", value: metrics.lost, icon: XCircle, href: "/lost-leads", tone: "lost" as const },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-[var(--text)]">{greeting}, {user?.firstName ?? "there"}.</h1>
        <p className="text-[13.5px] text-[var(--text-muted)]">Here&rsquo;s who needs you today.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
              <div>
                <h2 className="text-[15px] font-semibold text-[var(--text)]">Today&rsquo;s Actions</h2>
                <p className="text-[12px] text-[var(--text-muted)]">Overdue and due-today items across your book, most urgent first.</p>
              </div>
              <Link href="/tasks" className="text-xs font-semibold text-[var(--brand)] hover:underline">View all tasks</Link>
            </div>
            <div className="space-y-3 p-4">
              {actionItems.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <Sparkles className="text-emerald-500" size={22} />
                  <p className="text-sm font-medium text-[var(--text)]">You&rsquo;re all caught up</p>
                  <p className="text-xs text-[var(--text-muted)]">No overdue or due-today items. Check Hot Leads for a proactive touch.</p>
                </div>
              )}
              {actionItems.map((item) => (
                <ActionCard key={`${item.source}-${item.id}`} item={item} />
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="card">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
              <div className="flex items-center gap-1.5">
                <Flame size={16} className="text-red-500" />
                <h2 className="text-[15px] font-semibold text-[var(--text)]">Hot Leads</h2>
              </div>
              <Link href="/leads?temperature=HOT" className="text-xs font-semibold text-[var(--brand)] hover:underline">See all</Link>
            </div>
            <div>
              {hotLeads.length === 0 && <p className="px-5 py-8 text-center text-sm text-[var(--text-muted)]">No hot leads right now.</p>}
              {hotLeads.map((item, i) => (
                <HotLeadRow key={item.leadId} item={item} rank={i + 1} />
              ))}
            </div>
          </section>

          <section className="card">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
              <div className="flex items-center gap-1.5">
                <CalendarClock size={16} className="text-[var(--appointment)]" />
                <h2 className="text-[15px] font-semibold text-[var(--text)]">Upcoming Activities</h2>
              </div>
              <Link href="/calendar" className="text-xs font-semibold text-[var(--brand)] hover:underline">Full Calendar</Link>
            </div>
            {upcoming.today.length === 0 && upcoming.tomorrow.length === 0 && (
              <p className="px-5 py-8 text-center text-sm text-[var(--text-muted)]">Nothing on the calendar today or tomorrow.</p>
            )}
            {upcoming.today.length > 0 && (
              <div>
                <p className="border-b border-[var(--border)] bg-[var(--bg-subtle)] px-5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">Today</p>
                <div className="divide-y divide-[var(--border)]">
                  {upcoming.today.map((e) => <EventRow key={e.id} event={e} />)}
                </div>
              </div>
            )}
            {upcoming.tomorrow.length > 0 && (
              <div>
                <p className="border-b border-[var(--border)] bg-[var(--bg-subtle)] px-5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">Tomorrow</p>
                <div className="divide-y divide-[var(--border)]">
                  {upcoming.tomorrow.map((e) => <EventRow key={e.id} event={e} />)}
                </div>
              </div>
            )}
          </section>

          {followUpsDueToday.length > 0 && (
            <section className="card border-amber-200">
              <div className="flex items-center justify-between border-b border-amber-200 bg-amber-50 px-5 py-4">
                <div className="flex items-center gap-1.5">
                  <Clock size={16} className="text-amber-600" />
                  <h2 className="text-[15px] font-semibold text-amber-900">Follow-Ups Due Today</h2>
                </div>
                <span className="badge bg-amber-100 text-amber-800">{followUpsDueToday.length}</span>
              </div>
              <div className="divide-y divide-[var(--border)]">
                {followUpsDueToday.map((f) => (
                  <Link key={f.id} href={`/customers/${f.customerId}`} className="flex items-center justify-between px-5 py-3 hover:bg-[var(--bg-subtle)]">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-[var(--text)]">{f.customer.firstName} {f.customer.lastName}</p>
                      <p className="truncate text-[11.5px] text-[var(--text-muted)]">{f.topic}</p>
                    </div>
                    <span className="shrink-0 text-[12px] font-semibold text-[var(--text)]">{formatTime12h(f.followUpTime)}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
