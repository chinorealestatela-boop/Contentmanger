"use client";

import { useActionState } from "react";
import { updateCompanySettings } from "@/lib/actions/settings";
import { Field, TextField, ErrorBox, SuccessBox } from "@/components/ui/Form";

type Company = {
  name: string;
  website?: string;
  phone?: string;
  email?: string;
  address?: string;
  serviceArea?: string;
  depositPercent?: number;
  taxRate?: number;
  bookingPolicy?: string;
  cancellationPolicy?: string;
  termsAndConditions?: string;
};

export function CompanyForm({ initial }: { initial: Company }) {
  const [state, formAction, pending] = useActionState(updateCompanySettings, null);

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && <ErrorBox>{state.error}</ErrorBox>}
      {state?.success && <SuccessBox>{state.success}</SuccessBox>}
      <Field label="Company Name" name="name" required defaultValue={initial.name} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Website" name="website" defaultValue={initial.website ?? ""} />
        <Field label="Phone" name="phone" defaultValue={initial.phone ?? ""} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Email" name="email" type="email" defaultValue={initial.email ?? ""} />
        <Field label="Service Area" name="serviceArea" defaultValue={initial.serviceArea ?? ""} />
      </div>
      <Field label="Address" name="address" defaultValue={initial.address ?? ""} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Default Deposit %" name="depositPercent" type="number" defaultValue={initial.depositPercent ?? 30} />
        <Field label="Tax Rate %" name="taxRate" type="number" step="0.01" defaultValue={initial.taxRate ?? 9.75} />
      </div>
      <TextField label="Booking Policy" name="bookingPolicy" rows={2} defaultValue={initial.bookingPolicy ?? ""} />
      <TextField label="Cancellation Policy" name="cancellationPolicy" rows={2} defaultValue={initial.cancellationPolicy ?? ""} />
      <TextField label="Terms &amp; Conditions" name="termsAndConditions" rows={3} defaultValue={initial.termsAndConditions ?? ""} />
      <div className="flex justify-end"><button type="submit" disabled={pending} className="btn btn-primary">{pending ? "Saving…" : "Save"}</button></div>
    </form>
  );
}
