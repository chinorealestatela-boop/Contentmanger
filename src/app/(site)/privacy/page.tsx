export const metadata = { title: "Privacy & SMS Terms | AutoMax LV" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-12 text-[14px] leading-relaxed text-[var(--text-muted)] sm:px-6">
      <h1 className="text-2xl font-bold text-[var(--text)]">Privacy &amp; SMS Terms</h1>

      <section>
        <h2 className="text-[15px] font-semibold text-[var(--text)]">What we collect</h2>
        <p className="mt-1.5">
          When you book a test drive, we collect your name, phone number, and (if you provide it) email address, along
          with the vehicle you&rsquo;re interested in and general information about your buying preferences (down
          payment range, target monthly payment, and self-reported credit range). This information is used only to
          schedule your appointment and follow up about your inquiry — it is never sold or shared with third parties
          for marketing purposes.
        </p>
      </section>

      <section>
        <h2 className="text-[15px] font-semibold text-[var(--text)]">SMS text messaging</h2>
        <p className="mt-1.5">
          If you opt in to text messages, we&rsquo;ll send you your appointment confirmation and reminders (typically
          one at booking, one about 24 hours before your appointment, and one about 2 hours before). Message frequency
          varies. Message and data rates may apply. Reply <strong>STOP</strong> at any time to opt out, or{" "}
          <strong>HELP</strong> for help. Consent to receive texts is not a condition of purchasing any vehicle or
          service.
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
          Questions about your information or this policy? Call or text us using the number in your confirmation
          message.
        </p>
      </section>
    </div>
  );
}
