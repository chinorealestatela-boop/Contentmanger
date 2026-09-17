// Editable SMS template system for payment reminders (Feature 3 — "do not
// hard-code these messages"). Five starter templates (one per reminder
// stage) are lazily seeded into the SmsTemplate table the first time
// they're read, rather than via prisma/seed.ts, so this works on a
// database that was already seeded/deployed before this feature existed —
// no re-seed step required. Every one of them is fully editable/
// deletable/toggle-off-able afterward like any other template.

import { prisma } from "@/lib/prisma";
import type { PaymentReminderStage } from "@/lib/payments/status";

export type TemplateVars = {
  firstName: string;
  amount: string; // pre-formatted, e.g. "$500"
  dueDate: string; // pre-formatted, e.g. "October 17"
  agentName: string;
  dealershipName: string;
};

const DEFAULT_TEMPLATES: { trigger: PaymentReminderStage; name: string; body: string }[] = [
  {
    trigger: "7_DAYS_BEFORE",
    name: "7 Days Before — Default",
    body: "Hi {{firstName}}, this is {{agentName}} from {{dealershipName}}. Just a reminder that you have a {{amount}} payment scheduled for {{dueDate}}. Please reach out to me if you have any questions.",
  },
  {
    trigger: "3_DAYS_BEFORE",
    name: "3 Days Before — Default",
    body: "Hi {{firstName}}, this is {{agentName}} from {{dealershipName}}. Your {{amount}} payment is coming up on {{dueDate}}. Let me know if you have any questions.",
  },
  {
    trigger: "1_DAY_BEFORE",
    name: "1 Day Before — Default",
    body: "Hi {{firstName}}, this is {{agentName}} from {{dealershipName}}. Just a reminder that your {{amount}} payment is due tomorrow. Please let me know if you have any questions.",
  },
  {
    trigger: "DUE_DATE",
    name: "Due Today — Default",
    body: "Hi {{firstName}}, this is {{agentName}} from {{dealershipName}}. Your scheduled {{amount}} payment is due today. Please reach out if you need anything.",
  },
  {
    trigger: "OVERDUE",
    name: "Overdue — Default",
    body: "Hi {{firstName}}, this is {{agentName}} from {{dealershipName}}. Our records show that your scheduled payment of {{amount}} is past due. Please contact me so we can get everything taken care of.",
  },
];

async function ensureDefaultTemplatesSeeded() {
  const count = await prisma.smsTemplate.count();
  if (count > 0) return;
  await prisma.smsTemplate.createMany({
    data: DEFAULT_TEMPLATES.map((t) => ({ name: t.name, trigger: t.trigger, body: t.body, active: true, isDefault: true })),
  });
}

export async function getSmsTemplates() {
  await ensureDefaultTemplatesSeeded();
  return prisma.smsTemplate.findMany({ orderBy: [{ trigger: "asc" }, { createdAt: "asc" }] });
}

/** The template a given reminder stage should use when sending
 * automatically: the first active template tagged for that stage
 * (whichever the dealer most recently marked active, if they made more
 * than one), falling back to null if they've turned every template for
 * that stage off. */
export async function getActiveTemplateForStage(stage: PaymentReminderStage) {
  await ensureDefaultTemplatesSeeded();
  return prisma.smsTemplate.findFirst({ where: { trigger: stage, active: true }, orderBy: { updatedAt: "desc" } });
}

export function renderTemplate(body: string, vars: TemplateVars): string {
  return body
    .replaceAll("{{firstName}}", vars.firstName)
    .replaceAll("{{amount}}", vars.amount)
    .replaceAll("{{dueDate}}", vars.dueDate)
    .replaceAll("{{agentName}}", vars.agentName)
    .replaceAll("{{dealershipName}}", vars.dealershipName);
}
