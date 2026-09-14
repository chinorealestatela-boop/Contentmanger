"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireScope } from "@/lib/queries/scope";
import { logActivity } from "@/lib/activity";
import { runAutomation, stopFollowUpsForLead } from "@/lib/automation/engine";
import { findVehicleConflicts } from "@/lib/queries/vehicles";
import { computePricing } from "@/lib/pricing";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SimpleActionState } from "@/lib/actions/communications";

const optionalStr = z.string().optional().transform((v) => (v && v.length > 0 ? v : undefined));
const optionalNum = z.string().optional().transform((v) => (v && v.length > 0 ? Number(v) : undefined));
let bookingSeqCache: number | null = null;

async function nextBookingNumber() {
  if (bookingSeqCache === null) {
    const count = await prisma.booking.count();
    bookingSeqCache = 1000 + count;
  }
  bookingSeqCache += 1;
  return `SX-${bookingSeqCache}`;
}

const schema = z.object({
  customerId: optionalStr,
  leadId: optionalStr,
  // New-customer fallback fields (used when customerId isn't provided)
  firstName: optionalStr,
  lastName: optionalStr,
  phone: optionalStr,
  email: optionalStr,

  vehicleId: optionalStr,
  driverId: optionalStr,
  serviceType: z.string().min(1, "Select a service type."),
  pickupAddress: optionalStr,
  dropoffAddress: optionalStr,
  additionalStops: optionalStr,
  date: z.string().min(1, "Date is required."),
  pickupTime: z.string().min(1, "Pickup time is required."),
  endTime: optionalStr,
  passengers: optionalNum,

  flightNumber: optionalStr,
  flightAirline: optionalStr,
  flightAirport: optionalStr,

  specialInstructions: optionalStr,
  amenities: z.array(z.string()).optional().default([]),

  baseRate: optionalNum,
  driverFee: optionalNum,
  mileageFee: optionalNum,
  additionalFees: optionalNum,
  discount: optionalNum,
});

export type BookingActionState = (SimpleActionState & { bookingId?: string }) | null;

export async function createBooking(_prev: BookingActionState, formData: FormData): Promise<BookingActionState> {
  const scope = await requireScope();
  const raw = Object.fromEntries(formData.entries());
  const amenities = formData.getAll("amenities").map(String);
  const parsed = schema.safeParse({ ...raw, amenities });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const d = parsed.data;

  let customerId = d.customerId;
  if (!customerId) {
    if (!d.firstName || !d.lastName) return { error: "Provide a customer or a first/last name." };
    const existing = d.phone || d.email ? await prisma.customer.findFirst({ where: { OR: [d.phone ? { phone: d.phone } : undefined, d.email ? { email: d.email } : undefined].filter(Boolean) as never[] } }) : null;
    if (existing) {
      customerId = existing.id;
    } else {
      const c = await prisma.customer.create({ data: { firstName: d.firstName, lastName: d.lastName, phone: d.phone, email: d.email, ownerId: scope.userId } });
      customerId = c.id;
    }
  }

  const bookingDate = new Date(d.date);

  if (d.vehicleId) {
    const conflicts = await findVehicleConflicts(d.vehicleId, bookingDate, d.pickupTime, d.endTime ?? null);
    if (conflicts.length > 0) {
      return { error: `That vehicle is already booked for ${conflicts[0].customer.firstName} ${conflicts[0].customer.lastName} at ${conflicts[0].pickupTime} on this date. Choose a different vehicle or time.` };
    }
  }

  const pricing = computePricing({
    baseRate: d.baseRate ?? 0,
    driverFee: d.driverFee ?? 0,
    mileageFee: d.mileageFee ?? 0,
    additionalFees: d.additionalFees ?? 0,
    discount: d.discount ?? 0,
  });

  const booking = await prisma.booking.create({
    data: {
      bookingNumber: await nextBookingNumber(),
      customerId,
      leadId: d.leadId,
      vehicleId: d.vehicleId,
      driverId: d.driverId,
      serviceType: d.serviceType,
      pickupAddress: d.pickupAddress,
      dropoffAddress: d.dropoffAddress,
      additionalStops: d.additionalStops ? JSON.stringify(d.additionalStops.split(",").map((s) => s.trim()).filter(Boolean)) : undefined,
      date: bookingDate,
      pickupTime: d.pickupTime,
      endTime: d.endTime,
      passengers: d.passengers ?? 1,
      flightNumber: d.flightNumber,
      flightAirline: d.flightAirline,
      flightAirport: d.flightAirport,
      specialInstructions: d.specialInstructions,
      amenities: JSON.stringify(d.amenities),
      baseRate: pricing.baseRate,
      driverFee: pricing.driverFee,
      mileageFee: pricing.mileageFee,
      additionalFees: pricing.additionalFees,
      discount: pricing.discount,
      taxAmount: pricing.taxAmount,
      totalPrice: pricing.totalPrice,
      remainingBalance: pricing.totalPrice,
      bookingStatus: d.vehicleId ? (d.driverId ? "DRIVER_ASSIGNED" : "CONFIRMED") : "RESERVED",
      opsStage: d.driverId ? "DRIVER_ASSIGNED" : "UPCOMING",
    },
  });

  if (d.vehicleId) await prisma.vehicle.update({ where: { id: d.vehicleId }, data: { availability: "RESERVED" } });
  if (d.driverId) await prisma.driver.update({ where: { id: d.driverId }, data: { status: "ASSIGNED" } });

  await logActivity({ customerId, leadId: d.leadId, bookingId: booking.id, type: "BOOKING_CREATED", description: `Booking ${booking.bookingNumber} created — ${d.serviceType.replace(/_/g, " ")}.`, actorId: scope.userId });

  if (d.leadId) {
    const bookedStage = await prisma.pipelineStage.findFirst({ where: { name: "Booked" } });
    await prisma.lead.update({ where: { id: d.leadId }, data: { status: "BOOKED", bookedAt: new Date(), stageId: bookedStage?.id } });
    await stopFollowUpsForLead(d.leadId, "BOOKED");
  }

  await runAutomation("BOOKING_CONFIRMED", { customerId, leadId: d.leadId, bookingId: booking.id, actorId: scope.userId });

  revalidatePath("/bookings");
  revalidatePath("/dashboard");
  revalidatePath("/operations");
  revalidatePath("/calendar");
  if (d.leadId) revalidatePath(`/leads/${d.leadId}`);
  redirect(`/bookings/${booking.id}`);
}

