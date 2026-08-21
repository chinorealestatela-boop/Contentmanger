// Automation engine. Configurable rules (see AutomationRule model) are
// matched against events fired throughout the app (new lead, stage
// change, appointment lifecycle, etc.) and execute a small set of
// declarative actions — create a task, send a notification, enroll a
// follow-up sequence. Every firing is logged to AutomationRun so the
// Automations page can show what actually happened.
//
// No external services required: everything here reads/writes the local
// database only.

import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";

export type TriggerEvent =
  | "NEW_LEAD"
  | "STAGE_CHANGE"
  | "HOT_LEAD"
  | "APPOINTMENT_CREATED"
  | "APPOINTMENT_TOMORROW"
  | "APPOINTMENT_NO_SHOW"
  | "APPOINTMENT_COMPLETED"
  | "NO_CONTACT_X_DAYS"
  | "TEST_DRIVE_COMPLETED"
  | "VEHICLE_SOLD"
  | "LEAD_LOST"
  | "FOLLOW_UP_COMPLETED";

type ActionDef =
  | { type: "CREATE_TASK"; taskType: string; title: string; priority: string; dueInHours?: number; dueInDays?: number }
  | { type: "NOTIFY"; notifType: string; title: string }
  | { type: "ENROLL_SEQUENCE"; sequenceName: string }
  | { type: "ADVANCE_SEQUENCE" };

export type AutomationPayload = {
  customerId: string;
  leadId?: string | null;
  actorId?: string | null;
  vehicleId?: string | null;
  extra?: Record<string, unknown>;
};

function computeDueDate(action: { dueInHours?: number; dueInDays?: number }) {
  const d = new Date();
  if (action.dueInHours) d.setHours(d.getHours() + action.dueInHours);
  else if (action.dueInDays) d.setDate(d.getDate() + action.dueInDays);
  else d.setHours(d.getHours() + 4);
  return d;
}

async function resolveAssignee(customerId: string, leadId?: string | null) {
  if (leadId) {
    const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { assigneeId: true } });
    if (lead) return lead.assigneeId;
  }
  const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: { ownerId: true } });
  return customer?.ownerId ?? null;
}

async function executeAction(action: ActionDef, rule: { id: string; name: string }, payload: AutomationPayload) {
  const assigneeId = await resolveAssignee(payload.customerId, payload.leadId);
  if (!assigneeId) return;

  switch (action.type) {
    case "CREATE_TASK": {
      const task = await prisma.task.create({
        data: {
          customerId: payload.customerId,
          leadId: payload.leadId ?? undefined,
          title: action.title,
          type: action.taskType,
          priority: action.priority,
          dueDate: computeDueDate(action),
          assigneeId,
          source: "AUTOMATION",
        },
      });
      await logActivity({
        customerId: payload.customerId,
        leadId: payload.leadId,
        type: "AUTOMATION",
        description: `Automation "${rule.name}" created task: ${action.title}`,
      });
      await prisma.automationRun.create({
        data: { ruleId: rule.id, customerId: payload.customerId, leadId: payload.leadId, status: "SUCCESS", detail: `Created task ${task.id}` },
      });
      break;
    }
    case "NOTIFY": {
      const customer = await prisma.customer.findUnique({ where: { id: payload.customerId } });
      await prisma.notification.create({
        data: {
          userId: assigneeId,
          type: action.notifType,
          title: action.title,
          body: customer ? `${customer.firstName} ${customer.lastName}` : undefined,
          link: `/customers/${payload.customerId}`,
        },
      });
      await prisma.automationRun.create({
        data: { ruleId: rule.id, customerId: payload.customerId, leadId: payload.leadId, status: "SUCCESS", detail: "Notification sent" },
      });
      break;
    }
    case "ENROLL_SEQUENCE": {
      if (!payload.leadId) break;
      const sequence = await prisma.followUpSequence.findFirst({ where: { name: action.sequenceName, active: true }, include: { steps: { orderBy: { order: "asc" } } } });
      if (!sequence) break;
      await enrollInSequence(payload.customerId, payload.leadId, sequence.id);
      await prisma.automationRun.create({
        data: { ruleId: rule.id, customerId: payload.customerId, leadId: payload.leadId, status: "SUCCESS", detail: `Enrolled in ${sequence.name}` },
      });
      break;
    }
    case "ADVANCE_SEQUENCE": {
      if (!payload.leadId) break;
      const enrollment = await prisma.followUpEnrollment.findFirst({
        where: { leadId: payload.leadId, status: "ACTIVE" },
        orderBy: { startedAt: "desc" },
      });
      if (enrollment) {
        await prisma.followUpEnrollment.update({ where: { id: enrollment.id }, data: { currentStepIndex: { increment: 1 } } });
      }
      break;
    }
  }
}

/** Enroll a customer/lead into a follow-up sequence, pre-creating every
 * step's task at its scheduled offset from today. Pre-creating (rather
 * than generating steps day-by-day) means the tasks show up correctly on
 * the Tasks/Calendar views without needing a background scheduler. */
