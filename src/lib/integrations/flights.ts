// Flight tracking integration seam (FlightAware, AeroDataBox, FlightStats,
// etc.). Staff enter flight details manually on a booking; once an API
// key is connected here, `refreshFlightStatus` becomes a real lookup and
// can be called on a schedule (e.g. every 15 minutes for flights arriving
// within 24 hours) to auto-update status and notify the assigned
// chauffeur on a change.

import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";

export async function refreshFlightStatus(bookingId: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking?.flightNumber) return null;

  const integration = await prisma.integration.findUnique({ where: { provider: "FLIGHT_TRACKING" } });
  if (!integration?.enabled) {
    // No live provider connected — status stays whatever staff last set
    // manually. This is the call site where a real lookup goes:
    // const status = await flightApi.lookup(booking.flightNumber);
    return booking;
  }

  // const status = await flightApi.lookup(booking.flightNumber);
  // const updated = await prisma.booking.update({ where: { id: bookingId }, data: { flightStatus: status.state, flightArrivalTime: status.estimatedArrival } });
  // if (updated.driverId && status.state === "DELAYED") { notify chauffeur }
  return booking;
}

export async function setFlightStatus(bookingId: string, status: string, actorId?: string) {
  const booking = await prisma.booking.update({ where: { id: bookingId }, data: { flightStatus: status } });
  await logActivity({ customerId: booking.customerId, bookingId, actorId, type: "FLIGHT_STATUS", description: `Flight ${booking.flightNumber ?? ""} status updated to ${status}.` });
  if (booking.driverId && (status === "DELAYED" || status === "LANDED")) {
    const driver = await prisma.driver.findUnique({ where: { id: booking.driverId }, select: { userId: true } });
    if (driver?.userId) {
      await prisma.notification.create({
        data: { userId: driver.userId, type: "FOLLOW_UP_DUE", title: `Flight ${status === "LANDED" ? "landed" : "delayed"}`, body: `${booking.flightNumber} — booking ${booking.bookingNumber}`, link: `/bookings/${booking.id}` },
      });
    }
  }
  return booking;
}
