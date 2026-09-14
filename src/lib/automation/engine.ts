// Automation engine. Configurable rules (see AutomationRule model) are
// matched against events fired throughout the app (new lead, stage
// change, quote sent, booking confirmed, reminders, payments, etc.) and
// execute a small set of declarative actions — create a task, send an
// automated message, notify staff, enroll a follow-up sequence. Every
// firing is logged to AutomationRun so the Automations page shows what
// actually happened.
//
// "Send message" actions log a Communication row using the editable
// MessageTemplate body — this is fully functional without any external
// provider. Once Twilio/SendGrid/Resend are connected (see
// src/lib/integrations/*), the same call sites swap in a real send
// without touching the UI (see src/lib/integrations/messaging.ts).

import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { sendMessage } from "@/lib/integrations/messaging";

export type TriggerEvent =
  | "NEW_LEAD"
  | "HIGH_VALUE_LEAD"
  | "STAGE_CHANGE"
  | "QUOTE_SENT"
  | "BOOKING_CONFIRMED"
  | "REMINDER_24H"
  | "REMINDER_2H"
  | "TRIP_COMPLETED"
  | "NO_CONTACT_X_HOURS"
  | "PAYMENT_RECEIVED"
  | "PAYMENT_FAILED"
  | "MAINTENANCE_DUE";

type ActionDef =
  | { type: "CREATE_TASK"; taskType: string; title: string; priority?: string; dueInHours?: number; dueInDays?: number }
  | { type: "NOTIFY_STAFF"; notifyType: string }
  | { type: "SEND_MESSAGE"; templateKey: string }
  | { type: "ENROLL_SEQUENCE"; sequenceName?: string }
  | { type: "ADVANCE_SEQUENCE" };

export type AutomationPayload = {
  customerId: string;
  leadId?: string | null;
  bookingId?: string | null;
  actorId?: string | null;
  vehicleId?: string | null;
  extra?: Record<string, unknown>;
};

function computeDueDate(action: { dueInHours?: number; dueInDays?: number }) {
  const d = new Date();
  if (action.dueInHours) d.setHours(d.getHours() + action.dueInHours);
  else if (action.dueInDays) d.setDate(d.getDate() + action.dueInDays);
  else d.setHours(d.getHours() + 2);
  return d;
}

async function resolveAssignee(customerId: string, leadId?: string | null) {
  if (leadId) {
    const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { assigneeId: true } });
    if (lead?.assigneeId) return lead.assigneeId;
  }
  const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: { ownerId: true } });
  return customer?.ownerId ?? null;
}

async function executeAction(action: ActionDef, rule: { id: string; name: string }, payload: AutomationPayload) {
  const assigneeId = await resolveAssignee(payload.customerId, payload.leadId);

  switch (action.type) {
    case "CREATE_TASK": {
      if (!assigneeId) return;
      const task = await prisma.task.create({
        data: {
          customerId: payload.customerId,
          leadId: payload.leadId ?? undefined,
          bookingId: payload.bookingId ?? undefined,
          title: action.title,
          type: action.taskType,
          priority: action.priority ?? "NORMAL",
          dueDate: computeDueDate(action),
          assigneeId,
          source: "AUTOMATION",
        },
      });
      await logActivity({ customerId: payload.customerId, leadId: payload.leadId, bookingId: payload.bookingId, type: "AUTOMATION", description: `Automation "${rule.name}" created task: ${action.title}` });
      await prisma.automationRun.create({ data: { ruleId: rule.id, customerId: payload.customerId, leadId: payload.leadId, bookingId: payload.bookingId, status: "SUCCESS", detail: `Created task ${task.id}` } });
      break;
    }
    case "NOTIFY_STAFF": {
      if (!assigneeId) return;
      const recipient = await prisma.user.findUnique({ where: { id: assigneeId }, select: { notificationPrefs: true } });
      if (recipient?.notificationPrefs) {
        try {
          const prefs = JSON.parse(recipient.notificationPrefs) as Record<string, boolean>;
          if (prefs[action.notifyType] === false) return;
        } catch {
          /* malformed prefs — fall through and notify */
        }
      }
      const customer = await prisma.customer.findUnique({ where: { id: payload.customerId } });
      await prisma.notification.create({
        data: {
          userId: assigneeId,
          type: action.notifyType,
          title: ruleNotifyTitle(action.notifyType),
          body: customer ? `${customer.firstName} ${customer.lastName}` : undefined,
          link: payload.bookingId ? `/bookings/${payload.bookingId}` : `/customers/${payload.customerId}`,
        },
      });
      await prisma.automationRun.create({ data: { ruleId: rule.id, customerId: payload.customerId, leadId: payload.leadId, bookingId: payload.bookingId, status: "SUCCESS", detail: "Notification sent" } });
      break;
    }
    case "SEND_MESSAGE": {
      const template = await prisma.messageTemplate.findUnique({ where: { key: action.templateKey } });
      if (!template || !template.active) return;
      await sendMessage({ customerId: payload.customerId, leadId: payload.leadId, bookingId: payload.bookingId, template });
      await prisma.automationRun.create({ data: { ruleId: rule.id, customerId: payload.customerId, leadId: payload.leadId, bookingId: payload.bookingId, status: "SUCCESS", detail: `Sent "${template.name}"` } });
      break;
    }
    case "ENROLL_SEQUENCE": {
      if (!payload.leadId) return;
      const sequence = await prisma.followUpSequence.findFirst({ where: action.sequenceName ? { name: action.sequenceName, active: true } : { isDefault: true, active: true } });
      if (!sequence) return;
      await enrollInSequence(payload.customerId, payload.leadId, sequence.id);
      await prisma.automationRun.create({ data: { ruleId: rule.id, customerId: payload.customerId, leadId: payload.leadId, status: "SUCCESS", detail: `Enrolled in ${sequence.name}` } });
      break;
    }
    case "ADVANCE_SEQUENCE": {
      if (!payload.leadId) return;
      const enrollment = await prisma.followUpEnrollment.findFirst({ where: { leadId: payload.leadId, status: "ACTIVE" }, orderBy: { startedAt: "desc" } });
      if (enrollment) await prisma.followUpEnrollment.update({ where: { id: enrollment.id }, data: { currentStepIndex: { increment: 1 } } });
      break;
    }
  }
}

