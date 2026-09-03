"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Search, Car, ChevronLeft, ChevronRight, Check, Loader2, CalendarCheck } from "lucide-react";
import { submitBooking, fetchAvailableSlots, type BookingActionState } from "@/lib/actions/booking";
import { isValidPhone, formatPhoneInput } from "@/lib/phone";
import { formatDate, formatTime12h } from "@/lib/format";
import { DOWN_PAYMENT_RANGES, MONTHLY_PAYMENT_RANGES, CREDIT_RANGES, type Option } from "@/lib/constants";
import { cn } from "@/lib/utils";

export type BookingVehicle = {
  id: string;
  year: number;
  make: string;
  model: string;
  trim: string | null;
  condition: string;
  exteriorColor: string | null;
  internetPrice: number | null;
  sellingPrice: number | null;
  mileage: number;
};

type FormState = {
  vehicleId: string;
  vehicleLabel: string;
  manualVehicle: boolean;
  vehicleYear: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleTrim: string;

  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  preferredContactMethod: "PHONE" | "TEXT" | "EMAIL";

  downPaymentRange: string;
  monthlyPaymentRange: string;
  creditRange: string;
  currentlyDriving: "" | "YES" | "NO";
  tradeYear: string;
  tradeMake: string;
  tradeModel: string;
  tradeMileage: string;
  tradeOwesMoney: "" | "YES" | "NO";

  date: string;
  time: string;

  smsConsent: boolean;
  privacyConsent: boolean;
};

const STEP_LABELS = ["Vehicle", "You", "A Few Questions", "Schedule", "Confirm"];

