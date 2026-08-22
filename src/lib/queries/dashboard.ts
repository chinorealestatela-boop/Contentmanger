import { prisma } from "@/lib/prisma";
import { customerScopeWhere, leadScopeWhere, type Scope } from "@/lib/queries/scope";
import { startOfDay, endOfDay, startOfTomorrow, endOfTomorrow } from "date-fns";
import { getCalendarEvents, type CalendarEvent } from "@/lib/queries/calendar";

function today() {
  return { gte: startOfDay(new Date()), lte: endOfDay(new Date()) };
}
function tomorrow() {
  return { gte: startOfTomorrow(), lte: endOfTomorrow() };
}

export async function getDashboardMetrics(scope: Scope) {
  const leadWhere = leadScopeWhere(scope);
  const now = new Date();
  const todayRange = today();

  const [
    newLeads,
    activeLeads,
    hotLeads,
    followUpsDue,
    overdueFollowUps,
    appointmentsToday,
    appointmentsTomorrow,
    testDrives,
    negotiations,
    creditApplications,
    sold,
    lost,
    totalCustomers,
    followUpCallsDueToday,
    salesThisMonth,
    totalLeads,
  ] = await Promise.all([
    prisma.lead.count({ where: { ...leadWhere, dateReceived: todayRange } }),
    prisma.lead.count({ where: { ...leadWhere, status: "ACTIVE" } }),
    prisma.lead.count({ where: { ...leadWhere, status: "ACTIVE", temperature: "HOT" } }),
    prisma.lead.count({ where: { ...leadWhere, status: "ACTIVE", nextFollowUpAt: todayRange } }),
    prisma.lead.count({ where: { ...leadWhere, status: "ACTIVE", nextFollowUpAt: { lt: startOfDay(now) } } }),
    prisma.appointment.count({ where: { salespersonId: scope.viewAll ? undefined : scope.userId, date: todayRange, status: { notIn: ["CANCELLED"] } } }),
    prisma.appointment.count({ where: { salespersonId: scope.viewAll ? undefined : scope.userId, date: tomorrow(), status: { notIn: ["CANCELLED"] } } }),
    prisma.lead.count({ where: { ...leadWhere, status: "ACTIVE", stage: { name: "Test Drive" } } }),
    prisma.lead.count({ where: { ...leadWhere, status: "ACTIVE", stage: { name: "Negotiating" } } }),
    prisma.lead.count({ where: { ...leadWhere, status: "ACTIVE", OR: [{ stage: { name: "Credit Application" } }, { creditAppStatus: { in: ["SUBMITTED", "PENDING"] } }] } }),
    prisma.lead.count({ where: { ...leadWhere, status: "SOLD" } }),
    prisma.lead.count({ where: { ...leadWhere, status: "LOST" } }),
    prisma.customer.count({ where: customerScopeWhere(scope) }),
    prisma.followUp.count({ where: { assigneeId: scope.viewAll ? undefined : scope.userId, status: "SCHEDULED", followUpDate: todayRange } }),
    prisma.sale.count({ where: { salespersonId: scope.viewAll ? undefined : scope.userId, saleDate: { gte: new Date(now.getFullYear(), now.getMonth(), 1) } } }),
    prisma.lead.count({ where: leadWhere }),
  ]);

  return {
    newLeads,
    activeLeads,
    hotLeads,
    followUpsDue,
    overdueFollowUps,
    appointmentsToday,
    appointmentsTomorrow,
    testDrives,
    negotiations,
    creditApplications,
    sold,
    lost,
    totalCustomers,
    followUpCallsDueToday,
    salesThisMonth,
    totalLeads,
  };
}

export type ActionItem = {
  id: string;
  customerId: string;
  customerName: string;
  leadId: string | null;
  vehicle: string | null;
  temperature: string;
  stage: string | null;
  lastContact: Date | null;
  nextAction: string;
  dueDate: Date;
  dueTime: string | null;
  overdue: boolean;
  score: number;
  source: "task" | "follow-up";
};

