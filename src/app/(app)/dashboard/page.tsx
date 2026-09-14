import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarClock,
  CalendarDays,
  Radar,
  Car,
  CarFront,
  Wrench,
  UserPlus,
  PhoneMissed,
  FileText,
  BadgeCheck,
  DollarSign,
  TrendingUp,
  Wallet,
  Sparkles,
  Star,
} from "lucide-react";
import { requireScope } from "@/lib/queries/scope";
import { getDashboardMetrics, getTodaysOperations, getHighValueLeads, getTasksDueToday, getMaintenanceAlerts } from "@/lib/queries/dashboard";
import { ensureFollowUpsFresh } from "@/lib/queries/followups";
import { StatCard } from "@/components/dashboard/StatCard";
import { OperationsRow } from "@/components/dashboard/OperationsRow";
import { VipLeadRow } from "@/components/dashboard/VipLeadRow";
import { TaskRow } from "@/components/dashboard/TaskRow";
import { formatCurrency, formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  const scope = await requireScope();
  if (scope.role === "DRIVER") redirect("/driver");
  await ensureFollowUpsFresh();
  const [metrics, operations, vipLeads, tasks, maintenance, user] = await Promise.all([
    getDashboardMetrics(scope),
    getTodaysOperations(),
    getHighValueLeads(scope, 6),
    getTasksDueToday(scope, 8),
    getMaintenanceAlerts(4),
    prisma.user.findUnique({ where: { id: scope.userId } }),
  ]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const stats = [
    { label: "Today's Reservations", value: metrics.todaysReservations, icon: CalendarClock, href: "/bookings", tone: "default" as const },
    { label: "Upcoming Reservations", value: metrics.upcomingReservations, icon: CalendarDays, href: "/bookings", tone: "default" as const },
    { label: "Active Trips", value: metrics.activeTrips, icon: Radar, href: "/operations", tone: "info" as const },
    { label: "Available Vehicles", value: metrics.availableVehicles, icon: Car, href: "/fleet", tone: "success" as const },
    { label: "Vehicles Out", value: metrics.vehiclesOut, icon: CarFront, href: "/fleet", tone: "warning" as const },
    { label: "Needs Maintenance", value: metrics.vehiclesMaintenance, icon: Wrench, href: "/fleet", tone: "danger" as const },
    { label: "New Leads Today", value: metrics.newLeads, icon: UserPlus, href: "/leads", tone: "default" as const },
    { label: "Uncontacted Leads", value: metrics.uncontactedLeads, icon: PhoneMissed, href: "/leads", tone: "danger" as const },
    { label: "Quotes Awaiting Response", value: metrics.quotesAwaiting, icon: FileText, href: "/quotes", tone: "warning" as const },
    { label: "Confirmed Bookings", value: metrics.confirmedBookings, icon: BadgeCheck, href: "/bookings", tone: "success" as const },
    { label: "Revenue Today", value: formatCurrency(metrics.revenueToday), icon: DollarSign, href: "/analytics", tone: "success" as const },
    { label: "Revenue This Week", value: formatCurrency(metrics.revenueWeek), icon: TrendingUp, href: "/analytics", tone: "success" as const },
    { label: "Revenue This Month", value: formatCurrency(metrics.revenueMonth), icon: TrendingUp, href: "/analytics", tone: "success" as const },
    { label: "Outstanding Payments", value: formatCurrency(metrics.outstandingPayments), icon: Wallet, href: "/payments", tone: "warning" as const },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-4xl font-medium leading-tight text-[var(--text)]">
          {greeting}, <span className="text-gradient-gold">{user?.firstName ?? "there"}</span>.
        </h1>
        <p className="text-[14px] text-[var(--text-muted)]">Here&rsquo;s what&rsquo;s happening with Stratos today — {formatDate(new Date(), "EEEE, MMMM d")}.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
              <div>
                <h2 className="font-display text-xl font-medium text-[var(--text)]">Today&rsquo;s Operations</h2>
                <p className="text-[12px] text-[var(--text-muted)]">Every reservation moving through the fleet today, in order.</p>
              </div>
              <Link href="/operations" className="text-xs font-semibold text-[var(--brand-bright)] hover:underline">Operations board</Link>
            </div>
            <div className="space-y-0.5 p-3">
              {operations.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-12 text-center">
                  <Sparkles className="text-[var(--brand-bright)]" size={22} />
                  <p className="text-sm font-medium text-[var(--text)]">Nothing scheduled today</p>
                  <p className="text-xs text-[var(--text-muted)]">New reservations will appear here as they come in.</p>
                </div>
              )}
              {operations.map((b) => (
                <OperationsRow key={b.id} booking={b} />
              ))}
            </div>
          </section>

          <section className="card">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
              <h2 className="font-display text-xl font-medium text-[var(--text)]">Your Tasks Today</h2>
              <Link href="/tasks" className="text-xs font-semibold text-[var(--brand-bright)] hover:underline">View all tasks</Link>
            </div>
            <div className="space-y-0.5 p-3">
              {tasks.length === 0 && <p className="py-8 text-center text-sm text-[var(--text-muted)]">You&rsquo;re all caught up — nothing due today.</p>}
              {tasks.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="card">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
              <div className="flex items-center gap-1.5">
                <Star size={15} className="text-[var(--brand-bright)]" />
                <h2 className="font-display text-lg font-medium text-[var(--text)]">VIP &amp; High-Value Leads</h2>
              </div>
              <Link href="/leads" className="text-xs font-semibold text-[var(--brand-bright)] hover:underline">See all</Link>
            </div>
            <div>
              {vipLeads.length === 0 && <p className="px-5 py-8 text-center text-sm text-[var(--text-muted)]">No VIP leads flagged right now.</p>}
              {vipLeads.map((l, i) => (
                <VipLeadRow key={l.id} lead={l} rank={i + 1} />
              ))}
            </div>
          </section>

          {maintenance.length > 0 && (
            <section className="card">
              <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
                <div className="flex items-center gap-1.5">
                  <Wrench size={15} className="text-[var(--warning)]" />
                  <h2 className="font-display text-lg font-medium text-[var(--text)]">Maintenance</h2>
                </div>
                <Link href="/fleet" className="text-xs font-semibold text-[var(--brand-bright)] hover:underline">Fleet</Link>
              </div>
              <div className="divide-y divide-[var(--border)]">
                {maintenance.map((m) => (
                  <Link key={m.id} href={`/fleet/${m.vehicleId}`} className="flex items-center justify-between px-5 py-3 hover:bg-white/[0.03]">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-[var(--text)]">{m.vehicle.name}</p>
                      <p className="truncate text-[11.5px] text-[var(--text-muted)]">{m.description}</p>
                    </div>
                    <span className="shrink-0 text-[11px] text-[var(--text-faint)]">{m.scheduledDate ? formatDate(m.scheduledDate, "MMM d") : "—"}</span>
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
