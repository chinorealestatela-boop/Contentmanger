"use client";

// One-tap lead creation from a scanned license (Feature 6/7/8): SCAN →
// (possible-duplicate check) → REVIEW → SAVE. The actual lead/customer
// creation reuses the existing createLead server action unchanged — this
// is just a different, faster front door onto it (see
// src/lib/actions/leads.ts, which already accepts an optional
// existingCustomerId precisely so a flow like this one can link a new
// lead to a customer that turns out to already exist instead of creating
// a duplicate).

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ScanLine, UserCheck, UserPlus } from "lucide-react";
import { LicenseScanner } from "@/components/licenseScan/LicenseScanner";
import { findPossibleDuplicates, type DuplicateMatch } from "@/lib/actions/licenseScan";
import { createLead } from "@/lib/actions/leads";
import type { ParsedLicense } from "@/lib/licenseScan/aamva";
import { CONTACT_METHODS, PURCHASE_TIMEFRAMES, TEMPERATURES, FINANCE_TYPES } from "@/lib/constants";

type Step = "IDLE" | "SCAN" | "CHECKING" | "MATCH" | "REVIEW";

export function ScanLeadFlow({
  sources,
  users,
  vehicles,
  currentUserId,
}: {
  sources: { id: string; name: string }[];
  users: { id: string; firstName: string; lastName: string }[];
  vehicles: { id: string; year: number; make: string; model: string; stockNumber: string }[];
  currentUserId: string;
}) {
  const [step, setStep] = useState<Step>("IDLE");
  const [parsed, setParsed] = useState<ParsedLicense | null>(null);
  const [matches, setMatches] = useState<DuplicateMatch[]>([]);
  const [existingCustomer, setExistingCustomer] = useState<DuplicateMatch | null>(null);

  async function handleScanned(result: ParsedLicense) {
    setParsed(result);
    setStep("CHECKING");
    const { firstName = "", lastName = "" } = result.fields;
    const found = firstName && lastName ? await findPossibleDuplicates(firstName, lastName) : [];
    if (found.length > 0) {
      setMatches(found);
      setStep("MATCH");
    } else {
      setStep("REVIEW");
    }
  }

  if (step === "IDLE") {
    return (
      <button onClick={() => setStep("SCAN")} className="btn btn-primary w-full justify-center py-4 text-[15px]">
        <ScanLine size={18} /> Scan Driver&rsquo;s License
      </button>
    );
  }

  if (step === "SCAN") {
    return (
      <div className="card p-5">
        <LicenseScanner onScanned={handleScanned} onCancel={() => setStep("IDLE")} />
      </div>
    );
  }

  if (step === "CHECKING") {
    return <div className="card p-10 text-center text-sm text-[var(--text-muted)]">Checking for an existing customer…</div>;
  }

  if (step === "MATCH") {
    return (
      <div className="card space-y-4 p-5">
        <div>
          <h3 className="text-[15px] font-semibold text-[var(--text)]">Possible existing customer found</h3>
          <p className="text-[13px] text-[var(--text-muted)]">We found {matches.length === 1 ? "someone" : `${matches.length} people`} in the CRM with a similar name. Is this the same person?</p>
        </div>
        <ul className="space-y-2">
          {matches.map((m) => (
            <li key={m.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3.5 py-2.5">
              <div>
                <p className="text-[13px] font-medium text-[var(--text)]">{m.firstName} {m.lastName}</p>
                <p className="text-[11.5px] text-[var(--text-faint)]">{[m.phone, m.email, m.city].filter(Boolean).join(" · ") || "No contact info on file"} · Owner: {m.ownerName}</p>
              </div>
              <button
                onClick={() => {
                  setExistingCustomer(m);
                  setStep("REVIEW");
                }}
                className="btn btn-secondary btn-sm"
              >
                <UserCheck size={13} /> Use This Customer
              </button>
            </li>
          ))}
        </ul>
        <button
          onClick={() => {
            setExistingCustomer(null);
            setStep("REVIEW");
          }}
          className="btn btn-ghost w-full"
        >
          <UserPlus size={14} /> None of these — Create New Customer
        </button>
      </div>
    );
  }

  return (
    <ReviewForm
      parsed={parsed}
      existingCustomer={existingCustomer}
      sources={sources}
      users={users}
      vehicles={vehicles}
      currentUserId={currentUserId}
      onRescan={() => {
        setParsed(null);
        setExistingCustomer(null);
        setStep("SCAN");
      }}
    />
  );
}

function ReviewForm({
  parsed,
  existingCustomer,
  sources,
  users,
  vehicles,
  currentUserId,
  onRescan,
}: {
  parsed: ParsedLicense | null;
  existingCustomer: DuplicateMatch | null;
  sources: { id: string; name: string }[];
  users: { id: string; firstName: string; lastName: string }[];
  vehicles: { id: string; year: number; make: string; model: string; stockNumber: string }[];
  currentUserId: string;
  onRescan: () => void;
}) {
  const [state, formAction, pending] = useActionState(createLead, null);
  const router = useRouter();
  const f = parsed?.fields;

  useEffect(() => {
    if (state?.success && state.customerId) router.push(`/customers/${state.customerId}`);
  }, [state, router]);

  return (
    <form action={formAction} className="space-y-4">
      {existingCustomer && <input type="hidden" name="existingCustomerId" value={existingCustomer.id} />}
      {state?.error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</div>}

      <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] px-3.5 py-2.5">
        <p className="text-[12.5px] text-[var(--text-muted)]">
          {existingCustomer ? (
            <>Linking to existing customer <span className="font-semibold text-[var(--text)]">{existingCustomer.firstName} {existingCustomer.lastName}</span>.</>
          ) : parsed ? (
            <>Review the scanned info below before saving — nothing is saved yet.</>
          ) : (
            <>Enter the lead manually, or scan a license to auto-fill.</>
          )}
        </p>
        <button type="button" onClick={onRescan} className="shrink-0 text-[12px] font-semibold text-[var(--brand)] hover:underline">Re-scan</button>
      </div>

      <div className="card space-y-3.5 p-5">
        <h3 className="text-[12.5px] font-bold uppercase tracking-wide text-[var(--text-muted)]">Customer Information</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First Name" name="firstName" required defaultValue={existingCustomer?.firstName ?? f?.firstName} />
          <Field label="Last Name" name="lastName" required defaultValue={existingCustomer?.lastName ?? f?.lastName} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone" name="phone" type="tel" defaultValue={existingCustomer?.phone ?? undefined} />
          <Field label="Email" name="email" type="email" defaultValue={existingCustomer?.email ?? undefined} />
        </div>
        <Field label="Address" name="address" defaultValue={f?.address} />
        <div className="grid grid-cols-3 gap-3">
          <Field label="City" name="city" defaultValue={existingCustomer?.city ?? f?.city} />
          <Field label="State" name="state" defaultValue={f?.state} />
          <Field label="Zip" name="zip" defaultValue={f?.zip} />
        </div>
        <SelectField label="Preferred Contact Method" name="preferredContactMethod" options={CONTACT_METHODS} defaultValue="PHONE" />
      </div>

      <div className="card space-y-3.5 p-5">
        <h3 className="text-[12.5px] font-bold uppercase tracking-wide text-[var(--text-muted)]">Lead</h3>
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Lead Source" name="sourceId" options={sources.map((s) => ({ value: s.id, label: s.name }))} placeholder="Select source…" />
          <SelectField label="Assigned Salesperson" name="assigneeId" required options={users.map((u) => ({ value: u.id, label: `${u.firstName} ${u.lastName}` }))} defaultValue={currentUserId} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Temperature" name="temperature" options={TEMPERATURES} defaultValue="WARM" />
          <SelectField label="Purchase Timeframe" name="purchaseTimeframe" options={PURCHASE_TIMEFRAMES} placeholder="Select…" />
        </div>
      </div>

      <div className="card space-y-3.5 p-5">
        <h3 className="text-[12.5px] font-bold uppercase tracking-wide text-[var(--text-muted)]">Vehicle Interested In</h3>
        <SelectField label="From Inventory (optional)" name="vehicleId" options={vehicles.map((v) => ({ value: v.id, label: `${v.year} ${v.make} ${v.model} (#${v.stockNumber})` }))} placeholder="— None —" />
      </div>

      <div className="card space-y-3.5 p-5">
        <h3 className="text-[12.5px] font-bold uppercase tracking-wide text-[var(--text-muted)]">Financing</h3>
        <SelectField label="Finance Type" name="financeType" options={FINANCE_TYPES} placeholder="—" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Desired Monthly Payment" name="desiredPayment" type="number" />
          <Field label="Down Payment" name="downPayment" type="number" />
        </div>
      </div>

      <div className="card space-y-3.5 p-5">
        <h3 className="text-[12.5px] font-bold uppercase tracking-wide text-[var(--text-muted)]">Notes</h3>
        <TextField label="Sales Notes" name="salesNotes" />
      </div>

      <button type="submit" disabled={pending} className="btn btn-primary w-full justify-center py-3.5 text-[15px]">{pending ? "Saving…" : "Save Lead"}</button>
    </form>
  );
}

function Field({ label, name, type = "text", required, defaultValue }: { label: string; name: string; type?: string; required?: boolean; defaultValue?: string }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input name={name} type={type} required={required} defaultValue={defaultValue} className="input" />
    </div>
  );
}

function TextField({ label, name }: { label: string; name: string }) {
  return (
    <div>
      <label className="label">{label}</label>
      <textarea name={name} rows={2} className="input" />
    </div>
  );
}

function SelectField({
  label,
  name,
  options,
  defaultValue,
  placeholder,
  required,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <select name={name} defaultValue={defaultValue ?? ""} required={required} className="input">
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
