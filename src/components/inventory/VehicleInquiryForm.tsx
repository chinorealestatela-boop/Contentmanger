"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { track } from "@vercel/analytics";
import { Loader2, CheckCircle2 } from "lucide-react";
import { submitVehicleInquiry, type InquiryActionState } from "@/lib/actions/vehicleInquiry";
import { isValidPhone, formatPhoneInput } from "@/lib/phone";

export function VehicleInquiryForm({ vehicleId, vehicleLabel, dealershipName }: { vehicleId: string; vehicleLabel: string; dealershipName: string }) {
  const [state, formAction, pending] = useActionState<InquiryActionState, FormData>(submitVehicleInquiry, null);
  const [, startTransition] = useTransition();

  const [inquiryType, setInquiryType] = useState<"INFO" | "AVAILABILITY" | "FINANCING">("INFO");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (state && "success" in state && state.success) {
      track("inquiry_submitted", { inquiryType, vehicleId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  if (state && "success" in state && state.success) {
    return (
      <div id="interested" className="card scroll-mt-24 p-6 text-center">
        <CheckCircle2 size={32} className="mx-auto text-[var(--success)]" />
        <h3 className="mt-3 text-[16px] font-bold text-[var(--text)]">Got it — thanks!</h3>
        <p className="mt-1.5 text-[13.5px] text-[var(--text-muted)]">
          Someone from {dealershipName} will reach out about the {vehicleLabel} shortly. You can also{" "}
          <Link href={`/book?vehicle=${vehicleId}`} className="font-semibold text-[var(--brand)] hover:underline">schedule a test drive</Link> now.
        </p>
      </div>
    );
  }

  const phoneValid = phone.length === 0 || isValidPhone(phone);

  return (
    <form
      id="interested"
      action={(fd) => startTransition(() => formAction(fd))}
      className="card scroll-mt-24 space-y-3.5 p-5"
    >
      <div>
        <h3 className="text-[15px] font-bold text-[var(--text)]">Interested in this {vehicleLabel}?</h3>
        <p className="mt-0.5 text-[12.5px] text-[var(--text-muted)]">Tell us what you need and we&rsquo;ll get right back to you.</p>
      </div>

      {state && "error" in state && state.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">{state.error}</div>
      )}

      <input type="hidden" name="vehicleId" value={vehicleId} />

      <div>
        <label className="label mb-1.5" htmlFor="inquiryType">What can we help with?</label>
        <select id="inquiryType" name="inquiryType" value={inquiryType} onChange={(e) => setInquiryType(e.target.value as typeof inquiryType)} className="input">
          <option value="INFO">Request more information</option>
          <option value="AVAILABILITY">Confirm this is still available</option>
          <option value="FINANCING">Apply for financing on this vehicle</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="inq-firstName">First name</label>
          <input id="inq-firstName" name="firstName" className="input" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" required />
        </div>
        <div>
          <label className="label" htmlFor="inq-lastName">Last name</label>
          <input id="inq-lastName" name="lastName" className="input" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" required />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="inq-phone">Phone number</label>
        <input
          id="inq-phone"
          name="phone"
          type="tel"
          inputMode="tel"
          className={`input ${touched && !phoneValid ? "border-red-400" : ""}`}
          value={phone}
          onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
          onBlur={() => setTouched(true)}
          placeholder="(702) 555-0123"
          autoComplete="tel"
          required
        />
        {touched && !phoneValid && <p className="mt-1 text-[12px] text-red-600">Enter a valid 10-digit phone number.</p>}
      </div>

      <div>
        <label className="label" htmlFor="inq-email">Email (optional)</label>
        <input id="inq-email" name="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" />
      </div>

      <div>
        <label className="label" htmlFor="inq-message">Message (optional)</label>
        <textarea id="inq-message" name="message" rows={3} className="input" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Anything specific you'd like to know?" />
      </div>

      <label className="flex items-start gap-2.5 text-[12px] text-[var(--text-muted)]">
        <input type="checkbox" name="commConsent" className="mt-0.5" checked={consent} onChange={(e) => setConsent(e.target.checked)} required />
        <span>
          I agree to receive text messages and emails from {dealershipName} about this inquiry. Msg &amp; data rates may apply. Reply STOP to
          unsubscribe from texts at any time. See our{" "}
          <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="font-semibold text-[var(--brand)] underline">Privacy &amp; SMS Terms</Link>.{" "}
          <span className="text-red-500">*</span>
        </span>
      </label>

      <button type="submit" disabled={pending || !consent} className="btn btn-primary w-full justify-center py-2.5">
        {pending ? <Loader2 size={15} className="animate-spin" /> : null}
        {pending ? "Sending…" : "Send"}
      </button>
    </form>
  );
}