export async function enrollInSequence(customerId: string, leadId: string, sequenceId: string) {
  const existing = await prisma.followUpEnrollment.findFirst({ where: { customerId, leadId, sequenceId, status: "ACTIVE" } });
  if (existing) return existing;

  const sequence = await prisma.followUpSequence.findUnique({ where: { id: sequenceId }, include: { steps: { orderBy: { order: "asc" } } } });
  if (!sequence) return null;

  const assigneeId = await resolveAssignee(customerId, leadId);
  const enrollment = await prisma.followUpEnrollment.create({
    data: { customerId, leadId, sequenceId, status: "ACTIVE" },
  });

  if (assigneeId) {
    for (const step of sequence.steps) {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + step.dayOffset);
      await prisma.task.create({
        data: {
          customerId,
          leadId,
          title: step.title,
          type: step.type,
          priority: step.dayOffset === 0 ? "HIGH" : "NORMAL",
          dueDate,
          assigneeId,
          source: "SEQUENCE",
          notes: step.description,
        },
      });
    }
  }

  await logActivity({
    customerId,
    leadId,
    type: "SEQUENCE_ENROLLED",
    description: `Enrolled in follow-up sequence "${sequence.name}" (${sequence.steps.length} steps scheduled).`,
  });

  return enrollment;
}

/** Fire an event through the automation engine — evaluates all active
 * rules for that trigger and executes their configured actions. */
export async function runAutomation(triggerEvent: TriggerEvent, payload: AutomationPayload) {
  const rules = await prisma.automationRule.findMany({ where: { triggerEvent, active: true }, orderBy: { order: "asc" } });
  for (const rule of rules) {
    try {
      const actions = JSON.parse(rule.actions) as ActionDef[];
      for (const action of actions) {
        await executeAction(action, rule, payload);
      }
    } catch {
      await prisma.automationRun.create({
        data: { ruleId: rule.id, customerId: payload.customerId, leadId: payload.leadId, status: "FAILED", detail: "Error executing rule actions" },
      });
    }
  }
}

/** Time-based rules aren't fired by a discrete event — they're swept
 * periodically. Since v1 has no background job runner, this is invoked
 * on-demand (Automations page "Run checks now", and opportunistically on
 * dashboard load) and is safe to call repeatedly: it won't re-fire a rule
 * for the same lead more than once per day. */
export async function runTimeBasedAutomationChecks() {
  let created = 0;
  created += await checkNoContactRules();
  created += await checkAppointmentTomorrowRules();
  return created;
}

async function checkNoContactRules() {
  const rules = await prisma.automationRule.findMany({ where: { triggerEvent: "NO_CONTACT_X_DAYS", active: true } });
  let created = 0;
  for (const rule of rules) {
    let days = 3;
    try {
      const cond = rule.conditions ? JSON.parse(rule.conditions) : null;
      if (cond?.days) days = cond.days;
    } catch {
      /* keep default */
    }
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const leads = await prisma.lead.findMany({
      where: { status: "ACTIVE", lastContactedAt: { lt: cutoff } },
      select: { id: true, customerId: true, assigneeId: true },
    });

    for (const lead of leads) {
      const ranToday = await prisma.automationRun.findFirst({
        where: { ruleId: rule.id, leadId: lead.id, createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      });
      if (ranToday) continue;

      const actions = JSON.parse(rule.actions) as ActionDef[];
      for (const action of actions) {
        await executeAction(action, rule, { customerId: lead.customerId, leadId: lead.id });
      }
      created++;
    }
  }
  return created;
}

/** Appointment reminders aren't triggered by a discrete event (nothing
 * "happens" when midnight arrives) — this sweep finds appointments
 * scheduled for tomorrow and fires the rule once per appointment per day. */
async function checkAppointmentTomorrowRules() {
  const rules = await prisma.automationRule.findMany({ where: { triggerEvent: "APPOINTMENT_TOMORROW", active: true } });
  if (rules.length === 0) return 0;

  const tomorrowStart = new Date();
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  tomorrowStart.setHours(0, 0, 0, 0);
  const tomorrowEnd = new Date(tomorrowStart);
  tomorrowEnd.setHours(23, 59, 59, 999);

  const appointments = await prisma.appointment.findMany({
    where: { date: { gte: tomorrowStart, lte: tomorrowEnd }, status: { in: ["SCHEDULED", "CONFIRMED"] } },
    select: { id: true, customerId: true },
  });

  let created = 0;
  for (const rule of rules) {
    for (const appt of appointments) {
      const ranToday = await prisma.automationRun.findFirst({
        where: { ruleId: rule.id, customerId: appt.customerId, createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      });
      if (ranToday) continue;

      const lead = await prisma.lead.findFirst({ where: { customerId: appt.customerId, status: "ACTIVE" }, select: { id: true } });
      const actions = JSON.parse(rule.actions) as ActionDef[];
      for (const action of actions) {
        await executeAction(action, rule, { customerId: appt.customerId, leadId: lead?.id });
      }
      created++;
    }
  }
  return created;
}
