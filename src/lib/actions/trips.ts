"use server";

import { prisma } from "@/lib/prisma";
import { requireScope } from "@/lib/queries/scope";
import { logActivity } from "@/lib/activity";
import { runAutomation } from "@/lib/automation/engine";
import { revalidatePath } from "next/cache";

function revalidateAll(bookingId: string) {
  revalidatePath("/operations");
  revalidatePath("/bookings");
  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath("/driver");
  revalidatePath("/dashboard");
  revalidatePath("/live-map");
}

async function ensureTrip(bookingId: string) {
  const existing = await prisma.trip.findUnique({ where: { bookingId } });
  if (existing) return existing;
  return prisma.trip.create({ data: { bookingId } });
}

export async function acceptTrip(bookingId: string) {
  const scope = await requireScope();
  await ensureTrip(bookingId);
  const booking = await prisma.booking.update({
    where: { id: bookingId },
    data: { bookingStatus: "DRIVER_ASSIGNED", opsStage: "DRIVER_ASSIGNED" },
  });
  await prisma.trip.update({ where: { bookingId }, data: { status: "ACCEPTED", acceptedAt: new Date() } });
  if (booking.driverId) await prisma.driver.update({ where: { id: booking.driverId }, data: { status: "ASSIGNED" } });
  await logActivity({ customerId: booking.customerId, bookingId, type: "DRIVER_ASSIGNED", description: "Chauffeur accepted the trip.", actorId: scope.userId });
  revalidateAll(bookingId);
}

export async function startTrip(bookingId: string) {
  const scope = await requireScope();
  await ensureTrip(bookingId);
  const booking = await prisma.booking.update({
    where: { id: bookingId },
    data: { bookingStatus: "EN_ROUTE", opsStage: "DRIVER_EN_ROUTE" },
  });
  await prisma.trip.update({ where: { bookingId }, data: { status: "DRIVER_EN_ROUTE", startedAt: new Date() } });
  if (booking.driverId) await prisma.driver.update({ where: { id: booking.driverId }, data: { status: "EN_ROUTE" } });
  await logActivity({ customerId: booking.customerId, bookingId, type: "AUTOMATION", description: "Chauffeur is en route.", actorId: scope.userId });
  revalidateAll(bookingId);
}

export async function markArrived(bookingId: string) {
  const scope = await requireScope();
  await ensureTrip(bookingId);
  const booking = await prisma.booking.update({ where: { id: bookingId }, data: { opsStage: "ARRIVED" } });
  await prisma.trip.update({ where: { bookingId }, data: { status: "ARRIVED", arrivedAt: new Date() } });
  await logActivity({ customerId: booking.customerId, bookingId, type: "AUTOMATION", description: "Chauffeur arrived at pickup.", actorId: scope.userId });
  revalidateAll(bookingId);
}

export async function markPickedUp(bookingId: string) {
  const scope = await requireScope();
  await ensureTrip(bookingId);
  const booking = await prisma.booking.update({
    where: { id: bookingId },
    data: { bookingStatus: "PASSENGER_PICKED_UP", opsStage: "IN_TRANSIT" },
  });
  await prisma.trip.update({ where: { bookingId }, data: { status: "PASSENGER_PICKED_UP", pickedUpAt: new Date() } });
  if (booking.driverId) await prisma.driver.update({ where: { id: booking.driverId }, data: { status: "WITH_CLIENT" } });
  await logActivity({ customerId: booking.customerId, bookingId, type: "AUTOMATION", description: "Passenger picked up — trip in progress.", actorId: scope.userId });
  revalidateAll(bookingId);
}

export async function completeTrip(bookingId: string) {
  const scope = await requireScope();
  await ensureTrip(bookingId);
  const booking = await prisma.booking.update({
    where: { id: bookingId },
    data: { bookingStatus: "COMPLETED", opsStage: "COMPLETED" },
  });
  await prisma.trip.update({ where: { bookingId }, data: { status: "COMPLETED", completedAt: new Date() } });
  if (booking.driverId) {
    await prisma.driver.update({ where: { id: booking.driverId }, data: { status: "AVAILABLE", completedTrips: { increment: 1 } } });
  }
  if (booking.vehicleId) {
    await prisma.vehicle.update({ where: { id: booking.vehicleId }, data: { availability: "AVAILABLE" } });
  }
  await logActivity({ customerId: booking.customerId, bookingId, type: "AUTOMATION", description: "Trip completed.", actorId: scope.userId });
  await runAutomation("TRIP_COMPLETED", { customerId: booking.customerId, bookingId, actorId: scope.userId });
  revalidateAll(bookingId);
}

/** Manual override used by the dispatcher Operations board (drag & drop
 * between columns) — keeps opsStage as the source of truth and derives a
 * sensible bookingStatus alongside it. */
export async function setOpsStage(bookingId: string, opsStage: string) {
  const scope = await requireScope();
  const statusMap: Record<string, string> = {
    UPCOMING: "CONFIRMED",
    DRIVER_ASSIGNED: "DRIVER_ASSIGNED",
    DRIVER_EN_ROUTE: "EN_ROUTE",
    ARRIVED: "EN_ROUTE",
    PASSENGER_ONBOARD: "PASSENGER_PICKED_UP",
    IN_TRANSIT: "PASSENGER_PICKED_UP",
    COMPLETED: "COMPLETED",
  };
  const booking = await prisma.booking.update({
    where: { id: bookingId },
    data: { opsStage, bookingStatus: statusMap[opsStage] ?? undefined },
  });
  await logActivity({ customerId: booking.customerId, bookingId, type: "AUTOMATION", description: `Operations stage set to "${opsStage.replace(/_/g, " ")}".`, actorId: scope.userId });
  if (opsStage === "COMPLETED") {
    await completeTrip(bookingId);
    return;
  }
  revalidateAll(bookingId);
}
