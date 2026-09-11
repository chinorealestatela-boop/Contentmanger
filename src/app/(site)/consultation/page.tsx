import { fetchBookingWindow } from "@/lib/actions/booking";
import { ConsultationBookingForm } from "@/components/consultation/ConsultationBookingForm";
import { MessageCircle, Clock, PhoneCall } from "lucide-react";

export const metadata = { title: "Free 15-Minute Consultation | AutoMax LV" };

export default async function ConsultationPage() {
  const window_ = await fetchBookingWindow();

  return (
    <div className="mx-auto max-w-lg px-4 py-10 sm:px-6">
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-soft)] px-3 py-1 text-[12px] font-semibold text-[var(--brand)]">
          <MessageCircle size={13} /> No pressure, just a conversation
        </span>
        <h1 className="mt-4 text-2xl font-extrabold text-[var(--text)] sm:text-3xl">Not ready to test drive yet?</h1>
        <p className="mx-auto mt-2 max-w-md text-[14px] text-[var(--text-muted)]">
          Book a free 15-minute call with {window_.agentName} to talk through financing, trade-ins, or just figure out what fits your budget — before you ever set foot on the lot.
        </p>
        <div className="mt-4 flex justify-center gap-5 text-[12.5px] text-[var(--text-muted)]">
          <span className="flex items-center gap-1.5"><Clock size={14} className="text-[var(--brand)]" /> Just 15 minutes</span>
          <span className="flex items-center gap-1.5"><PhoneCall size={14} className="text-[var(--brand)]" /> We call you</span>
        </div>
      </div>

      <div className="mt-8">
        <ConsultationBookingForm maxBookingWindowDays={window_.maxBookingWindowDays} dealershipName={window_.dealershipName} />
      </div>
    </div>
  );
}
