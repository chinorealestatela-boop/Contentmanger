import { notFound } from "next/navigation";
import { getAppointmentByToken } from "@/lib/actions/booking";
import { vehicleLabelForAppointment } from "@/lib/messaging/notify";
import { getBookingSettings } from "@/lib/availability";
import { ManagePanel } from "@/components/booking/ManagePanel";

export const metadata = { title: "Manage Your Appointment | AutoMax LV" };

export default async function ManageAppointmentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const appt = await getAppointmentByToken(token);
  if (!appt || !appt.confirmationCode) notFound();

  const [vehicleLabel, settings] = await Promise.all([vehicleLabelForAppointment(appt.id), getBookingSettings()]);

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
        agentPhone: appt.salesperson.phone || "the dealership",
      }}
    />
  );
}
