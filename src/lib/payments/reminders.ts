// Payment reminder orchestrator — Feature 2 (task/notification reminders
// for the salesperson) + the automated side of Feature 3 (customer SMS) +
// Feature 11 (per-stage on/off, preferred send time, recurring overdue).
// Modeled directly on src/lib/messaging/notify.ts's notifyAppointmentEvent:
// one place that decides "who gets notified, with what copy," built
// entirely on existing primitives (notifyAdmin, prisma.task.create,
// sendSms, logActivity) rather than a parallel notification system.
//
// Not routed through the generic AutomationRule engine (src/lib/automation/
// engine.ts) on purpose: that engine matches rules by trigger event only,
// with no per-payment dedupe concept, and its action JSON has no template-
// variable interpolation or recurring-schedule support. This module still
// calls the exact same notifyAdmin/prisma.task.create/sendSms functions
// the engine calls, so nothing about staff notifications, tasks, or SMS
// delivery is duplicated.
//
// Catch-up behavior: every "before due date" stage fires the first time
// its threshold is reached or passed (days-until-due <= stage.daysBefore)
// AND it hasn't already fired for that payment — not on an exact-day
// match. That means a cron run that gets skipped for a day or two still
// catches every stage it missed the next time it runs, per "handle missed
// notification jobs... without sending unnecessary duplicates." Each
// stage still only ever fires once (tracked in Payment.remindersSent),
// except OVERDUE, which can recur on a configurable interval.

import { prisma } from "@/lib/prisma";
import { getBookingSettings, wallClockInZone } from "@/lib/availability";
import { getDealershipInfo } from "@/lib/messaging/notify";
import { getActiveTemplateForStage, renderTemplate } from "@/lib/payments/templates";
import { PAYMENT_REMINDER_STAGES, type PaymentReminderStage } from "@/lib/payments/status";
import { notifyAdmin } from "@/lib/notify/adminAlert";
import { sendSms } from "@/lib/sms/provider";
import { logActivity } from "@/lib/activity";
import { formatCurrency, formatDate } from "@/lib/format";

export type PaymentAutomationSettings = {
  stages: Record<PaymentReminderStage, { enabled: boolean; sms: boolean; task: boolean; notify: boolean }>;
  // Local hour (0-23, in the dealership's configured timezone) reminders
  // are allowed to actually send at/after. The sweep can run as often as
  // it likes (e.g. every 15 min, same cadence as the appointment-reminder
  // cron) — this just holds new sends until the preferred time of day,
  // while status bookkeeping (e.g. flipping an unpaid payment to LATE)
  // still happens immediately regardless of the hour, since that's data
  // correctness, not a notification.
  preferredHour: number;
  overdueRepeat: { enabled: boolean; intervalDays: number };
};

export const DEFAULT_PAYMENT_AUTOMATION_SETTINGS: PaymentAutomationSettings = {
  stages: {
    "7_DAYS_BEFORE": { enabled: true, sms: true, task: true, notify: true },
    "3_DAYS_BEFORE": { enabled: true, sms: true, task: true, notify: true },
    "1_DAY_BEFORE": { enabled: true, sms: true, task: true, notify: true },
    DUE_DATE: { enabled: true, sms: true, task: true, notify: true },
    OVERDUE: { enabled: true, sms: true, task: true, notify: true },
  },
  preferredHour: 9,
  overdueRepeat: { enabled: true, intervalDays: 3 },
};

export async function getPaymentAutomationSettings(): Promise<PaymentAutomationSettings> {
  const row = await prisma.setting.findUnique({ where: { key: "paymentAutomation" } });
  if (!row) return DEFAULT_PAYMENT_AUTOMATION_SETTINGS;
  try {
    const stored = JSON.parse(row.value) as Partial<PaymentAutomationSettings>;
    return {
      stages: { ...DEFAULT_PAYMENT_AUTOMATION_SETTINGS.stages, ...(stored.stages ?? {}) },
      preferredHour: stored.preferredHour ?? DEFAULT_PAYMENT_AUTOMATION_SETTINGS.preferredHour,
      overdueRepeat: { ...DEFAULT_PAYMENT_AUTOMATION_SETTINGS.overdueRepeat, ...(stored.overdueRepeat ?? {}) },
    };
  } catch {
    return DEFAULT_PAYMENT_AUTOMATION_SETTINGS;
  }
}

export async function savePaymentAutomationSettings(settings: PaymentAutomationSettings) {
  await prisma.setting.upsert({
    where: { key: "paymentAutomation" },
    update: { value: JSON.stringify(settings) },
    create: { key: "paymentAutomation", value: JSON.stringify(settings) },
  });
}

