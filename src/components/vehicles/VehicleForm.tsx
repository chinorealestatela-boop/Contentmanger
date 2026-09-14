"use client";

import { useActionState } from "react";
import { createVehicle, updateVehicle } from "@/lib/actions/vehicles";
import { FormSection, Field, TextField, SelectField, ErrorBox } from "@/components/ui/Form";
import { VEHICLE_TYPES } from "@/lib/constants";

type Vehicle = {
  id: string;
  fleetNumber: string;
  name: string;
  vin: string;
  year: number;
  make: string;
  model: string;
  licensePlate: string | null;
  vehicleType: string;
  color: string | null;
  seatingCapacity: number | null;
  currentMileage: number;
  homeBase: string | null;
  hourlyRate: number | null;
  dailyRate: number | null;
  depositRequirement: number | null;
  insuranceProvider: string | null;
  insurancePolicyNo: string | null;
  notes: string | null;
};

export function VehicleForm({ vehicle }: { vehicle?: Vehicle }) {
  const action = vehicle ? updateVehicle : createVehicle;
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="space-y-6">
      {vehicle && <input type="hidden" name="vehicleId" value={vehicle.id} />}
      {state?.error && <ErrorBox>{state.error}</ErrorBox>}

      <FormSection title="Identity">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fleet Number" name="fleetNumber" required defaultValue={vehicle?.fleetNumber} />
          <Field label="Display Name" name="name" required defaultValue={vehicle?.name} placeholder="e.g. Rolls-Royce Cullinan — Black" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Year" name="year" type="number" required defaultValue={vehicle?.year} />
          <Field label="Make" name="make" required defaultValue={vehicle?.make} />
          <Field label="Model" name="model" required defaultValue={vehicle?.model} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="VIN" name="vin" required defaultValue={vehicle?.vin} />
          <Field label="License Plate" name="licensePlate" defaultValue={vehicle?.licensePlate ?? ""} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <SelectField label="Vehicle Type" name="vehicleType" options={VEHICLE_TYPES} defaultValue={vehicle?.vehicleType ?? "OTHER"} />
          <Field label="Color" name="color" defaultValue={vehicle?.color ?? ""} />
          <Field label="Seating Capacity" name="seatingCapacity" type="number" defaultValue={vehicle?.seatingCapacity ?? undefined} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Current Mileage" name="currentMileage" type="number" defaultValue={vehicle?.currentMileage ?? 0} />
          <Field label="Home Base" name="homeBase" defaultValue={vehicle?.homeBase ?? ""} placeholder="e.g. Stratos Garage — Downtown LA" />
        </div>
      </FormSection>

      <FormSection title="Pricing">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Hourly Rate" name="hourlyRate" type="number" defaultValue={vehicle?.hourlyRate ?? undefined} />
          <Field label="Daily Rate" name="dailyRate" type="number" defaultValue={vehicle?.dailyRate ?? undefined} />
          <Field label="Deposit Requirement" name="depositRequirement" type="number" defaultValue={vehicle?.depositRequirement ?? undefined} />
        </div>
      </FormSection>

      <FormSection title="Insurance &amp; Registration">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Insurance Provider" name="insuranceProvider" defaultValue={vehicle?.insuranceProvider ?? ""} />
          <Field label="Policy Number" name="insurancePolicyNo" defaultValue={vehicle?.insurancePolicyNo ?? ""} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Insurance Expires" name="insuranceExpiresAt" type="date" />
          <Field label="Registration Expires" name="registrationExpiresAt" type="date" />
        </div>
      </FormSection>

      <FormSection title="Notes">
        <TextField label="Notes" name="notes" rows={3} defaultValue={vehicle?.notes ?? ""} />
      </FormSection>

      <div className="flex justify-end gap-2">
        <button type="submit" disabled={pending} className="btn btn-primary px-6 py-2.5">{pending ? "Saving…" : vehicle ? "Save Changes" : "Add Vehicle"}</button>
      </div>
    </form>
  );
}
