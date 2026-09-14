"use client";

import { useActionState, useMemo, useState } from "react";
import { createQuote } from "@/lib/actions/quotes";
import { FormSection, Field, TextField, SelectField, ErrorBox } from "@/components/ui/Form";
import { SERVICE_TYPES, AMENITY_OPTIONS } from "@/lib/constants";
import { computePricing } from "@/lib/pricing";
import { formatCurrency } from "@/lib/format";

type Customer = { id: string; firstName: string; lastName: string; tier: string };
type Vehicle = { id: string; name: string; fleetNumber: string; hourlyRate: number | null };
type Driver = { id: string; firstName: string; lastName: string };

export function QuoteForm({
  customers,
  vehicles,
  drivers,
  defaultCustomerId,
  defaultLeadId,
}: {
  customers: Customer[];
  vehicles: Vehicle[];
  drivers: Driver[];
  defaultCustomerId?: string;
  defaultLeadId?: string;
}) {
  const [state, formAction, pending] = useActionState(createQuote, null);
  const [vehicleId, setVehicleId] = useState("");
  const [hours, setHours] = useState("3");
  const [baseRate, setBaseRate] = useState("0");
  const [driverFee, setDriverFee] = useState("0");
  const [mileageFee, setMileageFee] = useState("0");
  const [additionalFees, setAdditionalFees] = useState("0");
  const [discount, setDiscount] = useState("0");
  const [depositRate, setDepositRate] = useState("30");

  const pricing = useMemo(
    () =>
      computePricing({
        baseRate: Number(baseRate) || 0,
        driverFee: Number(driverFee) || 0,
        mileageFee: Number(mileageFee) || 0,
        additionalFees: Number(additionalFees) || 0,
        discount: Number(discount) || 0,
        depositRate: (Number(depositRate) || 0) / 100,
      }),
    [baseRate, driverFee, mileageFee, additionalFees, discount, depositRate]
  );

  return (
    <form action={formAction} className="space-y-6">
      {defaultLeadId && <input type="hidden" name="leadId" value={defaultLeadId} />}
      {state?.error && <ErrorBox>{state.error}</ErrorBox>}

      <FormSection title="Client">
        <SelectField label="Client" name="customerId" required options={customers.map((c) => ({ value: c.id, label: `${c.firstName} ${c.lastName}${c.tier !== "STANDARD" ? ` (${c.tier})` : ""}` }))} defaultValue={defaultCustomerId} placeholder="Select client…" />
      </FormSection>

      <FormSection title="Trip">
        <SelectField label="Service" name="serviceType" options={SERVICE_TYPES} placeholder="Select service…" />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Vehicle</label>
            <select
              name="vehicleId"
              className="input"
              value={vehicleId}
              onChange={(e) => {
                setVehicleId(e.target.value);
                const v = vehicles.find((x) => x.id === e.target.value);
                if (v?.hourlyRate) setBaseRate(String(v.hourlyRate * (Number(hours) || 1)));
              }}
            >
              <option value="">Select vehicle…</option>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name} ({v.fleetNumber})</option>)}
            </select>
          </div>
          <SelectField label="Chauffeur" name="driverId" options={drivers.map((d) => ({ value: d.id, label: `${d.firstName} ${d.lastName}` }))} placeholder="Not assigned yet" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Pickup Location" name="pickupLocation" />
          <Field label="Drop-off Location" name="dropoffLocation" />
        </div>
        <Field label="Additional Stops (comma-separated)" name="additionalStops" />
        <div className="grid grid-cols-4 gap-3">
          <Field label="Date" name="serviceDate" type="date" />
          <Field label="Pickup Time" name="pickupTime" type="time" />
          <div>
            <label className="label">Hours</label>
            <input name="hours" type="number" step="0.5" className="input" value={hours} onChange={(e) => setHours(e.target.value)} />
          </div>
          <Field label="Distance (mi)" name="distanceMiles" type="number" />
        </div>
      </FormSection>

      <FormSection title="Amenities">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {AMENITY_OPTIONS.map((a) => (
            <label key={a} className="flex items-center gap-2 text-[12.5px] text-[var(--text)]">
              <input type="checkbox" name="amenities" value={a} className="h-3.5 w-3.5 rounded border-[var(--border)] accent-[var(--brand)]" /> {a}
            </label>
          ))}
        </div>
      </FormSection>

      <FormSection title="Pricing">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div><label className="label">Base Rate</label><input name="baseRate" type="number" className="input" value={baseRate} onChange={(e) => setBaseRate(e.target.value)} /></div>
          <div><label className="label">Chauffeur Fee</label><input name="driverFee" type="number" className="input" value={driverFee} onChange={(e) => setDriverFee(e.target.value)} /></div>
          <div><label className="label">Mileage Fee</label><input name="mileageFee" type="number" className="input" value={mileageFee} onChange={(e) => setMileageFee(e.target.value)} /></div>
          <div><label className="label">Additional Fees</label><input name="additionalFees" type="number" className="input" value={additionalFees} onChange={(e) => setAdditionalFees(e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Discount</label><input name="discount" type="number" className="input" value={discount} onChange={(e) => setDiscount(e.target.value)} /></div>
          <div><label className="label">Deposit %</label><input name="depositRate" type="number" className="input" value={depositRate} onChange={(e) => setDepositRate(e.target.value)} /></div>
        </div>
        <div className="rounded-xl border border-[var(--brand-line)] bg-[var(--brand-soft)] p-4 text-[13px]">
          <div className="flex justify-between text-[var(--text-muted)]"><span>Subtotal</span><span>{formatCurrency(pricing.subtotal)}</span></div>
          <div className="flex justify-between text-[var(--text-muted)]"><span>Tax</span><span>{formatCurrency(pricing.taxAmount)}</span></div>
          <div className="mt-1 flex justify-between border-t border-[var(--brand-line)] pt-1 text-[15px] font-semibold text-[var(--text)]"><span>Total</span><span>{formatCurrency(pricing.totalPrice)}</span></div>
          <div className="mt-1 flex justify-between text-[var(--text-faint)]"><span>Deposit</span><span>{formatCurrency(pricing.depositAmount)}</span></div>
        </div>
      </FormSection>

      <FormSection title="Terms">
        <TextField label="Terms &amp; Conditions" name="termsText" rows={3} defaultValue="50% deposit due at booking; remaining balance due 48 hours before service. Cancellations within 72 hours are non-refundable. Gratuity not included." />
      </FormSection>

      <div className="flex justify-end gap-2">
        <button type="submit" disabled={pending} className="btn btn-primary px-6 py-2.5">{pending ? "Creating…" : "Create Quote"}</button>
      </div>
    </form>
  );
}