async function resolveAssignee(customerId: string, leadId: string | null): Promise<string | null> {
  if (leadId) {
    const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { assigneeId: true } });
    if (lead) return lead.assigneeId;
  }
  const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: { ownerId: true } });
  return customer?.ownerId ?? null;
}

const STAGE_LABELS: Record<PaymentReminderStage, string> = {
  "7_DAYS_BEFORE": "7 days before due",
  "3_DAYS_BEFORE": "3 days before due",
  "1_DAY_BEFORE": "1 day before due",
  DUE_DATE: "due today",
  OVERDUE: "overdue",
};

type ReminderEntry = { stage: PaymentReminderStage; sentAt: string };

function parseReminders(raw: string): ReminderEntry[] {
  try {
    const parsed = JSON.parse(raw || "[]");
    // Tolerate the pre-existing format (a bare array of stage strings)
    // from before recurring-overdue support was added, so old rows don't
    // need a migration pass.
    return parsed.map((e: unknown) => (typeof e === "string" ? { stage: e as PaymentReminderStage, sentAt: new Date(0).toISOString() } : (e as ReminderEntry)));
  } catch {
    return [];
  }
}

/** Fires the configured notify/task/sms actions for one stage on one
 * payment, records the send, and logs it. `sendLabel` is what actually
 * happened (sent / simulated / no consent / no template) so the activity
 * log never claims a delivery that didn't happen — see "never claim a
 * notification was delivered unless the notification service confirms
 * the result." */
async function fireStage(params: {
  stage: PaymentReminderStage;
  payment: { id: string; customerId: string; leadId: string | null; amount: number; dueDate: Date };
  customer: { firstName: string; lastName: string; phone: string | null; smsConsent: boolean };
  stageConfig: { notify: boolean; task: boolean; sms: boolean };
  assigneeId: string | null;
  bookingSettings: { agentName: string };
  dealershipName: string;
  daysOverdue?: number;
}) {
  const { stage, payment, customer, stageConfig, assigneeId, bookingSettings, dealershipName, daysOverdue } = params;
  const customerName = `${customer.firstName} ${customer.lastName}`;
  const amountLabel = formatCurrency(payment.amount);
  const dueDateLabel = formatDate(payment.dueDate);
  const stageLabel = STAGE_LABELS[stage];

  if (stageConfig.notify && assigneeId) {
    const title =
      stage === "DUE_DATE" ? `Payment Due Today — ${customerName}` : stage === "OVERDUE" ? `Late Payment — ${customerName}` : `Payment Due Soon — ${customerName}`;
    const body =
      stage === "OVERDUE"
        ? `${customerName} has an overdue payment of ${amountLabel}. Original due date: ${dueDateLabel}. Days overdue: ${daysOverdue ?? "?"}.`
        : `${customerName} owes ${amountLabel} on ${dueDateLabel}.`;
    await notifyAdmin({ userId: assigneeId, type: "PAYMENT_DUE", title, body, link: `/customers/${payment.customerId}` });
  }

  if (stageConfig.task && assigneeId) {
    await prisma.task.create({
      data: {
        customerId: payment.customerId,
        leadId: payment.leadId,
        title:
          stage === "OVERDUE"
            ? `Follow up — ${customerName}'s ${amountLabel} payment is overdue (was due ${dueDateLabel})`
            : `Follow up with ${customerName} regarding ${amountLabel} payment due ${dueDateLabel}`,
        type: "CALL",
        priority: stage === "OVERDUE" ? "URGENT" : stage === "DUE_DATE" ? "HIGH" : "NORMAL",
        dueDate: new Date(),
        assigneeId,
        source: "AUTOMATION",
      },
    });
  }

  let sendLabel = "no SMS sent (customer hasn't given text consent, or no phone on file)";
  if (stageConfig.sms && customer.smsConsent && customer.phone) {
    const template = await getActiveTemplateForStage(stage);
    if (template) {
      const body = renderTemplate(template.body, {
        firstName: customer.firstName,
        amount: amountLabel,
        dueDate: dueDateLabel,
        agentName: bookingSettings.agentName,
        dealershipName,
      });
      const result = await sendSms({ customerId: payment.customerId, toPhone: customer.phone, type: "PAYMENT_REMINDER", body });
      sendLabel = result.simulated ? "SMS simulated (Twilio not connected)" : result.sent ? "SMS sent" : "SMS failed to send";
    } else {
      sendLabel = "no active SMS template for this stage";
    }
  }

  await logActivity({
    customerId: payment.customerId,
    leadId: payment.leadId,
    type: "AUTOMATION",
    description: `Payment reminder (${stageLabel}) — ${amountLabel} due ${dueDateLabel}. ${sendLabel}.`,
    metadata: { paymentId: payment.id, stage },
  });
}

