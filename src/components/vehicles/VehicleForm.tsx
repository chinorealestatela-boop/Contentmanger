"use client";

import { useActionState } from "react";
import { createVehicle, updateVehicle } from "@/lib/actions/vehicles";
import { BODY_STYLES, DRIVETRAINS, VEHICLE_CONDITIONS, VEHICLE_STATUSES } from "@/lib/constants";

type Vehicle = {
  id: string;
  stockNumber: string;
  vin: string;
  year: number;
  make: string;
  model: string;
  trim: string | null;
  condition: string;
  bodyStyle: string | null;
  drivetrain: string | null;
  mileage: number;
  exteriorColor: string | null;
  interiorColor: string | null;
  msrp: number | null;
  sellingPrice: number | null;
  internetPrice: number | null;
  status: string;
  location: string | null;
  seatingCapacity: number | null;
  description: string | null;
};

export function VehicleForm({ vehicle }: { vehicle?: Vehicle }) {
  const action = vehicle ? updateVehicle : createVehicle;
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="space-y-4">
      {vehicle && <input type="hidden" name="vehicleId" value={vehicle.id} />}
      {state?.error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</div>}

      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Stock Number</label><input name="stockNumber" required defaultValue={vehicle?.stockNumber} className="input" /></div>
        <div><label className="label">VIN</label><input name="vin" required defaultValue={vehicle?.vin} className="input" /></div>
      </div>
      <div className="grid grid-cols-4 gap-3">
        <div><label className="label">Year</label><input name="year" type="number" required defaultValue={vehicle?.year} className="input" /></div>
        <div><label className="label">Make</label><input name="make" required defaultValue={vehicle?.make} className="input" /></div>
        <div><label className="label">Model</label><input name="model" required defaultValue={vehicle?.model} className="input" /></div>
        <div><label className="label">Trim</label><input name="trim" defaultValue={vehicle?.trim ?? ""} className="input" /></div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="label">Condition</label>
          <select name="condition" defaultValue={vehicle?.condition ?? "USED"} className="input">{VEHICLE_CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
        </div>
        <div>
          <label className="label">Body Style</label>
          <select name="bodyStyle" defaultValue={vehicle?.bodyStyle ?? ""} className="input"><option value="">—</option>{BODY_STYLES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
        </div>
        <div>
          <label className="label">Drivetrain</label>
          <select name="drivetrain" defaultValue={vehicle?.drivetrain ?? ""} className="input"><option value="">—</option>{DRIVETRAINS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div><label className="label">Mileage</label><input name="mileage" type="number" defaultValue={vehicle?.mileage} className="input" /></div>
        <div><label className="label">Exterior Color</label><input name="exteriorColor" defaultValue={vehicle?.exteriorColor ?? ""} className="input" /></div>
        <div><label className="label">Interior Color</label><input name="interiorColor" defaultValue={vehicle?.interiorColor ?? ""} className="input" /></div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div><label className="label">MSRP</label><input name="msrp" type="number" defaultValue={vehicle?.msrp ?? ""} className="input" /></div>
        <div><label className="label">Selling Price</label><input name="sellingPrice" type="number" defaultValue={vehicle?.sellingPrice ?? ""} className="input" /></div>
        <div><label className="label">Internet Price</label><input name="internetPrice" type="number" defaultValue={vehicle?.internetPrice ?? ""} className="input" /></div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="label">Status</label>
          <select name="status" defaultValue={vehicle?.status ?? "AVAILABLE"} className="input">{VEHICLE_STATUSES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
        </div>
        <div><label className="label">Location</label><input name="location" defaultValue={vehicle?.location ?? ""} className="input" /></div>
        <div><label className="label">Seating Capacity</label><input name="seatingCapacity" type="number" defaultValue={vehicle?.seatingCapacity ?? ""} className="input" /></div>
      </div>
      <div><label className="label">Description</label><textarea name="description" rows={3} defaultValue={vehicle?.description ?? ""} className="input" /></div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="submit" disabled={pending} className="btn btn-primary px-6">{pending ? "Saving…" : vehicle ? "Save Changes" : "Add Vehicle"}</button>
      </div>
    </form>
  );
}
