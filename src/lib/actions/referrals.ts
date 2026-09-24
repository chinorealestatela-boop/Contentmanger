"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireScope } from "@/lib/queries/scope";
import { logActivity } from "@/lib/activity";
import { getReferralProgramSettings, saveReferralProgramSettings } from "@/lib/referrals";
import { getThankYouTemplate, saveThankYouTemplate } from "@/lib/payments/templates";
import { formatCurrency } from "@/lib/format";
import { revalidatePath } from "next/cache";
import type { SimpleActionState } from "@/lib/actions/communications";

const linkReferralSchema = z.object({
  referrerId: z.string().min(1),
  referredCustomerId: z.string().min(1),
});

/** Connects an existing customer to whoever referred them. One Referral
 * row per referred customer (referredCustomerId is unique in the schema),
 * so re-submitting for the same customer updates who gets credit rather
 * than creating a second row. Reward amount defaults to the dealership's
 * configured referral amount at the moment the referral is recorded. */
export async function linkReferral(_prev: SimpleActionState, formData: FormData): Promise<SimpleActionState> {
  const scope = await requireScope();
  const parsed = linkReferralSchema.safeParse({
    referrerId: formData.get("referrerId"),
    referredCustomerId: formData.get("referredCustomerId"),
  });
  if (!parsed.success) return { error: "Select who made the referral." };
  const { referrerId, referredCustomerId } = parsed.data;
  if (referrerId === referredCustomerId) return { error: "A customer can't refer themselves." };

  const [referrer, referred] = await Promise.all([
    prisma.customer.findUnique({ where: { id: referrerId } }),
    prisma.customer.findUnique({ where: { id: referredCustomerId } }),
  ]);
  if (!referrer || !referred) return { error: "Customer not found." };

  const settings = await getReferralProgramSettings();

  await prisma.referral.upsert({
    where: { referredCustomerId },
    update: { referrerId, createdById: scope.userId },
    create: {
      referrerId,
      referredCustomerId,
      rewardAmount: settings.defaultRewardAmount,
      createdById: scope.userId,
    },
  });

  await logActivity({
    customerId: referrerId,
    type: "REFERRAL_ADDED",
    description: `Referred ${referred.firstName} ${referred.lastName} — eligible for a ${formatCurrency(settings.defaultRewardAmount)} referral reward.`,
    actorId: scope.userId,
    metadata: { referredCustomerId },
  });
  await logActivity({
    customerId: referredCustomerId,
    type: "REFERRAL_ADDED",
    description: `Referred by ${referrer.firstName} ${referrer.lastName}.`,
    actorId: scope.userId,
    metadata: { referrerId },
  });

  revalidatePath(`/customers/${referrerId}`);
  revalidatePath(`/customers/${referredCustomerId}`);
  return { success: "Referral linked." };
}

export async function removeReferral(referralId: string) {
  const scope = await requireScope();
  const referral = await prisma.referral.findUnique({ where: { id: referralId } });
  if (!referral) return;
  await prisma.referral.delete({ where: { id: referralId } });
  await logActivity({
    customerId: referral.referrerId,
    type: "REFERRAL_REMOVED",
    description: "Referral link removed.",
    actorId: scope.userId,
  });
  revalidatePath(`/customers/${referral.referrerId}`);
  revalidatePath(`/customers/${referral.referredCustomerId}`);
}

/** Reward status is only ever changed here, by a person — nothing in the
 * automated follow-up flow ever marks a referral Paid on its own (per "do
 * not automatically mark the referral as paid"). */
export async function updateReferralStatus(referralId: string, status: "PENDING" | "PAID" | "INELIGIBLE") {
  const scope = await requireScope();
  const referral = await prisma.referral.update({ where: { id: referralId }, data: { status } });
  await logActivity({
    customerId: referral.referrerId,
    type: "REFERRAL_STATUS_CHANGED",
    description: `Referral reward marked ${status === "PAID" ? "Paid" : status === "INELIGIBLE" ? "Ineligible" : "Pending"} (${formatCurrency(referral.rewardAmount)}).`,
    actorId: scope.userId,
    metadata: { referralId },
  });
  revalidatePath(`/customers/${referral.referrerId}`);
}

export async function setReferralEligibility(customerId: string, eligible: boolean) {
  await requireScope();
  await prisma.customer.update({ where: { id: customerId }, data: { referralEligible: eligible } });
  revalidatePath(`/customers/${customerId}`);
}

const settingsSchema = z.object({
  defaultRewardAmount: z.coerce.number().min(0),
  thankYouMessage: z.string().min(1, "Message can't be empty."),
});

/** Saves both the referral reward default and the thank-you message body
 * together — they're edited from the same settings panel. */
export async function saveReferralSettings(_prev: SimpleActionState, formData: FormData): Promise<SimpleActionState> {
  await requireScope();
  const parsed = settingsSchema.safeParse({
    defaultRewardAmount: formData.get("defaultRewardAmount"),
    thankYouMessage: formData.get("thankYouMessage"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  await Promise.all([
    saveReferralProgramSettings({ defaultRewardAmount: parsed.data.defaultRewardAmount }),
    saveThankYouTemplate(parsed.data.thankYouMessage),
  ]);

  revalidatePath("/payments/settings");
  return { success: "Referral settings saved." };
}

export async function getReferralSettingsForForm() {
  const [settings, template] = await Promise.all([getReferralProgramSettings(), getThankYouTemplate()]);
  return { defaultRewardAmount: settings.defaultRewardAmount, thankYouMessage: template.body };
}