function ruleNotifyTitle(notifyType: string) {
  const map: Record<string, string> = {
    HIGH_VALUE_LEAD: "High-value lead flagged",
    PAYMENT_RECEIVED: "Payment received",
    PAYMENT_FAILED: "Payment failed",
    MAINTENANCE_DUE: "Vehicle maintenance due",
    NEW_BOOKING: "New booking",
  };
  return map[notifyType] ?? notifyType;
}

/** Enroll a customer/lead into a follow-up sequence, pre-creating every
 * step's task at its scheduled offset from now. */
export async function enrollInSequence(customerId: string, leadId: string, sequenceId: string) {
  const existing = await prisma.followUpEnrollment.findFirst({ where: { customerId, leadId, sequenceId, status: "ACTIVE" } });
  if (existing) return existing;

  const sequence = await prisma.followUpSequence.findUnique({ where: { id: sequenceId }, include: { steps: { orderBy: { order: "asc" } } } });
  if (!sequence) return null;

  const assigneeId = await resolveAssignee(customerId, leadId);
  const enrollment = await prisma.followUpEnrollment.create({ data: { customerId, leadId, sequenceId, status: "ACTIVE" } });

  for (const step of sequence.steps) {
    const dueDate = new Date();
    dueDate.setMinutes(dueDate.getMinutes() + step.offsetMinutes);
    if (step.channel === "SMS" || step.channel === "EMAIL") {
      await prisma.communication.create({
        data: {
          customerId,
          leadId,
          type: step.channel === "SMS" ? "TEXT" : "EMAIL",
          direction: "OUTBOUND",
          channel: step.channel,
          summary: step.title,
          body: step.messageBody,
          occurredAt: dueDate,
        },
      });
    } else if (assigneeId) {
      await prisma.task.create({
        data: { customerId, leadId, title: step.title, type: step.channel === "CALL" ? "CALL" : "FOLLOW_UP", priority: step.offsetMinutes === 0 ? "HIGH" : "NORMAL", dueDate, assigneeId, source: "SEQUENCE", notes: step.messageBody },
      });
    }
  }

  await logActivity({ customerId, leadId, type: "SEQUENCE_ENROLLED", description: `Enrolled in follow-up sequence "${sequence.name}" (${sequence.steps.length} steps scheduled).` });
  return enrollment;
}

/** Stop all active follow-up enrollments for a lead — called the moment a
 * lead responds or books, per spec §16 ("Stop the automation once the
 * lead responds or books"). */
export async function stopFollowUpsForLead(leadId: string, reason: "RESPONDED" | "BOOKED" = "RESPONDED") {
  await prisma.followUpEnrollment.updateMany({
    where: { leadId, status: "ACTIVE" },
    data: { status: reason === "BOOKED" ? "COMPLETED" : "STOPPED_RESPONDED", completedAt: new Date() },
  });
}

/** Fire an event through the automation engine — evaluates all active
 * rules for that trigger and executes their configured actions. */
