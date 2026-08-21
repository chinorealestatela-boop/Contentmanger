"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";
import { DEFAULT_PERMISSIONS } from "@/lib/permissions";

export type ActionState = { error?: string; success?: string; resetLink?: string } | null;

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

export async function loginAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/dashboard",
    });
    return { success: "Logged in." };
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: "Invalid email or password." };
    }
    // NEXT_REDIRECT is thrown by next-auth on success; rethrow so Next.js handles it.
    throw err;
  }
}

const registerSchema = z.object({
  firstName: z.string().min(1, "First name is required."),
  lastName: z.string().min(1, "Last name is required."),
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  title: z.string().optional(),
});

export async function registerAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = registerSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    password: formData.get("password"),
    title: formData.get("title") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const email = parsed.data.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "An account with that email already exists." };
  }

  let role = await prisma.role.findUnique({ where: { name: "SALESPERSON" } });
  if (!role) {
    role = await prisma.role.create({
      data: {
        name: "SALESPERSON",
        label: "Salesperson",
        description: "Manages assigned customers and leads.",
        permissions: JSON.stringify(DEFAULT_PERMISSIONS.SALESPERSON),
      },
    });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  await prisma.user.create({
    data: {
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      email,
      passwordHash,
      title: parsed.data.title,
      roleId: role.id,
      avatarColor: pickColor(),
    },
  });

  try {
    await signIn("credentials", { email, password: parsed.data.password, redirectTo: "/dashboard" });
    return { success: "Account created." };
  } catch (err) {
    if (err instanceof AuthError) return { error: "Account created — please log in." };
    throw err;
  }
}

function pickColor() {
  const colors = ["#2563eb", "#0d9488", "#7c3aed", "#dc2626", "#ea580c", "#16a34a", "#db2777"];
  return colors[Math.floor(Math.random() * colors.length)];
}

const forgotSchema = z.object({ email: z.string().email("Enter a valid email address.") });

export async function forgotPasswordAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = forgotSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const email = parsed.data.email.toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email } });

  // Always respond the same way whether or not the account exists, to avoid
  // leaking which emails are registered.
  const generic: ActionState = {
    success: "If an account exists for that email, a reset link has been generated below.",
  };

  if (!user) return generic;

  const token = crypto.randomBytes(32).toString("hex");
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60), // 1 hour
    },
  });

  // No email provider is configured in v1 — the reset link is surfaced
  // directly in the UI instead of being emailed. Once an email integration
  // is connected (see Settings → Integrations), this can send it instead.
  return { ...generic, resetLink: `/reset-password?token=${token}` };
}

const resetSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export async function resetPasswordAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = resetSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const resetToken = await prisma.passwordResetToken.findUnique({ where: { token: parsed.data.token } });
  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
    return { error: "This reset link is invalid or has expired. Please request a new one." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  await prisma.$transaction([
    prisma.user.update({ where: { id: resetToken.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: new Date() } }),
  ]);

  return { success: "Password updated. You can now log in." };
}
