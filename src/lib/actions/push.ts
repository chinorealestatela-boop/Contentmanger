"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isPushConfigured } from "@/lib/push/webpush";
import { revalidatePath } from "next/cache";

export async function getPushPublicKey(): Promise<string | null> {
  if (!isPushConfigured()) return null;
  return process.env.VAPID_PUBLIC_KEY ?? null;
}

export async function savePushSubscription(sub: { endpoint: string; keys: { p256dh: string; auth: string } }, userAgent?: string) {
  const session = await auth();
  if (!session?.user) return { error: "Not signed in." };

  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    update: { userId: session.user.id, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent },
    create: { userId: session.user.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent },
  });
  revalidatePath("/settings/notifications");
  return { success: true };
}

export async function removePushSubscription(endpoint: string) {
  const session = await auth();
  if (!session?.user) return { error: "Not signed in." };
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: session.user.id } });
  revalidatePath("/settings/notifications");
  return { success: true };
}

export async function getMyPushSubscriptionCount(): Promise<number> {
  const session = await auth();
  if (!session?.user) return 0;
  return prisma.pushSubscription.count({ where: { userId: session.user.id } });
}
