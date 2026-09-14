import { prisma } from "@/lib/prisma";
import type { Scope } from "@/lib/queries/scope";
import { followUpDateTime } from "@/lib/followups";

/** Unified shape the Calendar tab renders — one item per Booking and per
 * FollowUp, normalized so month/week/day/fleet/driver views don't need to
 * know which table something came from. */
export type CalendarEvent = {
  id: string;
  kind: "booking" | "followup";
  customerId: string;
  customerName: string;
  customerPhone: string | null;
  leadId: string | null;
  vehicleId: string | null;
  driverId: string | null;
  title: string;
  subtitle: string | null;
  date: Date;
  time: string;
  endTime: string | null;
  status: string;
  notes: string | null;
};

export async function getCalendarEvents(scope: Scope, range: { start: Date; end: Date }, filters: { vehicleId?: string; driverId?: string } = {}): Promise<CalendarEvent[]> {
  const [bookings, followUps] = await Promise.all([
    prisma.booking.findMany({
      where: {
        date: { gte: range.start, lte: range.end },
        bookingStatus: { notIn: ["CANCELLED"] },
        ...(filters.vehicleId ? { vehicleId: filters.vehicleId } : {}),
        ...(filters.driverId ? { driverId: filters.driverId } : {}),
      },
      include: { customer: { select: { firstName: true, lastName: true, phone: true } }, vehicle: { select: { name: true } }, driver: { select: { firstName: true, lastName: true } } },
      orderBy: { pickupTime: "asc" },
    }),
    filters.vehicleId
      ? Promise.resolve([])
      : prisma.followUp.findMany({
          where: { assigneeId: scope.viewAll ? undefined : scope.userId, followUpDate: { gte: range.start, lte: range.end } },
          include: { customer: { select: { firstName: true, lastName: true, phone: true } } },
          orderBy: { followUpTime: "asc" },
        }),
  ]);

  const events: CalendarEvent[] = [
    ...bookings.map((b): CalendarEvent => ({
      id: b.id,
      kind: "booking",
      customerId: b.customerId,
      customerName: `${b.customer.firstName} ${b.customer.lastName}`,
      customerPhone: b.customer.phone,
      leadId: b.leadId,
      vehicleId: b.vehicleId,
      driverId: b.driverId,
      title: b.serviceType.replace(/_/g, " "),
      subtitle: [b.vehicle?.name, b.driver ? `${b.driver.firstName} ${b.driver.lastName}` : null].filter(Boolean).join(" · ") || null,
      date: b.date,
      time: b.pickupTime,
      endTime: b.endTime,
      status: b.bookingStatus,
      notes: b.specialInstructions,
    })),
    ...followUps.map((f): CalendarEvent => ({
      id: f.id,
      kind: "followup",
      customerId: f.customerId,
      customerName: `${f.customer.firstName} ${f.customer.lastName}`,
      customerPhone: f.customer.phone,
      leadId: f.leadId,
      vehicleId: null,
      driverId: null,
      title: f.topic,
      subtitle: "Follow-Up Call",
      date: f.followUpDate,
      time: f.followUpTime,
      endTime: null,
      status: f.status,
      notes: f.notes,
    })),
  ];

  return events.sort((a, b) => followUpDateTime(a.date, a.time).getTime() - followUpDateTime(b.date, b.time).getTime());
}