/** Runs the full reminder pass across every outstanding payment. Safe to
 * call as often as the cron schedule likes — idempotent by construction
 * (remindersSent + the LATE status itself are the guards), and any run
 * naturally catches up on stages a prior run missed. Returns counts for
 * the cron route's response / observability. */
export async function runPaymentReminderSweep() {
  const [settings, bookingSettings, dealership] = await Promise.all([
    getPaymentAutomationSettings(),
    getBookingSettings(),
    getDealershipInfo(),
  ]);

  const { dateStr: todayStr, minutes: nowMinutes } = wallClockInZone(new Date(), bookingSettings.timezone);
  const today = new Date(`${todayStr}T00:00:00Z`);
  const pastPreferredHour = nowMinutes >= settings.preferredHour * 60;

  const outstanding = await prisma.payment.findMany({
    where: { status: { in: ["PENDING", "LATE"] } },
    include: { customer: true },
  });

  let statusChanged = 0;
  let remindersSentCount = 0;
  let skipped = 0;

  for (const payment of outstanding) {
    const dueDateOnly = new Date(`${payment.dueDate.toISOString().slice(0, 10)}T00:00:00Z`);
    const diffDays = Math.round((dueDateOnly.getTime() - today.getTime()) / 86400000);
    const reminders = parseReminders(payment.remindersSent);
    let status = payment.status as "PENDING" | "LATE";

    // Data-correctness transition — happens immediately, not gated by
    // preferredHour, since it isn't a notification.
    if (status === "PENDING" && diffDays < 0) {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: "LATE" } });
      await logActivity({
        customerId: payment.customerId,
        leadId: payment.leadId,
        type: "AUTOMATION",
        description: `Payment automatically marked Late — ${formatCurrency(payment.amount)} was due ${formatDate(payment.dueDate)}.`,
        metadata: { paymentId: payment.id },
      });
      status = "LATE";
      statusChanged++;
    }

    if (!pastPreferredHour) {
      skipped++;
      continue;
    }

    const assigneeId = await resolveAssignee(payment.customerId, payment.leadId);

    if (status === "PENDING") {
      const stageDef = PAYMENT_REMINDER_STAGES.find((s) => diffDays <= s.daysBefore && !reminders.some((r) => r.stage === s.value));
      if (!stageDef) {
        skipped++;
        continue;
      }
      const stageConfig = settings.stages[stageDef.value];
      if (!stageConfig.enabled) {
        skipped++;
        continue;
      }
      await fireStage({
        stage: stageDef.value,
        payment,
        customer: payment.customer,
        stageConfig,
        assigneeId,
        bookingSettings,
        dealershipName: dealership.name,
      });
      await prisma.payment.update({
        where: { id: payment.id },
        data: { remindersSent: JSON.stringify([...reminders, { stage: stageDef.value, sentAt: new Date().toISOString() }]) },
      });
      remindersSentCount++;
      continue;
    }

    // status === "LATE": fire immediately the first time, then recur per
    // overdueRepeat if enabled.
    const overdueConfig = settings.stages.OVERDUE;
    if (!overdueConfig.enabled) {
      skipped++;
      continue;
    }
    const overdueSends = reminders.filter((r) => r.stage === "OVERDUE");
    const lastSent = overdueSends.length ? new Date(overdueSends[overdueSends.length - 1].sentAt) : null;
    const daysSinceLastSend = lastSent ? Math.floor((Date.now() - lastSent.getTime()) / 86400000) : Infinity;
    const shouldSend = !lastSent || (settings.overdueRepeat.enabled && daysSinceLastSend >= settings.overdueRepeat.intervalDays);
    if (!shouldSend) {
      skipped++;
      continue;
    }

    await fireStage({
      stage: "OVERDUE",
      payment,
      customer: payment.customer,
      stageConfig: overdueConfig,
      assigneeId,
      bookingSettings,
      dealershipName: dealership.name,
      daysOverdue: -diffDays,
    });
    await prisma.payment.update({
      where: { id: payment.id },
      data: { remindersSent: JSON.stringify([...reminders, { stage: "OVERDUE" as PaymentReminderStage, sentAt: new Date().toISOString() }]) },
    });
    remindersSentCount++;
  }

  return { checked: outstanding.length, statusChanged, remindersSent: remindersSentCount, skipped, pastPreferredHour };
}