export async function getActionCenter(scope: Scope, limit = 12): Promise<ActionItem[]> {
  const endToday = endOfDay(new Date());

  const [tasks, leads] = await Promise.all([
    prisma.task.findMany({
      where: {
        assigneeId: scope.viewAll ? undefined : scope.userId,
        status: "PENDING",
        dueDate: { lte: endToday },
      },
      include: {
        customer: true,
        lead: { include: { stage: true } },
      },
      orderBy: [{ dueDate: "asc" }],
    }),
    prisma.lead.findMany({
      where: {
        ...leadScopeWhere(scope),
        status: "ACTIVE",
        nextFollowUpAt: { lte: endToday, not: null },
      },
      include: {
        customer: true,
        stage: true,
        vehicleInterests: { include: { vehicle: true }, take: 1 },
      },
    }),
  ]);

  const now = new Date();
  const byCustomer = new Map<string, ActionItem>();

  const taskCustomerIds = tasks.map((t) => t.customerId).filter((id): id is string => !!id);
  const vehicleInterests = taskCustomerIds.length
    ? await prisma.customerVehicle.findMany({
        where: { customerId: { in: taskCustomerIds }, isPrimary: true },
        include: { vehicle: true },
      })
    : [];
  const vehicleByCustomer = new Map(vehicleInterests.map((vi) => [vi.customerId, vi]));

  for (const t of tasks) {
    if (!t.customer) continue;
    const vi = vehicleByCustomer.get(t.customerId!);
    const item: ActionItem = {
      id: t.id,
      customerId: t.customerId!,
      customerName: `${t.customer.firstName} ${t.customer.lastName}`,
      leadId: t.leadId,
      vehicle: vi ? (vi.vehicle ? `${vi.vehicle.year} ${vi.vehicle.make} ${vi.vehicle.model}` : [vi.year, vi.make, vi.model].filter(Boolean).join(" ")) : null,
      temperature: t.lead?.temperature ?? "COLD",
      stage: t.lead?.stage.name ?? null,
      lastContact: t.lead?.lastContactedAt ?? null,
      nextAction: t.title,
      dueDate: t.dueDate,
      dueTime: t.dueTime,
      overdue: t.dueDate < now,
      score: t.lead?.score ?? 0,
      source: "task",
    };
    const existing = byCustomer.get(item.customerId);
    if (!existing || rank(item) < rank(existing)) byCustomer.set(item.customerId, item);
  }

  for (const l of leads) {
    if (byCustomer.has(l.customerId)) continue; // task already covers this customer
    const vi = l.vehicleInterests[0];
    const item: ActionItem = {
      id: l.id,
      customerId: l.customerId,
      customerName: `${l.customer.firstName} ${l.customer.lastName}`,
      leadId: l.id,
      vehicle: vi ? (vi.vehicle ? `${vi.vehicle.year} ${vi.vehicle.make} ${vi.vehicle.model}` : [vi.year, vi.make, vi.model].filter(Boolean).join(" ")) : null,
      temperature: l.temperature,
      stage: l.stage.name,
      lastContact: l.lastContactedAt,
      nextAction: "Scheduled follow-up",
      dueDate: l.nextFollowUpAt!,
      dueTime: null,
      overdue: l.nextFollowUpAt! < now,
      score: l.score,
      source: "follow-up",
    };
    byCustomer.set(item.customerId, item);
  }

  function rank(item: ActionItem) {
    let r = 0;
    if (item.overdue) r -= 1000;
    r -= item.score;
    return r;
  }

  return Array.from(byCustomer.values())
    .sort((a, b) => rank(a) - rank(b))
    .slice(0, limit);
}

export type HotLeadItem = {
  leadId: string;
  customerId: string;
  customerName: string;
  vehicle: string | null;
  score: number;
  lastContact: Date | null;
  hasAppointment: boolean;
  hasTrade: boolean;
  purchaseTimeframe: string | null;
  nextAction: string;
};

export async function getHotLeads(scope: Scope, limit = 8): Promise<HotLeadItem[]> {
  const leads = await prisma.lead.findMany({
    where: { ...leadScopeWhere(scope), status: "ACTIVE", temperature: "HOT" },
    include: {
      customer: { include: { tradeIns: true, appointments: { where: { date: { gte: new Date() }, status: { notIn: ["CANCELLED", "NO_SHOW"] } } } } },
      vehicleInterests: { include: { vehicle: true }, take: 1 },
    },
    orderBy: { score: "desc" },
    take: limit,
  });

  return leads.map((l) => {
    const vi = l.vehicleInterests[0];
    return {
      leadId: l.id,
      customerId: l.customerId,
      customerName: `${l.customer.firstName} ${l.customer.lastName}`,
      vehicle: vi ? (vi.vehicle ? `${vi.vehicle.year} ${vi.vehicle.make} ${vi.vehicle.model}` : [vi.year, vi.make, vi.model].filter(Boolean).join(" ")) : null,
      score: l.score,
      lastContact: l.lastContactedAt,
      hasAppointment: l.customer.appointments.length > 0,
      hasTrade: l.customer.tradeIns.length > 0,
      purchaseTimeframe: l.purchaseTimeframe,
      nextAction: l.nextFollowUpAt && l.nextFollowUpAt < new Date() ? "Overdue follow-up" : "Follow up",
    };
  });
}

export async function getUpcomingAppointmentsToday(scope: Scope) {
  return prisma.appointment.findMany({
    where: { salespersonId: scope.viewAll ? undefined : scope.userId, date: today(), status: { notIn: ["CANCELLED"] } },
    include: { customer: true, vehicle: true },
    orderBy: { time: "asc" },
  });
}

/** Powers the dashboard's "Upcoming Activities" card — every follow-up
 * call and calendar appointment happening today and tomorrow, in one
 * merged, time-sorted list. */
export async function getUpcomingActivities(scope: Scope): Promise<{ today: CalendarEvent[]; tomorrow: CalendarEvent[] }> {
  const events = await getCalendarEvents(scope, { start: startOfDay(new Date()), end: endOfTomorrow() });
  const todayEnd = endOfDay(new Date());
  return {
    today: events.filter((e) => e.date <= todayEnd),
    tomorrow: events.filter((e) => e.date > todayEnd),
  };
}

export async function getCustomerCountForOwner(scope: Scope) {
  return prisma.customer.count({ where: customerScopeWhere(scope) });
}
