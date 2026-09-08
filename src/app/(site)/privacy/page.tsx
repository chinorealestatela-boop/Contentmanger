import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Privacy & SMS Terms | AutoMax LV" };

// Reads dealership Settings — revalidate periodically so a name/phone/
// address change in Settings shows up here without a full redeploy.
export const revalidate = 60;

export default async function PrivacyPage() {
  const row = await prisma.setting.findUnique({ where: { key: "dealership" } });
  const dealership = row ? JSON.parse(row.value) : {};
  const name: string = dealership.name || "AutoMax LV";
  const address: string | undefined = dealership.address;
  const phone: string = dealership.phone || "702-325-3898";

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-12 text-[14px] leading-relaxed text-[var(--text-muted)] sm:px-6">
      <h1 className="text-2xl font-bold text-[var(--text)]">Privacy &amp; SMS Terms</h1>
      <p className="text-[12.5px]">
        {name}
        {address ? ` · ${address}` : ""} · {phone}
      </p>

      <section>
        <h2 className="text-[15px] font-semibold text-[var(--text)]">What we collect</h2>
        <p className="mt-1.5">
          When you book a test drive, we collect your name, phone number, and (if you provide it) email address, along
          with the vehicle you&rsquo;re interested in and general information about your buying preferences (down
          payment range, target monthly payment, and self-reported credit range). This information is used only to
          schedule your appointment and follow up about your inquiry.
        </p>
      </section>

      <section>
        <h2 className="text-[15px] font-semibold text-[var(--text)]">SMS text messaging program</h2>
        <p className="mt-1.5">
          By checking the consent box when booking, you agree to receive text messages from {name} related to your
          test drive appointment: a booking confirmation, a reminder about 24 hours before your appointment, and a
          reminder about 2 hours before your appointment. These are transactional messages about an appointment you
          requested, not marketing texts.
        </p>
        <p className="mt-1.5">
          <strong>Message frequency:</strong> varies based on your appointment activity (typically 2–3 messages per
          booked appointment). <strong>Message and data rates may apply.</strong> Message delivery is subject to
          your carrier&rsquo;s coverage; carriers are not liable for delayed or undelivered messages.
        </p>
        <p className="mt-1.5">
          Reply <strong>STOP</strong> at any time to a text from us to opt out of future text messages, or{" "}
          <strong>HELP</strong> for help. You can also opt out by calling {phone}. Consent to receive text messages is
          not a condition of purchasing any vehicle, service, or financing.
        </p>
      </section>

      <section>
        <h2 className="text-[15px] font-semibold text-[var(--text)]">How we handle your information</h2>
        <p className="mt-1.5">
          We do not sell your personal information. We do not share your phone number or the fact that you opted in to
          text messages with any third party or affiliate for their own marketing or promotional purposes.
        </p>
        <p className="mt-1.5">
          Text messaging originator opt-in data and consent (i.e., the fact that you agreed to receive texts from us,
          and when) is not shared with any third parties or affiliates for any purpose. Your contact information may
          be shared only with service providers who help us operate this booking system (e.g., our text/email
          delivery providers), solely to deliver the messages described above — never for their own marketing.
        </p>
      </section>

      <section>
        <h2 className="text-[15px] font-semibold text-[var(--text)]">No guaranteed financing</h2>
        <p className="mt-1.5">
          Questions about down payment, monthly payment, and credit are asked only to help us prepare relevant options
          ahead of your visit. Sharing this information does not guarantee approval for any financing program —
          all financing is subject to lender review.
        </p>
      </section>

      <section>
        <h2 className="text-[15px] font-semibold text-[var(--text)]">Contact us</h2>
        <p className="mt-1.5">
          Questions about your information, this policy, or our text messaging program? Call or text us at {phone}.
          See also our <Link href="/terms" className="underline">Terms &amp; Conditions</Link>.
        </p>
      </section>
    </div>
  );
}
