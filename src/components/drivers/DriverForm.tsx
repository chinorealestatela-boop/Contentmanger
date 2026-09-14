"use client";

import { useActionState } from "react";
import { createDriver, updateDriver } from "@/lib/actions/drivers";
import { FormSection, Field, TextField, ErrorBox } from "@/components/ui/Form";

type Driver = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  licenseNumber: string | null;
  notes: string | null;
};

export function DriverForm({ driver }: { driver?: Driver }) {
  const action = driver ? updateDriver : createDriver;
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="space-y-6">
      {driver && <input type="hidden" name="driverId" value={driver.id} />}
      {state?.error && <ErrorBox>{state.error}</ErrorBox>}

      <FormSection title="Chauffeur">
        <div className="grid grid-cols-2 gap-3">
          <Field label="First Name" name="firstName" required defaultValue={driver?.firstName} />
          <Field label="Last Name" name="lastName" required defaultValue={driver?.lastName} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone" name="phone" defaultValue={driver?.phone ?? ""} />
          <Field label="Email" name="email" type="email" defaultValue={driver?.email ?? ""} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="License Number" name="licenseNumber" defaultValue={driver?.licenseNumber ?? ""} />
          <Field label="License Expires" name="licenseExpiresAt" type="date" />
        </div>
        <TextField label="Notes" name="notes" rows={3} defaultValue={driver?.notes ?? ""} />
      </FormSection>

      <div className="flex justify-end gap-2">
        <button type="submit" disabled={pending} className="btn btn-primary px-6 py-2.5">{pending ? "Saving…" : driver ? "Save Changes" : "Add Chauffeur"}</button>
      </div>
    </form>
  );
}
