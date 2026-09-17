"use server";

import { requireScope } from "@/lib/queries/scope";
import { revalidatePath } from "next/cache";
import { savePaymentAutomationSettings, type PaymentAutomationSettings } from "@/lib/payments/reminders";
import { PAYMENT_REMINDER_STAGES } from "@/lib/payments/status";
import type { SimpleActionState } from "@/lib/actions/communications";

/** Reads the Automation Center form (one enabled/sms/task/notify checkbox
 * triple per reminder stage) and saves it to the Setting-backed config —
 * see src/lib/payments/reminders.ts for how the sweep reads it back. */
export async function savePaymentAutomation(_prev: SimpleActionState, formData: FormData): Promise<SimpleActionState> {
  await requireScope();

  const stages = {} as PaymentAutomationSettings["stages"];
  for (const { value } of PAYMENT_REMINDER_STAGES) {
    stages[value] = {
      enabled: formData.get(`${value}_enabled`) === "on",
      sms: formData.get(`${value}_sms`) === "on",
      task: formData.get(`${value}_task`) === "on",
      notify: formData.get(`${value}_notify`) === "on",
    };
  }

  await savePaymentAutomationSettings({ stages });
  revalidatePath("/payments/settings");
  return { success: "Automation settings saved." };
}
