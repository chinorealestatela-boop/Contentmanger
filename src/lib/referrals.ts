// Referral-program settings + read helpers. Follows the same Setting-row
// pattern as everything else configurable in this app (booking hours,
// payment automation) — see getBookingSettings/getPaymentAutomationSettings
// for the sibling implementations this mirrors.

import { prisma } from "@/lib/prisma";

export type ReferralProgramSettings = {
  defaultRewardAmount: number;
};

export const DEFAULT_REFERRAL_PROGRAM_SETTINGS: ReferralProgramSettings = {
  defaultRewardAmount: 200,
};

export async function getReferralProgramSettings(): Promise<ReferralProgramSettings> {
  const row = await prisma.setting.findUnique({ where: { key: "referralProgram" } });
  if (!row) return DEFAULT_REFERRAL_PROGRAM_SETTINGS;
  try {
    const stored = JSON.parse(row.value) as Partial<ReferralProgramSettings>;
    return { ...DEFAULT_REFERRAL_PROGRAM_SETTINGS, ...stored };
  } catch {
    return DEFAULT_REFERRAL_PROGRAM_SETTINGS;
  }
}

export async function saveReferralProgramSettings(settings: ReferralProgramSettings) {
  await prisma.setting.upsert({
    where: { key: "referralProgram" },
    update: { value: JSON.stringify(settings) },
    create: { key: "referralProgram", value: JSON.stringify(settings) },
  });
}

/** Aggregate referral stats for one customer's profile — always computed
 * from the underlying Referral rows (never stored) so it can't drift. */
export function summarizeReferrals(referrals: { rewardAmount: number; status: string }[]) {
  const count = referrals.length;
  const totalReward = referrals.reduce((sum, r) => sum + r.rewardAmount, 0);
  const paidReward = referrals.filter((r) => r.status === "PAID").reduce((sum, r) => sum + r.rewardAmount, 0);
  const pendingCount = referrals.filter((r) => r.status === "PENDING").length;
  return { count, totalReward, paidReward, pendingCount };
}
