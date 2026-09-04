"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { requireScope } from "@/lib/queries/scope";
import { revalidatePath } from "next/cache";
import type { SimpleActionState } from "@/lib/actions/communications";
import { DEFAULT_PERMISSIONS, type Permissions } from "@/lib/permissions";
import { headers } from "next/headers";
import { saveBookingSettings, type BookingSettings } from "@/lib/availability";
import { sendPendingReminders } from "@/lib/actions/reminders";

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
// Shape: { [notifType]: { push?: boolean; sms?: boolean; email?: boolean } }
// — see src/lib/notify/adminAlert.ts, the one place this is read.
export async function updateNotificationPrefs(prefs: Record<string, { push?: boolean; sms?: boolean; email?: boolean }>) {
  const session = await auth();
  if (!session?.user) return;
  await prisma.user.update({ where: { id: session.user.id }, data: { notificationPrefs: JSON.stringify(prefs) } });
  revalidatePath("/settings/notifications");
}

const notifyContactSchema = z.object({
  notifyPhone: z.string().trim().optional(),
  notifyEmail: z.string().trim().email("Enter a valid email address.").optional().or(z.literal("")),
});

/** Where alerts are actually sent — separate from the login email/phone on
 * the Profile page, so updating this can never change how the user signs
 * in. Left blank, each falls back to the login value (see adminAlert.ts). */
export async function updateNotifyContact(_prev: SimpleActionState, formData: FormData): Promise<SimpleActionState> {
  const scope = await requireScope();
  const parsed = notifyContactSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  await prisma.user.update({
    where: { id: scope.userId },
    data: { notifyPhone: parsed.data.notifyPhone || null, notifyEmail: parsed.data.notifyEmail || null },
  });
  revalidatePath("/settings/notifications");
  return { success: "Saved." };
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

// ── Booking & availability settings ─────────────────────────────────
const dayHoursSchema = z.object({ enabled: z.boolean(), start: z.string(), end: z.string() });
const bookingSettingsSchema = z.object({
  timezone: z.string().min(1),
  agentName: z.string().min(1),
  location: z.string().min(1),
  hours: z.record(z.string(), dayHoursSchema),
  appointmentDurationMinutes: z.coerce.number().int().min(5).max(240),
  bufferMinutes: z.coerce.number().int().min(0).max(120),
  breaks: z.array(z.object({ start: z.string(), end: z.string() })),
  blackoutDates: z.array(z.string()),
  maxAppointmentsPerDay: z.coerce.number().int().min(1).nullable(),
  minLeadTimeHours: z.coerce.number().min(0).max(72),
  maxBookingWindowDays: z.coerce.number().int().min(1).max(365),
  reminders: z.object({
    sendImmediateConfirmation: z.boolean(),
    send24HourReminder: z.boolean(),
    send2HourReminder: z.boolean(),
  }),
  primarySalespersonId: z.string().optional(),
});

export type BookingSettingsActionState = SimpleActionState;

/** Called with a JSON-serialized BookingSettings blob (built client-side by
 * BookingSettingsForm) since the shape is too nested for plain FormData
 * fields. Still a form-backed Server Action so useActionState works the
 * same way as every other settings form in the app. */
export async function updateBookingSettings(_prev: BookingSettingsActionState, formData: FormData): Promise<BookingSettingsActionState> {
  const scope = await requireScope();
  if (scope.role !== "ADMIN" && scope.role !== "MANAGER") return { error: "You don't have permission to change this." };

  let payload: unknown;
  try {
    payload = JSON.parse(String(formData.get("payload") ?? "{}"));
  } catch {
    return { error: "Invalid settings payload." };
  }

  const parsed = bookingSettingsSchema.safeParse(payload);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { primarySalespersonId, ...settings } = parsed.data;

  await saveBookingSettings(settings as BookingSettings);
  if (primarySalespersonId) {
    await prisma.setting.upsert({
      where: { key: "primarySalesperson" },
      update: { value: JSON.stringify({ userId: primarySalespersonId }) },
      create: { key: "primarySalesperson", value: JSON.stringify({ userId: primarySalespersonId }) },
    });
  }

  revalidatePath("/settings/booking");
  return { success: "Booking settings saved." };
}

export async function getPrimarySalespersonIdSetting(): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key: "primarySalesperson" } });
  if (!row) return null;
  try {
    return (JSON.parse(row.value) as { userId?: string }).userId ?? null;
  } catch {
    return null;
  }
}

export async function runReminderChecksNow(): Promise<{ sent24h: number; sent2h: number; checked: number }> {
  await requireScope();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const result = await sendPendingReminders(`${proto}://${host}`);
  revalidatePath("/messages");
  return result;
}
