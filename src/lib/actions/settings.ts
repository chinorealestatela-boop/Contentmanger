"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { requireScope } from "@/lib/queries/scope";
import { revalidatePath } from "next/cache";
import type { SimpleActionState } from "@/lib/actions/communications";
import { DEFAULT_PERMISSIONS, type Permissions } from "@/lib/permissions";

// ── Profile ──────────────────────────────────────────────────────────
const profileSchema = z.object({
  firstName: z.string().min(1, "First name is required."),
  lastName: z.string().min(1, "Last name is required."),
  title: z.string().optional(),
  phone: z.string().optional(),
  avatarColor: z.string().optional(),
});

export async function updateProfile(_prev: SimpleActionState, formData: FormData): Promise<SimpleActionState> {
  const scope = await requireScope();
  const parsed = profileSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  await prisma.user.update({ where: { id: scope.userId }, data: parsed.data });
  revalidatePath("/settings/profile");
  revalidatePath("/", "layout");
  return { success: "Profile updated." };
}

// ── Password ─────────────────────────────────────────────────────────
const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required."),
  newPassword: z.string().min(8, "New password must be at least 8 characters."),
});

export async function changePassword(_prev: SimpleActionState, formData: FormData): Promise<SimpleActionState> {
  const scope = await requireScope();
  const parsed = passwordSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const user = await prisma.user.findUnique({ where: { id: scope.userId } });
  if (!user) return { error: "User not found." };

  const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!valid) return { error: "Current password is incorrect." };

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
  await prisma.user.update({ where: { id: scope.userId }, data: { passwordHash } });
  return { success: "Password changed." };
}

// ── Notification preferences ────────────────────────────────────────
export async function updateNotificationPrefs(prefs: Record<string, boolean>) {
  const session = await auth();
  if (!session?.user) return;
  await prisma.user.update({ where: { id: session.user.id }, data: { notificationPrefs: JSON.stringify(prefs) } });
  revalidatePath("/settings/notifications");
}

// ── Lead sources ─────────────────────────────────────────────────────
export async function createLeadSource(_prev: SimpleActionState, formData: FormData): Promise<SimpleActionState> {
  await requireScope();
  const name = String(formData.get("name") || "").trim();
  if (!name) return { error: "Name is required." };
  const count = await prisma.leadSource.count();
  await prisma.leadSource.create({ data: { name, order: count } });
  revalidatePath("/settings/lead-sources");
  return { success: "Added." };
}

export async function toggleLeadSource(id: string, active: boolean) {
  await requireScope();
  await prisma.leadSource.update({ where: { id }, data: { active } });
  revalidatePath("/settings/lead-sources");
}

// ── Lost reasons ─────────────────────────────────────────────────────
export async function createLostReason(_prev: SimpleActionState, formData: FormData): Promise<SimpleActionState> {
  await requireScope();
  const name = String(formData.get("name") || "").trim();
  if (!name) return { error: "Name is required." };
  const count = await prisma.lostReason.count();
  await prisma.lostReason.create({ data: { name, order: count } });
  revalidatePath("/settings/lost-reasons");
  return { success: "Added." };
}

export async function toggleLostReason(id: string, active: boolean) {
  await requireScope();
  await prisma.lostReason.update({ where: { id }, data: { active } });
  revalidatePath("/settings/lost-reasons");
}

// ── Pipeline stages ──────────────────────────────────────────────────
const stageSchema = z.object({
  name: z.string().min(1, "Name is required."),
  color: z.string().default("#2563eb"),
  isClosedWon: z.string().optional(),
  isClosedLost: z.string().optional(),
});

export async function createPipelineStage(_prev: SimpleActionState, formData: FormData): Promise<SimpleActionState> {
  await requireScope();
  const parsed = stageSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const count = await prisma.pipelineStage.count();
  await prisma.pipelineStage.create({
    data: {
      name: parsed.data.name,
      color: parsed.data.color,
      order: count,
      isClosedWon: parsed.data.isClosedWon === "on",
      isClosedLost: parsed.data.isClosedLost === "on",
    },
  });
  revalidatePath("/settings/pipeline-stages");
  revalidatePath("/pipeline");
  return { success: "Added." };
}

