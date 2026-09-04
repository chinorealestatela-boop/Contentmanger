import { notFound } from "next/navigation";
import { getAppointmentByToken } from "@/lib/actions/booking";
import { vehicleLabelForAppointment } from "@/lib/messaging/notify";
import { getBookingSettings } from "@/lib/availability";
import { prisma } from "@/lib/prisma";
import { ManagePanel } from "@/components/booking/ManagePanel";

export const metadata = { title: "Manage Your Appointment | AutoMax LV" };

export default async function ManageAppointmentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const appt = await getAppointmentByToken(token);
  if (!appt || !appt.confirmationCode) notFound();

  const [vehicleLabel, settings, dealershipRow] = await Promise.all([
    vehicleLabelForAppointment(appt.id),
    getBookingSettings(),
    prisma.setting.findUnique({ where: { key: "dealership" } }),
  ]);
  const dealership = dealershipRow ? JSON.parse(dealershipRow.value) : {};

  return (
    <ManagePanel
      appt={{
        manageToken: token,
        confirmationCode: appt.confirmationCode,
        status: appt.status,
        date: appt.date.toISOString(),
        time: appt.time,
        location: appt.location,
        vehicleLabel,
        customerFirstName: appt.customer.firstName,
        agentName: settings.agentName,
        // Prefer the dealership's main line — the assigned salesperson's
        // personal User.phone is often unset (it's optional in the CRM and
        // not something the booking flow collects), and this number is
        // what should appear on the durable confirmation link regardless.
        agentPhone: dealership.phone || appt.salesperson.phone || "the dealership",
      }}
    />
  );
}
