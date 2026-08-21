"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function markNotificationRead(id: string) {
  const session = await auth();
  if (!session?.user) return;
  await prisma.notification.updateMany({
    where: { id, userId: session.user.id },
    data: { isRead: true },
  });
  revalidatePath("/", "layout");
}

export async function markAllNotificationsRead() {
  const session = await auth();
  if (!session?.user) return;
  await prisma.notification.updateMany({
    where: { userId: session.user.id, isRead: false },
    data: { isRead: true },
  });
  revalidatePath("/", "layout");
}

export async function getRecentNotifications() {
  const session = await auth();
  if (!session?.user) return [];
  return prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}
