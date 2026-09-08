import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Terms & Conditions | AutoMax LV" };

// Reads dealership Settings — revalidate periodically so a name/phone/
// address change in Settings shows up here without a full redeploy.
export const revalidate = 60;

export default async function TermsPage() {
  const row = await prisma.setting.findUnique({ where: { key: "dealership" } });
  const dealership = row ? JSON.parse(row.value) : {};
  const name: string = dealership.name || "AutoMax LV";
  const address: string | undefined = dealership.address;
  const phone: string = dealership.phone || "702-325-3898";

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-12 text-[14px] leading-relaxed text-[var(--text-muted)] sm:px-6">
      <h1 className="text-2xl font-bold text-[var(--text)]">Terms &amp; Conditions</h1>
      <p className="text-[12.5px]">
        {name}
        {address ? ` · ${address}` : ""} · {phone}
      </p>

      <section>
        <h2 className="text-[15px] font-semibold text-[var(--text)]">This booking site</h2>
        <p className="mt-1.5">
          This website lets you request a test drive appointment with {name} for a specific vehicle in our current
          inventory, or for a vehicle you describe to us. Submitting the form is a request for an appointment, not a
          purchase, financing application, or a guarantee that a specific vehicle will still be available at your
          appointment time — inventory changes daily, and we&rsquo;ll always confirm before your visit.
        </p>
      </section>

      <section>
        <h2 className="text-[15px] font-semibold text-[var(--text)]">Test drives</h2>
        <p className="mt-1.5">
          To test drive a vehicle in person, you must be at least 18 years old, hold a valid driver&rsquo;s license,
          and carry valid auto insurance (or be an insured driver under a policy that covers you). We may ask to see
          your license before handing over keys. Test drives take place on public roads with a member of our staff;
          please follow their directions and all applicable traffic laws at all times.
        </p>
      </section>

      <section>
        <h2 className="text-[15px] font-semibold text-[var(--text)]">Text messages &amp; email</h2>
        <p className="mt-1.5">
          If you check the consent box when booking, we&rsquo;ll text and/or email you about that specific
          appointment — a confirmation and reminders. Message frequency varies, message and data rates may apply, and
          you can reply STOP to any text to opt out at any time. Full details are in our{" "}
          <Link href="/privacy" className="underline">Privacy &amp; SMS Terms</Link>.
        </p>
      </section>

      <section>
        <h2 className="text-[15px] font-semibold text-[var(--text)]">Accuracy of information</h2>
        <p className="mt-1.5">
          Please provide accurate contact information and appointment details — we use them only to schedule and
          manage your visit. Vehicle pricing, mileage, and availability shown on this site are believed accurate at
          the time of listing but are not guaranteed and are subject to prior sale, pricing errors, and change without
          notice; we&rsquo;ll confirm exact terms with you in person before any transaction.
        </p>
      </section>

      <section>
        <h2 className="text-[15px] font-semibold text-[var(--text)]">Changes to these terms</h2>
        <p className="mt-1.5">
          We may update these terms from time to time as our booking process changes. The version posted here at the
          time of your visit or appointment applies.
        </p>
      </section>

      <section>
        <h2 className="text-[15px] font-semibold text-[var(--text)]">Contact us</h2>
        <p className="mt-1.5">
          Questions about these terms or an appointment you&rsquo;ve booked? Call or text us at {phone}.
        </p>
      </section>
    </div>
  );
}