export async function toggleStageActive(id: string, active: boolean) {
  await requireScope();
  await prisma.pipelineStage.update({ where: { id }, data: { active } });
  revalidatePath("/settings/pipeline-stages");
  revalidatePath("/pipeline");
}

export async function moveStage(id: string, direction: "up" | "down") {
  await requireScope();
  const stages = await prisma.pipelineStage.findMany({ orderBy: { order: "asc" } });
  const idx = stages.findIndex((s) => s.id === id);
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (idx < 0 || swapIdx < 0 || swapIdx >= stages.length) return;

  await prisma.$transaction([
    prisma.pipelineStage.update({ where: { id: stages[idx].id }, data: { order: stages[swapIdx].order } }),
    prisma.pipelineStage.update({ where: { id: stages[swapIdx].id }, data: { order: stages[idx].order } }),
  ]);
  revalidatePath("/settings/pipeline-stages");
  revalidatePath("/pipeline");
}

// ── User management (admin) ─────────────────────────────────────────
const createUserSchema = z.object({
  firstName: z.string().min(1, "First name is required."),
  lastName: z.string().min(1, "Last name is required."),
  email: z.string().email("Enter a valid email."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  roleId: z.string().min(1, "Select a role."),
  title: z.string().optional(),
});

export async function createUserAccount(_prev: SimpleActionState, formData: FormData): Promise<SimpleActionState> {
  const scope = await requireScope();
  if (scope.role !== "ADMIN") return { error: "Only admins can create users." };

  const parsed = createUserSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const email = parsed.data.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "A user with that email already exists." };

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  await prisma.user.create({
    data: {
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      email,
      passwordHash,
      roleId: parsed.data.roleId,
      title: parsed.data.title,
    },
  });

  revalidatePath("/settings/users");
  return { success: "User created." };
}

export async function toggleUserActive(userId: string, isActive: boolean) {
  const scope = await requireScope();
  if (scope.role !== "ADMIN") return;
  await prisma.user.update({ where: { id: userId }, data: { isActive } });
  revalidatePath("/settings/users");
}

export async function updateUserRole(userId: string, roleId: string) {
  const scope = await requireScope();
  if (scope.role !== "ADMIN") return;
  await prisma.user.update({ where: { id: userId }, data: { roleId } });
  revalidatePath("/settings/users");
}

// ── Roles & permissions (admin) ─────────────────────────────────────
export async function updateRolePermissions(roleId: string, permissions: Permissions) {
  const scope = await requireScope();
  if (scope.role !== "ADMIN") return;
  await prisma.role.update({ where: { id: roleId }, data: { permissions: JSON.stringify(permissions) } });
  revalidatePath("/settings/roles");
}

export async function ensureDefaultPermissionsShape(roleName: string): Promise<Permissions> {
  return DEFAULT_PERMISSIONS[roleName] ?? DEFAULT_PERMISSIONS.SALESPERSON;
}

// ── Dealership settings ─────────────────────────────────────────────
const dealershipSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  phone: z.string().optional(),
  timezone: z.string().optional(),
});

export async function updateDealershipSettings(_prev: SimpleActionState, formData: FormData): Promise<SimpleActionState> {
  const scope = await requireScope();
  if (scope.role !== "ADMIN" && scope.role !== "MANAGER") return { error: "You don't have permission to change this." };
  const parsed = dealershipSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  await prisma.setting.upsert({
    where: { key: "dealership" },
    update: { value: JSON.stringify(parsed.data) },
    create: { key: "dealership", value: JSON.stringify(parsed.data) },
  });
  revalidatePath("/settings/dealership");
  return { success: "Saved." };
}
