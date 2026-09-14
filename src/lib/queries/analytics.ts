import { prisma } from "@/lib/prisma";
import { leadScopeWhere, type Scope } from "@/lib/queries/scope";
import { format } from "date-fns";

export async function getAnalyticsData(scope: Scope, from: Date, to: Date) {
  const dateRange = { gte: from, lte: to };
  const leadWhere = leadScopeWhere(scope);

  const [leadsInRange, bookingsInRange, completedPayments, cancelledCount, totalBookingsCount, fleetSize, sourceBreakdown] = await Promise.all([
    prisma.lead.findMany({ where: { ...leadWhere, createdAt: dateRange }, select: { id: true, isVip: true } }),
    prisma.booking.findMany({
      where: { date: dateRange, bookingStatus: { notIn: ["CANCELLED"] } },
      include: { vehicle: true, driver: true, customer: true },
    }),
    prisma.payment.findMany({ where: { status: "SUCCEEDED", processedAt: dateRange }, select: { amount: true } }),
    prisma.booking.count({ where: { date: dateRange, bookingStatus: "CANCELLED" } }),
    prisma.booking.count({ where: { date: dateRange } }),
    prisma.vehicle.count({ where: { isActive: true } }),
    prisma.lead.groupBy({ by: ["sourceId"], where: { ...leadWhere, createdAt: dateRange }, _count: true }),
  ]);

  const totalRevenue = completedPayments.reduce((s, p) => s + p.amount, 0);
  const bookingsCount = bookingsInRange.length;
  const avgBookingValue = bookingsCount ? bookingsInRange.reduce((s, b) => s + b.totalPrice, 0) / bookingsCount : 0;
  const conversionRate = leadsInRange.length ? Math.round((bookingsCount / leadsInRange.length) * 100) : 0;
  const cancellationRate = totalBookingsCount ? Math.round((cancelledCount / totalBookingsCount) * 100) : 0;
  const vipLeadsCount = leadsInRange.filter((l) => l.isVip).length;

  // Revenue by vehicle
  const byVehicle = new Map<string, { count: number; revenue: number }>();
  for (const b of bookingsInRange) {
    const name = b.vehicle?.name ?? "Unassigned";
    const e = byVehicle.get(name) ?? { count: 0, revenue: 0 };
    e.count++;
    e.revenue += b.totalPrice;
    byVehicle.set(name, e);
  }
  const revenueByVehicle = [...byVehicle.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.revenue - a.revenue).slice(0, 8);

  // Revenue by service
  const byService = new Map<string, { count: number; revenue: number }>();
  for (const b of bookingsInRange) {
    const name = b.serviceType.replace(/_/g, " ");
    const e = byService.get(name) ?? { count: 0, revenue: 0 };
    e.count++;
    e.revenue += b.totalPrice;
    byService.set(name, e);
  }
  const revenueByService = [...byService.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.revenue - a.revenue);

  // Revenue by driver
  const byDriver = new Map<string, { count: number; revenue: number }>();
  for (const b of bookingsInRange) {
    if (!b.driver) continue;
    const name = `${b.driver.firstName} ${b.driver.lastName}`;
    const e = byDriver.get(name) ?? { count: 0, revenue: 0 };
    e.count++;
    e.revenue += b.totalPrice;
    byDriver.set(name, e);
  }
  const revenueByDriver = [...byDriver.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.revenue - a.revenue);

  // Revenue by lead source (via bookings that trace back to a lead)
  const sources = await prisma.leadSource.findMany();
  const leadsBySource = sourceBreakdown.map((s) => ({ name: sources.find((src) => src.id === s.sourceId)?.name ?? "Unknown", count: s._count })).sort((a, b) => b.count - a.count);

  // Repeat customers: customers with >1 completed booking, all time
  const customerBookingCounts = await prisma.booking.groupBy({ by: ["customerId"], where: { bookingStatus: "COMPLETED" }, _count: true });
  const repeatCustomers = customerBookingCounts.filter((c) => c._count > 1).length;

  const vipCustomers = await prisma.customer.count({ where: { tier: { in: ["VIP", "VVIP"] } } });

  // Fleet utilization: % of vehicle-days booked over the range (approximation using distinct vehicle-date pairs)
  const bookedVehicleDays = new Set(bookingsInRange.filter((b) => b.vehicleId).map((b) => `${b.vehicleId}-${format(b.date, "yyyy-MM-dd")}`)).size;
  const daysInRange = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000));
  const fleetUtilization = fleetSize > 0 ? Math.round((bookedVehicleDays / (fleetSize * daysInRange)) * 100) : 0;

  // Revenue trend (daily)
  const trendMap = new Map<string, number>();
  for (const p of await prisma.payment.findMany({ where: { status: "SUCCEEDED", processedAt: dateRange }, select: { amount: true, processedAt: true } })) {
    if (!p.processedAt) continue;
    const key = format(p.processedAt, "MMM d");
    trendMap.set(key, (trendMap.get(key) ?? 0) + p.amount);
  }
  const revenueTrend = [...trendMap.entries()].map(([date, revenue]) => ({ date, revenue }));

  return {
    totalRevenue,
    bookingsCount,
    leadsCount: leadsInRange.length,
    conversionRate,
    avgBookingValue,
    cancellationRate,
    vipLeadsCount,
    revenueByVehicle,
    revenueByService,
    revenueByDriver,
    leadsBySource,
    repeatCustomers,
    vipCustomers,
    fleetUtilization,
    fleetSize,
    revenueTrend,
  };
}
