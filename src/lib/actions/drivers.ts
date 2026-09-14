"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireScope } from "@/lib/queries/scope";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SimpleActionState } from "@/lib/actions/communications";

const optionalStr = z.string().optional().transform((v) => (v && v.length > 0 ? v : undefined));

const schema = z.object({
  firstName: z.string().min(1, "First name is required."),
  lastName: z.string().min(1, "Last name is required."),
  phone: optionalStr,
  email: optionalStr,
  licenseNumber: optionalStr,
  licenseExpiresAt: optionalStr,
  notes: optionalStr,
});

export async function createDriver(_prev: SimpleActionState, formData: FormData): Promise<SimpleActionState> {
  await requireScope();
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;

  const driver = await prisma.driver.create({
    data: {
      firstName: d.firstName,
      lastName: d.lastName,
      phone: d.phone,
      email: d.email,
      licenseNumber: d.licenseNumber,
      licenseExpiresAt: d.licenseExpiresAt ? new Date(d.licenseExpiresAt) : undefined,
      notes: d.notes,
      certifications: JSON.stringify([]),
    },
  });

  revalidatePath("/drivers");
  redirect(`/drivers/${driver.id}`);
}

const updateSchema = schema.extend({ driverId: z.string().min(1) });

export async function updateDriver(_prev: SimpleActionState, formData: FormData): Promise<SimpleActionState> {
  await requireScope();
  const parsed = updateSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { driverId, ...d } = parsed.data;

  await prisma.driver.update({
    where: { id: driverId },
    data: {
      firstName: d.firstName,
      lastName: d.lastName,
      phone: d.phone,
      email: d.email,
      licenseNumber: d.licenseNumber,
      licenseExpiresAt: d.licenseExpiresAt ? new Date(d.licenseExpiresAt) : undefined,
      notes: d.notes,
    },
  });

  revalidatePath("/drivers");
  revalidatePath(`/drivers/${driverId}`);
  return { success: "Saved." };
}

export async function setDriverStatus(driverId: string, status: string) {
  await requireScope();
  await prisma.driver.update({ where: { id: driverId }, data: { status } });
  revalidatePath("/drivers");
  revalidatePath(`/drivers/${driverId}`);
  revalidatePath("/driver");
  revalidatePath("/operations");
}
