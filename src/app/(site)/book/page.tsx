import { getBookingVehicles, fetchBookingWindow } from "@/lib/actions/booking";
import { BookingWizard } from "@/components/booking/BookingWizard";

export const metadata = { title: "Book Your Test Drive | AutoMax LV" };

export default async function BookPage({ searchParams }: { searchParams: Promise<{ vehicle?: string; ref?: string }> }) {
  const sp = await searchParams;
  const [vehicles, window_] = await Promise.all([getBookingVehicles(), fetchBookingWindow()]);

  return (
    <BookingWizard
      vehicles={vehicles}
      preselectedVehicleId={sp.vehicle}
      sourceRef={sp.ref}
      maxBookingWindowDays={window_.maxBookingWindowDays}
      contact={{
        agentName: window_.agentName,
        location: window_.location,
        dealershipName: window_.dealershipName,
        dealershipPhone: window_.dealershipPhone,
      }}
    />
  );
}
