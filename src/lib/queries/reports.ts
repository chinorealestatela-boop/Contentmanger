import { prisma } from "@/lib/prisma";
import { customerScopeWhere, leadScopeWhere, type Scope } from "@/lib/queries/scope";

export async function getReportsData(scope: Scope, from: Date, to: Date) {
  const leadWhere = leadScopeWhere(scope);
  const dateRange = { gte: from, lte: to };

  const [
    leadsInRange,
    contactedLeadIds,
    appointmentsInRange,
    testDrivesInRange,
    creditAppLeads,
    salesInRange,
    lostInRange,
    lostReasonBreakdown,
    tasksDueInRange,
    stageFunnel,
    sourceBreakdown,
  ] = await Promise.all([
    prisma.lead.findMany({ where: { ...leadWhere, dateReceived: dateRange }, select: { id: true, dateReceived: true, lastContactedAt: true } }),
    prisma.communication.findMany({
      where: { customer: customerScopeWhere(scope), occurredAt: dateRange },
      select: { customerId: true },
      distinct: ["customerId"],
    }),
    prisma.appointment.findMany({
      where: { salespersonId: scope.viewAll ? undefined : scope.userId, date: dateRange },
      select: { status: true },
    }),
    prisma.testDrive.count({ where: { customer: customerScopeWhere(scope), date: dateRange } }),
    prisma.lead.count({ where: { ...leadWhere, creditAppStatus: { not: "NOT_STARTED" }, dateReceived: dateRange } }),
    prisma.sale.findMany({
      where: { customer: customerScopeWhere(scope), saleDate: dateRange },
      include: { vehicle: true, lead: { include: { source: true } } },
    }),
    prisma.lead.count({ where: { ...leadWhere, status: "LOST", lostAt: dateRange } }),
    prisma.lead.groupBy({ by: ["lostReasonId"], where: { ...leadWhere, status: "LOST", lostAt: dateRange }, _count: true }),
    prisma.task.findMany({
      where: { assigneeId: scope.viewAll ? undefined : scope.userId, dueDate: dateRange, type: { in: ["FOLLOW_UP", "CALL", "TEXT", "EMAIL"] } },
      select: { status: true },
    }),
    prisma.lead.groupBy({ by: ["stageId"], where: { ...leadWhere, status: "ACTIVE" }, _count: true }),
    prisma.lead.groupBy({ by: ["sourceId"], where: { ...leadWhere, dateReceived: dateRange }, _count: true }),
  ]);

  // Contact rate
  const contactedCount = contactedLeadIds.length;
  const contactRate = leadsInRange.length ? Math.round((contactedCount / leadsInRange.length) * 100) : 0;

  // Show rate
  const showed = appointmentsInRange.filter((a) => a.status === "SHOWED" || a.status === "COMPLETED").length;
  const noShow = appointmentsInRange.filter((a) => a.status === "NO_SHOW").length;
  const showRate = showed + noShow > 0 ? Math.round((showed / (showed + noShow)) * 100) : 0;

  // Close rate
  const closeRate = leadsInRange.length ? Math.round((salesInRange.length / leadsInRange.length) * 100) : 0;
  const totalRevenue = salesInRange.reduce((sum, s) => sum + s.salePrice, 0);

  // Follow-up completion
  const completedTasks = tasksDueInRange.filter((t) => t.status === "COMPLETED").length;
  const relevantTasks = tasksDueInRange.filter((t) => t.status !== "CANCELLED").length;
  const followUpCompletionRate = relevantTasks ? Math.round((completedTasks / relevantTasks) * 100) : 0;

  // Avg response time (hours between lead received and first contact)
  const responseTimes = leadsInRange
    .filter((l) => l.lastContactedAt)
    .map((l) => (l.lastContactedAt!.getTime() - l.dateReceived.getTime()) / 3600000)
    .filter((h) => h >= 0);
  const avgResponseHours = responseTimes.length ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : null;

  // Lost reasons with names
  const lostReasons = await prisma.lostReason.findMany();
  const lostReasonChart = lostReasonBreakdown
    .map((r) => ({ name: lostReasons.find((lr) => lr.id === r.lostReasonId)?.name ?? "Unspecified", count: r._count }))
    .sort((a, b) => b.count - a.count);

  // Sales by source
  const salesBySourceMap = new Map<string, { count: number; revenue: number }>();
  for (const s of salesInRange) {
    const name = s.lead?.source?.name ?? "Unknown";
    const entry = salesBySourceMap.get(name) ?? { count: 0, revenue: 0 };
    entry.count++;
    entry.revenue += s.salePrice;
    salesBySourceMap.set(name, entry);
  }
  const salesBySource = Array.from(salesBySourceMap.entries()).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.revenue - a.revenue);

  // Sales by vehicle (make)
  const salesByVehicleMap = new Map<string, { count: number; revenue: number }>();
  for (const s of salesInRange) {
    const name = `${s.vehicle.make} ${s.vehicle.model}`;
    const entry = salesByVehicleMap.get(name) ?? { count: 0, revenue: 0 };
    entry.count++;
    entry.revenue += s.salePrice;
    salesByVehicleMap.set(name, entry);
  }
  const salesByVehicle = Array.from(salesByVehicleMap.entries()).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.revenue - a.revenue);

  // Stage funnel
  const stages = await prisma.pipelineStage.findMany({ orderBy: { order: "asc" } });
  const stageFunnelChart = stages.map((s) => ({
    name: s.name,
    count: stageFunnel.find((f) => f.stageId === s.id)?._count ?? 0,
    color: s.color,
  }));

  // Leads by source
  const sources = await prisma.leadSource.findMany();
  const leadsBySource = sourceBreakdown
    .map((s) => ({ name: sources.find((src) => src.id === s.sourceId)?.name ?? "Unknown", count: s._count }))
    .sort((a, b) => b.count - a.count);

  return {
    leadsCount: leadsInRange.length,
    contactedCount,
    contactRate,
    appointmentsCount: appointmentsInRange.length,
    showed,
    noShow,
    showRate,
    testDrivesCount: testDrivesInRange,
    creditAppsCount: creditAppLeads,
    salesCount: salesInRange.length,
    totalRevenue,
    closeRate,
    lostCount: lostInRange,
    lostReasonChart,
    followUpCompletionRate,
    completedTasks,
    relevantTasks,
    avgResponseHours,
    salesBySource,
    salesByVehicle,
    stageFunnelChart,
    leadsBySource,
  };
}