export function BookingWizard({
  vehicles,
  preselectedVehicleId,
  sourceRef,
  maxBookingWindowDays,
}: {
  vehicles: BookingVehicle[];
  preselectedVehicleId?: string;
  sourceRef?: string;
  maxBookingWindowDays: number;
}) {
  const preselected = vehicles.find((v) => v.id === preselectedVehicleId);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>({
    vehicleId: preselected?.id ?? "",
    vehicleLabel: preselected ? vehicleLabel(preselected) : "",
    manualVehicle: false,
    vehicleYear: "",
    vehicleMake: "",
    vehicleModel: "",
    vehicleTrim: "",
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    preferredContactMethod: "PHONE",
    downPaymentRange: "",
    monthlyPaymentRange: "",
    creditRange: "",
    currentlyDriving: "",
    tradeYear: "",
    tradeMake: "",
    tradeModel: "",
    tradeMileage: "",
    tradeOwesMoney: "",
    date: "",
    time: "",
    smsConsent: false,
    privacyConsent: false,
  });

  const [state, formAction, pending] = useActionState<BookingActionState, FormData>(submitBooking, null);
  const [, startSubmitTransition] = useTransition();

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const canNext = useMemo(() => {
    if (step === 1) return !!(form.vehicleId || (form.manualVehicle && form.vehicleMake.trim()));
    if (step === 2) return form.firstName.trim() && form.lastName.trim() && isValidPhone(form.phone);
    if (step === 3) return true; // buying questions are optional, never block progress
    if (step === 4) return !!(form.date && form.time);
    return true;
  }, [step, form]);

  function next() {
    if (step < 5) setStep((s) => s + 1);
  }
  function back() {
    if (step > 1) setStep((s) => s - 1);
  }

  function submit() {
    const fd = new FormData();
    const map: Record<string, string> = {
      vehicleId: form.vehicleId,
      vehicleYear: form.vehicleYear,
      vehicleMake: form.vehicleMake,
      vehicleModel: form.vehicleModel,
      vehicleTrim: form.vehicleTrim,
      firstName: form.firstName,
      lastName: form.lastName,
      phone: form.phone,
      email: form.email,
      preferredContactMethod: form.preferredContactMethod,
      downPaymentRange: form.downPaymentRange,
      monthlyPaymentRange: form.monthlyPaymentRange,
      creditRange: form.creditRange,
      currentlyDriving: form.currentlyDriving,
      tradeYear: form.tradeYear,
      tradeMake: form.tradeMake,
      tradeModel: form.tradeModel,
      tradeMileage: form.tradeMileage,
      tradeOwesMoney: form.tradeOwesMoney,
      date: form.date,
      time: form.time,
      ref: sourceRef ?? "",
    };
    for (const [k, v] of Object.entries(map)) if (v) fd.set(k, v);
    if (form.smsConsent) fd.set("smsConsent", "on");
    if (form.privacyConsent) fd.set("privacyConsent", "on");
    startSubmitTransition(() => formAction(fd));
  }

  if (state && "success" in state && state.success) {
    return <ConfirmationScreen confirmationCode={state.confirmationCode} manageToken={state.manageToken} />;
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8 sm:px-6">
      <ProgressBar step={step} />

      <div className="card mt-5 p-5 sm:p-6">
        {state && "error" in state && state.error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</div>
        )}

        {step === 1 && <StepVehicle vehicles={vehicles} form={form} set={set} />}
        {step === 2 && <StepCustomer form={form} set={set} />}
        {step === 3 && <StepBuying form={form} set={set} />}
        {step === 4 && <StepSchedule form={form} set={set} maxBookingWindowDays={maxBookingWindowDays} />}
        {step === 5 && <StepReview form={form} set={set} />}

        <div className="mt-6 flex items-center justify-between gap-3">
          <button type="button" onClick={back} disabled={step === 1} className="btn btn-secondary disabled:opacity-0">
            <ChevronLeft size={15} /> Back
          </button>
          {step < 5 ? (
            <button type="button" onClick={next} disabled={!canNext} className="btn btn-primary flex-1 py-2.5 sm:flex-none sm:px-6">
              Next <ChevronRight size={15} />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={pending || !form.privacyConsent}
              className="btn btn-primary flex-1 py-2.5 sm:flex-none sm:px-6"
            >
              {pending ? <Loader2 size={15} className="animate-spin" /> : <CalendarCheck size={15} />}
              {pending ? "Booking…" : "Confirm My Test Drive"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function vehicleLabel(v: BookingVehicle) {
  return `${v.year} ${v.make} ${v.model}${v.trim ? ` ${v.trim}` : ""}`;
}

function ProgressBar({ step }: { step: number }) {
  return (
    <div>
      <div className="flex items-center gap-1.5">
        {STEP_LABELS.map((_, i) => (
          <div key={i} className={cn("h-1.5 flex-1 rounded-full", i < step ? "bg-[var(--brand)]" : "bg-[var(--border)]")} />
        ))}
      </div>
      <p className="mt-2 text-center text-[12.5px] font-semibold text-[var(--text-muted)]">
        Step {step} of {STEP_LABELS.length} — {STEP_LABELS[step - 1]}
      </p>
    </div>
  );
}

// ── Step 1 ────────────────────────────────────────────────────────────

function StepVehicle({ vehicles, form, set }: { vehicles: BookingVehicle[]; form: FormState; set: <K extends keyof FormState>(k: K, v: FormState[K]) => void }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return vehicles;
    return vehicles.filter((v) => `${v.year} ${v.make} ${v.model} ${v.trim ?? ""}`.toLowerCase().includes(query));
  }, [vehicles, q]);

  return (
    <div>
      <h2 className="text-lg font-bold text-[var(--text)]">What vehicle are you interested in test driving?</h2>
      <p className="mt-1 text-[13px] text-[var(--text-muted)]">Pick one from the lot, or tell us if it&rsquo;s not listed.</p>

      {!form.manualVehicle && (
        <>
          <div className="relative mt-4">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
            <input className="input pl-9" placeholder="Search make, model…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
            {filtered.map((v) => {
              const selected = form.vehicleId === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => {
                    set("vehicleId", selected ? "" : v.id);
                    set("vehicleLabel", selected ? "" : vehicleLabel(v));
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                    selected ? "border-[var(--brand)] bg-[var(--brand-soft)]" : "border-[var(--border)] hover:bg-[var(--bg-subtle)]"
                  )}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-subtle)] text-[var(--text-faint)]"><Car size={18} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold text-[var(--text)]">{v.year} {v.make} {v.model}</span>
                    <span className="block text-[12px] text-[var(--text-muted)]">{v.trim ?? v.condition} · {v.mileage.toLocaleString()} mi{v.exteriorColor ? ` · ${v.exteriorColor}` : ""}</span>
                  </span>
                  {selected && <Check size={18} className="shrink-0 text-[var(--brand)]" />}
                </button>
              );
            })}
            {filtered.length === 0 && <p className="py-6 text-center text-[13px] text-[var(--text-faint)]">No matches — try the manual option below.</p>}
          </div>
          <button type="button" onClick={() => set("manualVehicle", true)} className="mt-3 text-[12.5px] font-semibold text-[var(--brand)] hover:underline">
            Don&rsquo;t see it? Enter it manually →
          </button>
        </>
      )}

      {form.manualVehicle && (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="vehicleYear">Year</label>
              <input id="vehicleYear" inputMode="numeric" className="input" value={form.vehicleYear} onChange={(e) => set("vehicleYear", e.target.value)} placeholder="2022" />
            </div>
            <div>
              <label className="label" htmlFor="vehicleMake">Make</label>
              <input id="vehicleMake" className="input" value={form.vehicleMake} onChange={(e) => set("vehicleMake", e.target.value)} placeholder="Honda" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="vehicleModel">Model</label>
              <input id="vehicleModel" className="input" value={form.vehicleModel} onChange={(e) => set("vehicleModel", e.target.value)} placeholder="Accord" />
            </div>
            <div>
              <label className="label" htmlFor="vehicleTrim">Trim (optional)</label>
              <input id="vehicleTrim" className="input" value={form.vehicleTrim} onChange={(e) => set("vehicleTrim", e.target.value)} placeholder="EX-L" />
            </div>
          </div>
          <button type="button" onClick={() => set("manualVehicle", false)} className="text-[12.5px] font-semibold text-[var(--brand)] hover:underline">
            ← Back to the vehicle list
          </button>
        </div>
      )}
    </div>
  );
}

