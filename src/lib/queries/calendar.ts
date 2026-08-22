import { prisma } from "@/lib/prisma";
import type { Scope } from "@/lib/queries/scope";
import { followUpDateTime } from "@/lib/followups";

/** Unified shape the Calendar tab renders — one item per Appointment
 * (calendar event) and per FollowUp, normalized so month/week/day views
 * don't need to know which table something came from. */
export type CalendarEvent = {
  id: string;
  kind: "appointment" | "followup";
  customerId: string;
  customerName: string;
  customerPhone: string | null;
  leadId: string | null;
  title: string;
  subtitle: string | null;
  date: Date;
  time: string;
  endTime: string | null;
  location: string | null;
  type: string; // appointment type, or "FOLLOW_UP" for follow-ups
  status: string;
  notes: string | null;
};

export async function getCalendarEvents(scope: Scope, range: { start: Date; end: Date }): Promise<CalendarEvent[]> {
  const salespersonWhere = scope.viewAll ? undefined : scope.userId;

  const [appointments, followUps] = await Promise.all([
    prisma.appointment.findMany({
      where: { salespersonId: salespersonWhere, date: { gte: range.start, lte: range.end } },
      include: { customer: { select: { firstName: true, lastName: true, phone: true } }, vehicle: { select: { year: true, make: true, model: true } } },
      orderBy: { time: "asc" },
    }),
    prisma.followUp.findMany({
      where: { assigneeId: salespersonWhere, followUpDate: { gte: range.start, lte: range.end } },
      include: { customer: { select: { firstName: true, lastName: true, phone: true } } },
      orderBy: { followUpTime: "asc" },
    }),
  ]);

  const events: CalendarEvent[] = [
    ...appointments.map((a): CalendarEvent => ({
      id: a.id,
      kind: "appointment",
      customerId: a.customerId,
      customerName: `${a.customer.firstName} ${a.customer.lastName}`,
      customerPhone: a.customer.phone,
      leadId: a.leadId,
      title: a.type.replace(/_/g, " "),
      subtitle: a.vehicle ? `${a.vehicle.year} ${a.vehicle.make} ${a.vehicle.model}` : a.location,
      date: a.date,
      time: a.time,
      endTime: a.endTime,
      location: a.location,
      type: a.type,
      status: a.status,
      notes: a.notes,
    })),
    ...followUps.map((f): CalendarEvent => ({
      id: f.id,
      kind: "followup",
      customerId: f.customerId,
      customerName: `${f.customer.firstName} ${f.customer.lastName}`,
      customerPhone: f.customer.phone,
      leadId: f.leadId,
      title: f.topic,
      subtitle: "Follow-Up Call",
      date: f.followUpDate,
      time: f.followUpTime,
      endTime: null,
      location: null,
      type: "FOLLOW_UP",
      status: f.status,
      notes: f.notes,
    })),
  ];

  return events.sort((a, b) => followUpDateTime(a.date, a.time).getTime() - followUpDateTime(b.date, b.time).getTime());
}

export async function getPastEvents(scope: Scope, limit = 30): Promise<CalendarEvent[]> {
  const now = new Date();
  const salespersonWhere = scope.viewAll ? undefined : scope.userId;

  const [appointments, followUps] = await Promise.all([
    prisma.appointment.findMany({
      where: { salespersonId: salespersonWhere, date: { lt: now } },
      include: { customer: { select: { firstName: true, lastName: true, phone: true } }, vehicle: { select: { year: true, make: true, model: true } } },
      orderBy: { date: "desc" },
      take: limit,
    }),
    prisma.followUp.findMany({
      where: { assigneeId: salespersonWhere, followUpDate: { lt: now }, status: { in: ["COMPLETED", "MISSED", "CANCELLED"] } },
      include: { customer: { select: { firstName: true, lastName: true, phone: true } } },
      orderBy: { followUpDate: "desc" },
      take: limit,
    }),
  ]);

  const events: CalendarEvent[] = [
    ...appointments.map((a): CalendarEvent => ({
      id: a.id, kind: "appointment", customerId: a.customerId, customerName: `${a.customer.firstName} ${a.customer.lastName}`,
      customerPhone: a.customer.phone, leadId: a.leadId, title: a.type.replace(/_/g, " "),
      subtitle: a.vehicle ? `${a.vehicle.year} ${a.vehicle.make} ${a.vehicle.model}` : a.location,
      date: a.date, time: a.time, endTime: a.endTime, location: a.location, type: a.type, status: a.status, notes: a.notes,
    })),
    ...followUps.map((f): CalendarEvent => ({
      id: f.id, kind: "followup", customerId: f.customerId, customerName: `${f.customer.firstName} ${f.customer.lastName}`,
      customerPhone: f.customer.phone, leadId: f.leadId, title: f.topic, subtitle: "Follow-Up Call",
      date: f.followUpDate, time: f.followUpTime, endTime: null, location: null, type: "FOLLOW_UP", status: f.status, notes: f.notes,
    })),
  ];

  return events.sort((a, b) => followUpDateTime(b.date, b.time).getTime() - followUpDateTime(a.date, a.time).getTime()).slice(0, limit);
}
