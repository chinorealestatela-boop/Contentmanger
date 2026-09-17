"use server";

import { requireScope } from "@/lib/queries/scope";
import { revalidatePath } from "next/cache";
import { savePaymentAutomationSettings, type PaymentAutomationSettings } from "@/lib/payments/reminders";
import { ALL_PAYMENT_REMINDER_STAGES } from "@/lib/payments/status";
import type { SimpleActionState } from "@/lib/actions/communications";

/** Reads the Automation Center form (one enabled/sms/task/notify checkbox
 * triple per reminder stage, plus the preferred send hour and overdue
 * repeat cadence) and saves it to the Setting-backed config — see
 * src/lib/payments/reminders.ts for how the sweep reads it back. */
export async function savePaymentAutomation(_prev: SimpleActionState, formData: FormData): Promise<SimpleActionState> {
  await requireScope();

  const stages = {} as PaymentAutomationSettings["stages"];
  for (const { value } of ALL_PAYMENT_REMINDER_STAGES) {
    stages[value] = {
      enabled: formData.get(`${value}_enabled`) === "on",
      sms: formData.get(`${value}_sms`) === "on",
      task: formData.get(`${value}_task`) === "on",
      notify: formData.get(`${value}_notify`) === "on",
    };
  }

  const preferredHour = Math.min(23, Math.max(0, Number(formData.get("preferredHour")) || 9));
  const overdueRepeat = {
    enabled: formData.get("overdueRepeatEnabled") === "on",
    intervalDays: Math.max(1, Number(formData.get("overdueRepeatIntervalDays")) || 3),
  };

  await savePaymentAutomationSettings({ stages, preferredHour, overdueRepeat });
  revalidatePath("/payments/settings");
  return { success: "Automation settings saved." };
}
