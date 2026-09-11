"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { track } from "@vercel/analytics";
import { Loader2, CheckCircle2, CalendarClock } from "lucide-react";
import { submitConsultationBooking, fetchConsultationSlots, type ConsultationActionState } from "@/lib/actions/consultation";
import { isValidPhone, formatPhoneInput } from "@/lib/phone";
import { formatDate, formatTime12h } from "@/lib/format";
import { cn } from "@/lib/utils";

export function ConsultationBookingForm({ maxBookingWindowDays, dealershipName }: { maxBookingWindowDays: number; dealershipName: string }) {
  const [state, formAction, pending] = useActionState<ConsultationActionState, FormData>(submitConsultationBooking, null);
  const [, startTransition] = useTransition();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [consent, setConsent] = useState(false);
  const [touched, setTouched] = useState(false);
  const [slots, setSlots] = useState<string[] | null>(null);
  const [slotsPending, startSlotsTransition] = useTransition();

  const todayStr = useMemo(() => toDateInputValue(new Date()), []);
  const maxStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + maxBookingWindowDays);
    return toDateInputValue(d);
  }, [maxBookingWindowDays]);

  useEffect(() => {
    track("consultation_started");
  }, []);

  useEffect(() => {
    if (state && "success" in state && state.success) track("consultation_completed");
  }, [state]);

  useEffect(() => {
    if (!date) return;
    startSlotsTransition(async () => {
      setSlots(null);
      setTime("");
      const result = await fetchConsultationSlots(date);
      setSlots(result);
    });
  }, [date]);

  if (state && "success" in state && state.success) {
    return (
      <div className="card p-6 text-center">
        <CheckCircle2 size={32} className="mx-auto text-[var(--success)]" />
        <h3 className="mt-3 text-[16px] font-bold text-[var(--text)]">You&rsquo;re booked!</h3>
        <p className="mt-1.5 text-[13.5px] text-[var(--text-muted)]">
          Someone from {dealershipName} will call you at your scheduled time. Want to look at inventory in the meantime?{" "}
          <Link href="/inventory" className="font-semibold text-[var(--brand)] hover:underline">Browse Available Vehicles</Link>
        </p>
      </div>
    );
  }

  const phoneValid = phone.length === 0 || isValidPhone(phone);
  const canSubmit = firstName.trim() && lastName.trim() && isValidPhone(phone) && date && time && consent;

  function submit() {
    const fd = new FormData();
    const map: Record<string, string> = { firstName, lastName, phone, email, topic, date, time };
    for (const [k, v] of Object.entries(map)) if (v) fd.set(k, v);
    if (consent) fd.set("commConsent", "on");
    startTransition(() => formAction(fd));
  }

  return (
    <div className="card space-y-4 p-5 sm:p-6">
      {state && "error" in state && state.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">{state.error}</div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="cons-firstName">First name</label>
          <input id="cons-firstName" className="input" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
        </div>
        <div>
          <label className="label" htmlFor="cons-lastName">Last name</label>
          <input id="cons-lastName" className="input" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="cons-phone">Phone number</label>
        <input
          id="cons-phone"
          type="tel"
          inputMode="tel"
          className={cn("input", touched && !phoneValid && "border-red-400")}
          value={phone}
          onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
          onBlur={() => setTouched(true)}
          placeholder="(702) 555-0123"
          autoComplete="tel"
        />
        {touched && !phoneValid && <p className="mt-1 text-[12px] text-red-600">Enter a valid 10-digit phone number.</p>}
      </div>

      <div>
        <label className="label" htmlFor="cons-email">Email (optional)</label>
        <input id="cons-email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" />
      </div>

      <div>
        <label className="label" htmlFor="cons-topic">What would you like to discuss? (optional)</label>
        <textarea id="cons-topic" rows={2} className="input" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. trade-in value, financing options, a specific vehicle…" />
      </div>

      <div>
        <label className="label">Date</label>
        <input type="date" className="input" min={todayStr} max={maxStr} value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      {date && (
        <div>
          <label className="label">Available times</label>
          {slotsPending && (
            <div className="flex items-center gap-2 py-3 text-[13px] text-[var(--text-muted)]">
              <Loader2 size={15} className="animate-spin" /> Checking availability…
            </div>
          )}
          {!slotsPending && slots && slots.length === 0 && (
            <p className="rounded-lg border border-dashed border-[var(--border)] p-4 text-center text-[13px] text-[var(--text-muted)]">
              No openings that day — try another date.
            </p>
          )}
          {!slotsPending && slots && slots.length > 0 && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {slots.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTime(t)}
                  className={cn(
                    "rounded-lg border px-2 py-2.5 text-[12.5px] font-semibold",
                    time === t ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--border)] text-[var(--text)] hover:bg-[var(--bg-subtle)]"
                  )}
                >
                  {formatTime12h(t)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {date && time && (
        <p className="text-[12.5px] font-semibold text-[var(--text)]">
          {formatDate(new Date(`${date}T00:00:00`), "EEEE, MMM d")} at {formatTime12h(time)}
        </p>
      )}

      <label className="flex items-start gap-2.5 text-[12px] text-[var(--text-muted)]">
        <input type="checkbox" className="mt-0.5" checked={consent} onChange={(e) => setConsent(e.target.checked)} required />
        <span>
          I agree to receive text messages and emails from {dealershipName} about this consultation. Msg &amp; data rates may apply. Reply STOP to
          unsubscribe from texts at any time. See our{" "}
          <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="font-semibold text-[var(--brand)] underline">Privacy &amp; SMS Terms</Link>.{" "}
          <span className="text-red-500">*</span>
        </span>
      </label>

      <button type="button" onClick={submit} disabled={pending || !canSubmit} className="btn btn-primary w-full justify-center py-2.5">
        {pending ? <Loader2 size={15} className="animate-spin" /> : <CalendarClock size={15} />}
        {pending ? "Booking…" : "Book My Free Consultation"}
      </button>
    </div>
  );
}

function toDateInputValue(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