// ── Step 2 ────────────────────────────────────────────────────────────

function StepCustomer({ form, set }: { form: FormState; set: <K extends keyof FormState>(k: K, v: FormState[K]) => void }) {
  const [touched, setTouched] = useState(false);
  const phoneValid = form.phone.length === 0 || isValidPhone(form.phone);

  return (
    <div>
      <h2 className="text-lg font-bold text-[var(--text)]">A little about you</h2>
      <p className="mt-1 text-[13px] text-[var(--text-muted)]">So we know who&rsquo;s coming in and how to reach you.</p>

      <div className="mt-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="firstName">First name</label>
            <input id="firstName" className="input" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} autoComplete="given-name" />
          </div>
          <div>
            <label className="label" htmlFor="lastName">Last name</label>
            <input id="lastName" className="input" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} autoComplete="family-name" />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="phone">Phone number</label>
          <input
            id="phone"
            className={cn("input", touched && !phoneValid && "border-red-400")}
            inputMode="tel"
            type="tel"
            value={form.phone}
            onChange={(e) => set("phone", formatPhoneInput(e.target.value))}
            onBlur={() => setTouched(true)}
            placeholder="(702) 555-0123"
            autoComplete="tel"
          />
          {touched && !phoneValid && <p className="mt-1 text-[12px] text-red-600">Enter a valid 10-digit phone number.</p>}
        </div>
        <div>
          <label className="label" htmlFor="email">Email (optional)</label>
          <input id="email" className="input" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" placeholder="you@example.com" />
        </div>
        <div>
          <label className="label">Preferred way to hear from us</label>
          <div className="grid grid-cols-3 gap-2">
            {(["PHONE", "TEXT", "EMAIL"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => set("preferredContactMethod", m)}
                className={cn("rounded-lg border px-2 py-2 text-[12.5px] font-semibold", form.preferredContactMethod === m ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]" : "border-[var(--border)] text-[var(--text-muted)]")}
              >
                {m === "PHONE" ? "Call" : m === "TEXT" ? "Text" : "Email"}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Step 3 ────────────────────────────────────────────────────────────

function PillGroup({ options, value, onChange }: { options: Option[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(value === o.value ? "" : o.value)}
          className={cn(
            "rounded-lg border px-2.5 py-2 text-[12.5px] font-semibold",
            value === o.value ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]" : "border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function StepBuying({ form, set }: { form: FormState; set: <K extends keyof FormState>(k: K, v: FormState[K]) => void }) {
  return (
    <div>
      <h2 className="text-lg font-bold text-[var(--text)]">A few quick questions</h2>
      <p className="mt-1 text-[13px] text-[var(--text-muted)]">This just helps us prep the right options — nothing here locks you in.</p>

      <div className="mt-5 space-y-5">
        <div>
          <p className="label mb-2">How much are you looking to put down?</p>
          <PillGroup options={DOWN_PAYMENT_RANGES} value={form.downPaymentRange} onChange={(v) => set("downPaymentRange", v)} />
        </div>
        <div>
          <p className="label mb-2">What monthly payment are you trying to stay around?</p>
          <PillGroup options={MONTHLY_PAYMENT_RANGES} value={form.monthlyPaymentRange} onChange={(v) => set("monthlyPaymentRange", v)} />
        </div>
        <div>
          <p className="label mb-2">How would you describe your credit?</p>
          <PillGroup options={CREDIT_RANGES} value={form.creditRange} onChange={(v) => set("creditRange", v)} />
        </div>
        <div>
          <p className="label mb-2">Are you currently driving a vehicle?</p>
          <div className="grid grid-cols-2 gap-2">
            {(["YES", "NO"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => set("currentlyDriving", form.currentlyDriving === v ? "" : v)}
                className={cn("rounded-lg border px-2.5 py-2 text-[12.5px] font-semibold", form.currentlyDriving === v ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]" : "border-[var(--border)] text-[var(--text-muted)]")}
              >
                {v === "YES" ? "Yes" : "No"}
              </button>
            ))}
          </div>
        </div>

        {form.currentlyDriving === "YES" && (
          <div className="space-y-3 rounded-xl border border-[var(--border)] p-3">
            <p className="text-[12.5px] font-semibold text-[var(--text)]">Tell us about it (optional)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="tradeYear">Year</label>
                <input id="tradeYear" inputMode="numeric" className="input" value={form.tradeYear} onChange={(e) => set("tradeYear", e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="tradeMake">Make</label>
                <input id="tradeMake" className="input" value={form.tradeMake} onChange={(e) => set("tradeMake", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="tradeModel">Model</label>
                <input id="tradeModel" className="input" value={form.tradeModel} onChange={(e) => set("tradeModel", e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="tradeMileage">Approx. mileage</label>
                <input id="tradeMileage" inputMode="numeric" className="input" value={form.tradeMileage} onChange={(e) => set("tradeMileage", e.target.value)} />
              </div>
            </div>
            <div>
              <p className="label mb-1.5">Do you still owe money on it?</p>
              <div className="grid grid-cols-2 gap-2">
                {(["YES", "NO"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => set("tradeOwesMoney", form.tradeOwesMoney === v ? "" : v)}
                    className={cn("rounded-lg border px-2.5 py-2 text-[12.5px] font-semibold", form.tradeOwesMoney === v ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]" : "border-[var(--border)] text-[var(--text-muted)]")}
                  >
                    {v === "YES" ? "Yes" : "No"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Step 4 ────────────────────────────────────────────────────────────

function StepSchedule({ form, set, maxBookingWindowDays }: { form: FormState; set: <K extends keyof FormState>(k: K, v: FormState[K]) => void; maxBookingWindowDays: number }) {
  const [slots, setSlots] = useState<string[] | null>(null);
  const [pending, startTransition] = useTransition();

  const todayStr = useMemo(() => toDateInputValue(new Date()), []);
  const maxStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + maxBookingWindowDays);
    return toDateInputValue(d);
  }, [maxBookingWindowDays]);

  useEffect(() => {
    if (!form.date) return;
    startTransition(async () => {
      setSlots(null);
      set("time", "");
      const result = await fetchAvailableSlots(form.date);
      setSlots(result);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.date]);

  return (
    <div>
      <h2 className="text-lg font-bold text-[var(--text)]">Choose your date &amp; time</h2>
      <p className="mt-1 text-[13px] text-[var(--text-muted)]">We&rsquo;ll only show times that are actually open.</p>

      <div className="mt-4">
        <label className="label">Date</label>
        <input type="date" className="input" min={todayStr} max={maxStr} value={form.date} onChange={(e) => set("date", e.target.value)} />
      </div>

      {form.date && (
        <div className="mt-4">
          <label className="label">Available times</label>
          {pending && (
            <div className="flex items-center gap-2 py-4 text-[13px] text-[var(--text-muted)]">
              <Loader2 size={15} className="animate-spin" /> Checking availability…
            </div>
          )}
          {!pending && slots && slots.length === 0 && (
            <p className="rounded-lg border border-dashed border-[var(--border)] p-4 text-center text-[13px] text-[var(--text-muted)]">
              No openings that day — try another date.
            </p>
          )}
          {!pending && slots && slots.length > 0 && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {slots.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => set("time", t)}
                  className={cn(
                    "rounded-lg border px-2 py-2.5 text-[12.5px] font-semibold",
                    form.time === t ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--border)] text-[var(--text)] hover:bg-[var(--bg-subtle)]"
                  )}
                >
                  {formatTime12h(t)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function toDateInputValue(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ── Step 5 ────────────────────────────────────────────────────────────

function StepReview({ form, set }: { form: FormState; set: <K extends keyof FormState>(k: K, v: FormState[K]) => void }) {
  const vehicleText = form.manualVehicle || !form.vehicleId ? `${form.vehicleYear} ${form.vehicleMake} ${form.vehicleModel} ${form.vehicleTrim}`.trim() : form.vehicleLabel;

  return (
    <div>
      <h2 className="text-lg font-bold text-[var(--text)]">Review &amp; confirm</h2>
      <div className="mt-4 space-y-2 rounded-xl border border-[var(--border)] p-4 text-[13.5px]">
        <Row label="Vehicle" value={vehicleText || "—"} />
        <Row label="Name" value={`${form.firstName} ${form.lastName}`} />
        <Row label="Phone" value={form.phone} />
        {form.email && <Row label="Email" value={form.email} />}
        <Row label="Date" value={form.date ? formatDate(new Date(`${form.date}T00:00:00`), "EEEE, MMM d, yyyy") : "—"} />
        <Row label="Time" value={form.time ? formatTime12h(form.time) : "—"} />
      </div>

      <div className="mt-5 space-y-3">
        <label className="flex items-start gap-2.5 text-[12.5px] text-[var(--text-muted)]">
          <input type="checkbox" className="mt-0.5" checked={form.smsConsent} onChange={(e) => set("smsConsent", e.target.checked)} />
          <span>
            Text me my appointment confirmation and reminders. Msg &amp; data rates may apply. Reply STOP to opt out at any time, HELP for help.
          </span>
        </label>
        <label className="flex items-start gap-2.5 text-[12.5px] text-[var(--text-muted)]">
          <input type="checkbox" className="mt-0.5" checked={form.privacyConsent} onChange={(e) => set("privacyConsent", e.target.checked)} required />
          <span>
            I agree to be contacted about my inquiry by phone, text, or email. <span className="text-red-500">*</span>
          </span>
        </label>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] py-1.5 last:border-0">
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className="text-right font-semibold text-[var(--text)]">{value}</span>
    </div>
  );
}

// ── Confirmation ─────────────────────────────────────────────────────

function ConfirmationScreen({ confirmationCode, manageToken }: { confirmationCode: string; manageToken: string }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-10 text-center sm:px-6">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
        <Check size={28} />
      </div>
      <h1 className="mt-4 text-2xl font-extrabold text-[var(--text)]">You&rsquo;re Booked!</h1>
      <p className="mt-2 text-[14px] text-[var(--text-muted)]">
        Confirmation #<span className="font-mono font-semibold text-[var(--text)]">{confirmationCode}</span>
      </p>
      <p className="mt-3 text-[13.5px] text-[var(--text-muted)]">
        We&rsquo;ve texted and/or emailed your confirmation. Manage your appointment anytime from that link, or below.
      </p>

      <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
        <a href={`/api/appointments/${manageToken}/ics`} className="btn btn-secondary py-2.5">
          Add to Calendar
        </a>
        <Link href={`/manage/${manageToken}`} className="btn btn-secondary py-2.5">
          Reschedule or Cancel
        </Link>
      </div>

      <Link href="/" className="mt-8 inline-block text-[12.5px] font-semibold text-[var(--brand)] hover:underline">
        ← Back to home
      </Link>
    </div>
  );
}
