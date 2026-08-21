"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createLead } from "@/lib/actions/leads";
import {
  CONTACT_METHODS, CONTACT_TIMES, PURCHASE_TIMEFRAMES, TEMPERATURES, FINANCE_TYPES,
  BODY_STYLES, DRIVETRAINS,
} from "@/lib/constants";

export function NewLeadForm({
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
  const [state, formAction, pending] = useActionState(createLead, null);
  const [hasTrade, setHasTrade] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (state?.success && state.customerId) router.push(`/customers/${state.customerId}`);
  }, [state, router]);

  return (
    <form action={formAction} className="space-y-6">
      {state?.error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</div>}

      <FormSection title="Customer">
        <div className="grid grid-cols-2 gap-3">
          <Field label="First Name" name="firstName" required />
          <Field label="Last Name" name="lastName" required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone" name="phone" type="tel" />
          <Field label="Email" name="email" type="email" />
        </div>
        <Field label="Address" name="address" />
        <div className="grid grid-cols-3 gap-3">
          <Field label="City" name="city" />
          <Field label="State" name="state" />
          <Field label="Zip" name="zip" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Preferred Contact Method" name="preferredContactMethod" options={CONTACT_METHODS} defaultValue="PHONE" />
          <SelectField label="Best Contact Time" name="bestContactTime" options={CONTACT_TIMES} placeholder="—" />
        </div>
      </FormSection>

      <FormSection title="Lead">
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Lead Source" name="sourceId" options={sources.map((s) => ({ value: s.id, label: s.name }))} placeholder="Select source…" />
          <SelectField label="Assigned Salesperson" name="assigneeId" required options={users.map((u) => ({ value: u.id, label: `${u.firstName} ${u.lastName}` }))} defaultValue={currentUserId} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Temperature" name="temperature" options={TEMPERATURES} defaultValue="COLD" />
          <SelectField label="Purchase Timeframe" name="purchaseTimeframe" options={PURCHASE_TIMEFRAMES} placeholder="Select…" />
        </div>
      </FormSection>

      <FormSection title="Vehicle of Interest">
        <SelectField label="From Inventory (optional)" name="vehicleId" options={vehicles.map((v) => ({ value: v.id, label: `${v.year} ${v.make} ${v.model} (#${v.stockNumber})` }))} placeholder="— None —" />
        <p className="text-xs text-[var(--text-muted)]">Or describe what they&rsquo;re looking for if it&rsquo;s not in inventory yet:</p>
        <div className="grid grid-cols-4 gap-3">
          <Field label="Year" name="vehicleYear" type="number" />
          <Field label="Make" name="vehicleMake" />
          <Field label="Model" name="vehicleModel" />
          <Field label="Trim" name="vehicleTrim" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Body Style Preference" name="prefBodyStyle" options={BODY_STYLES} placeholder="—" />
          <SelectField label="Drivetrain Preference" name="prefDrivetrain" options={DRIVETRAINS} placeholder="—" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Max Price" name="prefMaxPrice" type="number" />
          <Field label="Color Preference" name="prefColor" />
        </div>
        <label className="flex items-center gap-2 text-[13px] text-[var(--text)]">
          <input type="checkbox" name="prefThirdRow" className="h-4 w-4 rounded border-[var(--border)]" /> Needs third-row seating
        </label>
      </FormSection>

      <FormSection title="Financing">
        <SelectField label="Finance Type" name="financeType" options={FINANCE_TYPES} placeholder="—" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Desired Monthly Payment" name="desiredPayment" type="number" />
          <Field label="Down Payment" name="downPayment" type="number" />
        </div>
        <label className="flex items-center gap-2 text-[13px] text-[var(--text)]">
          <input type="checkbox" name="hasCoBuyer" className="h-4 w-4 rounded border-[var(--border)]" /> Has a co-buyer
        </label>
        <Field label="Co-Buyer Name" name="coBuyerName" />
      </FormSection>

      <FormSection title="Trade-In">
        <label className="flex items-center gap-2 text-[13px] text-[var(--text)]">
          <input type="checkbox" name="hasTrade" checked={hasTrade} onChange={(e) => setHasTrade(e.target.checked)} className="h-4 w-4 rounded border-[var(--border)]" /> Customer has a trade-in
        </label>
        {hasTrade && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Year" name="tradeYear" type="number" />
              <Field label="Make" name="tradeMake" />
              <Field label="Model" name="tradeModel" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Payoff" name="tradePayoff" type="number" />
              <Field label="Estimated Value" name="tradeEstValue" type="number" />
            </div>
          </>
        )}
      </FormSection>

      <FormSection title="Notes">
        <TextField label="Customer Needs" name="customerNeeds" />
        <TextField label="Customer Wants" name="customerWants" />
        <TextField label="Objections" name="objections" />
        <TextField label="Preferences" name="preferences" />
        <TextField label="Sales Notes" name="salesNotes" />
      </FormSection>

      <div className="flex justify-end gap-2">
        <button type="submit" disabled={pending} className="btn btn-primary px-6 py-2.5">{pending ? "Creating…" : "Create Lead"}</button>
      </div>
    </form>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card space-y-3.5 p-5">
      <h3 className="text-[12.5px] font-bold uppercase tracking-wide text-[var(--text-muted)]">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, name, type = "text", required }: { label: string; name: string; type?: string; required?: boolean }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input name={name} type={type} required={required} className="input" />
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
