import { prisma } from "@/lib/prisma";
import type { Scope } from "@/lib/queries/scope";
import { followUpDateTime } from "@/lib/followups";
import { formatCurrency } from "@/lib/format";

/** Unified shape the Calendar tab renders — one item per Appointment
 * (calendar event), per FollowUp, and per scheduled Payment, normalized
 * so month/week/day views don't need to know which table something came
 * from. A Payment has no time-of-day of its own (just a due date), so it
 * always renders at a sentinel "09:00" — early enough to sort near the
 * top of a day alongside real morning appointments, without claiming a
 * time that was never actually scheduled. */
export type CalendarEvent = {
  id: string;
  kind: "appointment" | "followup" | "payment";
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
  type: string; // appointment type, "FOLLOW_UP", or "PAYMENT_DUE" / "PAYMENT_LATE"
  status: string;
  notes: string | null;
};

const PAYMENT_EVENT_TIME = "09:00";

async function paymentEvents(scope: Scope, where: { dueDate?: { gte: Date; lte: Date }; lt?: Date }): Promise<CalendarEvent[]> {
  const payments = await prisma.payment.findMany({
    where: {
      status: { in: ["PENDING", "LATE"] },
      ...(where.dueDate ? { dueDate: where.dueDate } : where.lt ? { dueDate: { lt: where.lt } } : {}),
    },
    include: {
      customer: { select: { firstName: true, lastName: true, phone: true, ownerId: true } },
      lead: { select: { assigneeId: true } },
    },
  });

  const inScope = scope.viewAll ? payments : payments.filter((p) => (p.lead?.assigneeId ?? p.customer.ownerId) === scope.userId);

  return inScope.map((p): CalendarEvent => ({
    id: p.id,
    kind: "payment",
    customerId: p.customerId,
    customerName: `${p.customer.firstName} ${p.customer.lastName}`,
    customerPhone: p.customer.phone,
    leadId: p.leadId,
    title: `Payment Due — ${formatCurrency(p.amount)}`,
    subtitle: p.status === "LATE" ? "Late" : "Scheduled Payment",
    date: p.dueDate,
    time: PAYMENT_EVENT_TIME,
    endTime: null,
    location: null,
    type: p.status === "LATE" ? "PAYMENT_LATE" : "PAYMENT_DUE",
    status: p.status,
    notes: p.notes,
  }));
}

export async function getCalendarEvents(scope: Scope, range: { start: Date; end: Date }): Promise<CalendarEvent[]> {
  const salespersonWhere = scope.viewAll ? undefined : scope.userId;

  const [appointments, followUps, payments] = await Promise.all([
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
    paymentEvents(scope, { dueDate: { gte: range.start, lte: range.end } }),
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
    ...payments,
  ];

  return events.sort((a, b) => followUpDateTime(a.date, a.time).getTime() - followUpDateTime(b.date, b.time).getTime());
}

export async function getPastEvents(scope: Scope, limit = 30): Promise<CalendarEvent[]> {
  const now = new Date();
  const salespersonWhere = scope.viewAll ? undefined : scope.userId;

  const [appointments, followUps, payments] = await Promise.all([
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
    paymentEvents(scope, { lt: now }), // late (unpaid) payments only — a paid one is no longer "outstanding" on the calendar
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
    ...payments,
  ];

  return events.sort((a, b) => followUpDateTime(b.date, b.time).getTime() - followUpDateTime(a.date, a.time).getTime()).slice(0, limit);
}
