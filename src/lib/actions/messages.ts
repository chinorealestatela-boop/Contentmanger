"use server";

// Manual retry for a confirmation/reminder message that failed to send
// (real Twilio/Resend error — bad number, provider outage, etc.). The
// original body/subject is preserved verbatim from the failed attempt, so
// retrying doesn't regenerate copy from possibly-changed settings; it just
// gives the same message another shot through the same provider path
// (sendSms/sendEmail), which logs a fresh SmsMessage/EmailMessage row.

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireScope } from "@/lib/queries/scope";
import { sendSms } from "@/lib/sms/provider";
import { sendEmail } from "@/lib/email/provider";
import type { SmsType } from "@/lib/sms/provider";
import type { EmailType } from "@/lib/email/provider";

export async function retrySmsMessage(id: string) {
  await requireScope();
  const msg = await prisma.smsMessage.findUnique({ where: { id } });
  if (!msg) return { error: "Message not found." };
  if (msg.status !== "FAILED") return { error: "Only failed messages can be retried." };

  const result = await sendSms({
    customerId: msg.customerId,
    appointmentId: msg.appointmentId,
    toPhone: msg.toPhone,
    type: msg.type as SmsType,
    body: msg.body,
  });

  revalidatePath(`/customers/${msg.customerId}`);
  return { success: true, sent: result.sent, simulated: result.simulated };
}

export async function retryEmailMessage(id: string) {
  await requireScope();
  const msg = await prisma.emailMessage.findUnique({ where: { id } });
  if (!msg) return { error: "Message not found." };
  if (msg.status !== "FAILED") return { error: "Only failed messages can be retried." };

  const result = await sendEmail({
    customerId: msg.customerId,
    appointmentId: msg.appointmentId,
    toEmail: msg.toEmail,
    type: msg.type as EmailType,
    subject: msg.subject,
    html: msg.body,
  });

  revalidatePath(`/customers/${msg.customerId}`);
  return { success: true, sent: result.sent, simulated: result.simulated };
}
