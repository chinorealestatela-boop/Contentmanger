import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildAppointmentICS } from "@/lib/ics";
import { vehicleLabelForAppointment } from "@/lib/messaging/notify";
import { getBookingSettings } from "@/lib/availability";

// GET /api/appointments/[token]/ics — downloads a calendar invite for one
// appointment. `token` is the appointment's unguessable manageToken, the
// same capability token used for the reschedule/cancel page, so this stays
// unauthenticated but not enumerable.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const appt = await prisma.appointment.findUnique({ where: { manageToken: token } });
  if (!appt || !appt.endTime) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [vehicleLabel, settings] = await Promise.all([vehicleLabelForAppointment(appt.id), getBookingSettings()]);

  const ics = buildAppointmentICS({
    uid: appt.id,
    title: `Test Drive: ${vehicleLabel}`,
    description: `Test drive appointment with ${settings.agentName} at ${settings.location}. Confirmation #${appt.confirmationCode}.`,
    location: appt.location ?? settings.location,
    date: appt.date,
    startTime: appt.time,
    endTime: appt.endTime,
  });

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="test-drive-${appt.confirmationCode}.ics"`,
    },
  });
}
