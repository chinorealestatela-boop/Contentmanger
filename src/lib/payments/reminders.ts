// Payment reminder orchestrator — Feature 2 (task/notification reminders
// for the salesperson) + the automated side of Feature 3 (customer SMS) +
// Feature 11 (per-stage on/off). Modeled directly on
// src/lib/messaging/notify.ts's notifyAppointmentEvent: one place that
// decides "who gets notified, with what copy," built entirely on existing
// primitives (notifyAdmin, prisma.task.create, sendSms, logActivity)
// rather than a parallel notification system.
//
// Not routed through the generic AutomationRule engine (src/lib/automation/
// engine.ts) on purpose: that engine matches rules by trigger event only,
// with no per-payment dedupe concept, and its action JSON has no template-
// variable interpolation. Payments need both (one rule to configure per
// reminder *stage*, and a guaranteed-once-per-payment-per-stage send), so
// this is a small dedicated module instead — it still calls the exact same
// notifyAdmin/prisma.task.create/sendSms functions the engine calls, so
// nothing about staff notifications, tasks, or SMS delivery is duplicated.

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
};

export const DEFAULT_PAYMENT_AUTOMATION_SETTINGS: PaymentAutomationSettings = {
  stages: {
    "7_DAYS_BEFORE": { enabled: true, sms: true, task: true, notify: true },
    "3_DAYS_BEFORE": { enabled: true, sms: true, task: true, notify: true },
    "1_DAY_BEFORE": { enabled: true, sms: true, task: true, notify: true },
    DUE_DATE: { enabled: true, sms: true, task: true, notify: true },
    OVERDUE: { enabled: true, sms: true, task: true, notify: true },
  },
};

export async function getPaymentAutomationSettings(): Promise<PaymentAutomationSettings> {
  const row = await prisma.setting.findUnique({ where: { key: "paymentAutomation" } });
  if (!row) return DEFAULT_PAYMENT_AUTOMATION_SETTINGS;
  try {
    const stored = JSON.parse(row.value) as Partial<PaymentAutomationSettings>;
    return { stages: { ...DEFAULT_PAYMENT_AUTOMATION_SETTINGS.stages, ...(stored.stages ?? {}) } };
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

/** Runs the full reminder pass across every pending payment. Idempotent —
 * safe to call as often as the cron schedule likes; each payment tracks
 * which stages have already fired in `remindersSent` so nothing is ever
 * sent twice for the same due date (see the Payment.remindersSent schema
 * comment). Returns counts for the cron route's response / observability. */
export async function runPaymentReminderSweep() {
  const [settings, bookingSettings, dealership] = await Promise.all([
    getPaymentAutomationSettings(),
    getBookingSettings(),
    getDealershipInfo(),
  ]);

  const { dateStr: todayStr } = wallClockInZone(new Date(), bookingSettings.timezone);
  const today = new Date(`${todayStr}T00:00:00Z`);

  const pending = await prisma.payment.findMany({
    where: { status: "PENDING" },
    include: { customer: true },
  });

  let notified = 0;
  let tasksCreated = 0;
  let smsSent = 0;
  let skipped = 0;

  for (const payment of pending) {
    const dueDateOnly = new Date(`${payment.dueDate.toISOString().slice(0, 10)}T00:00:00Z`);
    const diffDays = Math.round((dueDateOnly.getTime() - today.getTime()) / 86400000);
    const stageDef = PAYMENT_REMINDER_STAGES.find((s) => s.daysBefore === diffDays);
    if (!stageDef) continue;

    const stageConfig = settings.stages[stageDef.value];
    if (!stageConfig.enabled) continue;

    const alreadySent: string[] = JSON.parse(payment.remindersSent || "[]");
    if (alreadySent.includes(stageDef.value)) {
      skipped++;
      continue;
    }

    const customer = payment.customer;
    const customerName = `${customer.firstName} ${customer.lastName}`;
    const amountLabel = formatCurrency(payment.amount);
    const dueDateLabel = formatDate(payment.dueDate);
    const stageLabel = STAGE_LABELS[stageDef.value];

    const assigneeId = await resolveAssignee(payment.customerId, payment.leadId);

    if (stageConfig.notify && assigneeId) {
      await notifyAdmin({
        userId: assigneeId,
        type: "PAYMENT_DUE",
        title: `Payment ${stageDef.value === "DUE_DATE" ? "Due Today" : stageDef.value === "OVERDUE" ? "Overdue" : "Due Soon"} — ${customerName}`,
        body: `${customerName} owes ${amountLabel} on ${dueDateLabel}.`,
        link: `/customers/${payment.customerId}`,
      });
      notified++;
    }

    if (stageConfig.task && assigneeId) {
      await prisma.task.create({
        data: {
          customerId: payment.customerId,
          leadId: payment.leadId,
          title: `Follow up with ${customerName} regarding ${amountLabel} payment due ${dueDateLabel}`,
          type: "CALL",
          priority: stageDef.value === "OVERDUE" ? "URGENT" : stageDef.value === "DUE_DATE" ? "HIGH" : "NORMAL",
          dueDate: new Date(),
          assigneeId,
          source: "AUTOMATION",
        },
      });
      tasksCreated++;
    }

    if (stageConfig.sms && customer.smsConsent && customer.phone) {
      const template = await getActiveTemplateForStage(stageDef.value);
      if (template) {
        const body = renderTemplate(template.body, {
          firstName: customer.firstName,
          amount: amountLabel,
          dueDate: dueDateLabel,
          agentName: bookingSettings.agentName,
          dealershipName: dealership.name,
        });
        await sendSms({ customerId: payment.customerId, toPhone: customer.phone, type: "PAYMENT_REMINDER", body });
        smsSent++;
      }
    }

    await logActivity({
      customerId: payment.customerId,
      leadId: payment.leadId,
      type: "AUTOMATION",
      description: `Payment reminder (${stageLabel}) sent — ${amountLabel} due ${dueDateLabel}.`,
      metadata: { paymentId: payment.id, stage: stageDef.value },
    });

    await prisma.payment.update({
      where: { id: payment.id },
      data: { remindersSent: JSON.stringify([...alreadySent, stageDef.value]) },
    });
  }

  return { checked: pending.length, notified, tasksCreated: tasksCreated, smsSent, skipped };
}