export async function assignDriverToBooking(bookingId: string, driverId: string | null) {
  const scope = await requireScope();
  const booking = await prisma.booking.update({
    where: { id: bookingId },
    data: { driverId, bookingStatus: driverId ? "DRIVER_ASSIGNED" : "CONFIRMED", opsStage: driverId ? "DRIVER_ASSIGNED" : "UPCOMING" },
  });
  if (driverId) {
    await prisma.driver.update({ where: { id: driverId }, data: { status: "ASSIGNED" } });
    await logActivity({ customerId: booking.customerId, bookingId, type: "DRIVER_ASSIGNED", description: "Chauffeur assigned to booking.", actorId: scope.userId });
  }
  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath("/bookings");
  revalidatePath("/operations");
  revalidatePath("/drivers");
}

export async function assignVehicleToBooking(bookingId: string, vehicleId: string | null) {
  await requireScope();
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) return { error: "Booking not found." };
  if (vehicleId) {
    const conflicts = await findVehicleConflicts(vehicleId, booking.date, booking.pickupTime, booking.endTime, bookingId);
    if (conflicts.length > 0) return { error: "That vehicle is already booked at this time." };
  }
  await prisma.booking.update({ where: { id: bookingId }, data: { vehicleId } });
  if (vehicleId) await prisma.vehicle.update({ where: { id: vehicleId }, data: { availability: "RESERVED" } });
  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath("/bookings");
  revalidatePath("/fleet");
  return { success: "Vehicle assigned." };
}

export async function cancelBooking(bookingId: string, reason?: string) {
  const scope = await requireScope();
  const booking = await prisma.booking.update({ where: { id: bookingId }, data: { bookingStatus: "CANCELLED", opsStage: "UPCOMING", cancelledAt: new Date(), cancellationReason: reason } });
  if (booking.vehicleId) await prisma.vehicle.update({ where: { id: booking.vehicleId }, data: { availability: "AVAILABLE" } });
  if (booking.driverId) await prisma.driver.update({ where: { id: booking.driverId }, data: { status: "AVAILABLE" } });
  await logActivity({ customerId: booking.customerId, bookingId, type: "AUTOMATION", description: `Booking cancelled.${reason ? ` Reason: ${reason}` : ""}`, actorId: scope.userId });
  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath("/bookings");
  revalidatePath("/operations");
  revalidatePath("/calendar");
}