export async function runAutomation(triggerEvent: TriggerEvent, payload: AutomationPayload) {
  const rules = await prisma.automationRule.findMany({ where: { triggerEvent, active: true }, orderBy: { order: "asc" } });
  for (const rule of rules) {
    try {
      const actions = JSON.parse(rule.actions) as ActionDef[];
      for (const action of actions) await executeAction(action, rule, payload);
    } catch {
      await prisma.automationRun.create({ data: { ruleId: rule.id, customerId: payload.customerId, leadId: payload.leadId, bookingId: payload.bookingId, status: "FAILED", detail: "Error executing rule actions" } });
    }
  }
}

/** Time-based rules have no discrete triggering event — swept on demand
 * (Automations page "Run checks now", and opportunistically on dashboard
 * load). Safe to call repeatedly: dedupes via AutomationRun. */
export async function runTimeBasedAutomationChecks() {
  let created = 0;
  created += await checkNoContactRules();
  created += await checkReminderRules("REMINDER_24H", 24);
  created += await checkReminderRules("REMINDER_2H", 2);
  created += await checkMaintenanceDueRules();
  return created;
}

async function checkNoContactRules() {
  const rules = await prisma.automationRule.findMany({ where: { triggerEvent: "NO_CONTACT_X_HOURS", active: true } });
  let created = 0;
  for (const rule of rules) {
    let hours = 4;
    try {
      const cond = rule.conditions ? JSON.parse(rule.conditions) : null;
      if (cond?.hours) hours = cond.hours;
    } catch {
      /* keep default */
    }
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - hours);

    const leads = await prisma.lead.findMany({
      where: { status: "ACTIVE", OR: [{ lastContactedAt: { lt: cutoff } }, { lastContactedAt: null, createdAt: { lt: cutoff } }] },
      select: { id: true, customerId: true },
    });

    for (const lead of leads) {
      const ranToday = await prisma.automationRun.findFirst({ where: { ruleId: rule.id, leadId: lead.id, createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } });
      if (ranToday) continue;
      const actions = JSON.parse(rule.actions) as ActionDef[];
      for (const action of actions) await executeAction(action, rule, { customerId: lead.customerId, leadId: lead.id });
      created++;
    }
  }
  return created;
}

async function checkReminderRules(trigger: "REMINDER_24H" | "REMINDER_2H", windowHours: number) {
  const rules = await prisma.automationRule.findMany({ where: { triggerEvent: trigger, active: true } });
  if (rules.length === 0) return 0;

  const now = new Date();
  const windowStart = new Date(now.getTime() + (windowHours - 1) * 3600_000);
  const windowEnd = new Date(now.getTime() + (windowHours + 1) * 3600_000);

  const bookings = await prisma.booking.findMany({
    where: { date: { gte: windowStart, lte: windowEnd }, bookingStatus: { notIn: ["CANCELLED", "COMPLETED"] } },
    select: { id: true, customerId: true, leadId: true },
  });

  let created = 0;
  for (const rule of rules) {
    for (const booking of bookings) {
      const alreadyRan = await prisma.automationRun.findFirst({ where: { ruleId: rule.id, bookingId: booking.id } });
      if (alreadyRan) continue;
      const actions = JSON.parse(rule.actions) as ActionDef[];
      for (const action of actions) await executeAction(action, rule, { customerId: booking.customerId, leadId: booking.leadId, bookingId: booking.id });
      created++;
    }
  }
  return created;
}

async function checkMaintenanceDueRules() {
  const rules = await prisma.automationRule.findMany({ where: { triggerEvent: "MAINTENANCE_DUE", active: true } });
  if (rules.length === 0) return 0;
  const soon = new Date();
  soon.setDate(soon.getDate() + 3);

  const records = await prisma.maintenanceRecord.findMany({
    where: { status: "SCHEDULED", scheduledDate: { lte: soon } },
    include: { vehicle: { select: { id: true, name: true } } },
  });

  let created = 0;
  const ownerRow = await prisma.role.findUnique({ where: { name: "OWNER" }, include: { users: { select: { id: true } } } });
  const staffIds = ownerRow?.users.map((u) => u.id) ?? [];
  for (const rule of rules) {
    for (const rec of records) {
      const ranToday = await prisma.automationRun.findFirst({ where: { ruleId: rule.id, detail: rec.id, createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } });
      if (ranToday) continue;
      for (const uid of staffIds) {
        await prisma.notification.create({ data: { userId: uid, type: "MAINTENANCE_DUE", title: "Vehicle maintenance due", body: `${rec.vehicle.name} — ${rec.description}`, link: `/fleet/${rec.vehicleId}` } });
      }
      await prisma.automationRun.create({ data: { ruleId: rule.id, status: "SUCCESS", detail: rec.id } });
      created++;
    }
  }
  return created;
}
