"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateCustomer } from "@/lib/actions/customers";
import { Field, SelectField, TextField, ErrorBox } from "@/components/ui/Form";
import { CONTACT_METHODS } from "@/lib/constants";

type Customer = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  company: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  preferredContactMethod: string;
  specialRequests: string | null;
  notes: string | null;
};

export function EditCustomerForm({ customer }: { customer: Customer }) {
  const [state, formAction, pending] = useActionState(updateCustomer, null);
  const router = useRouter();

  useEffect(() => {
    if (state?.success) router.push(`/customers/${customer.id}`);
  }, [state, router, customer.id]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="customerId" value={customer.id} />
      {state?.error && <ErrorBox>{state.error}</ErrorBox>}
      <div className="grid grid-cols-2 gap-3">
        <Field label="First Name" name="firstName" required defaultValue={customer.firstName} />
        <Field label="Last Name" name="lastName" required defaultValue={customer.lastName} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Phone" name="phone" defaultValue={customer.phone ?? ""} />
        <Field label="Email" name="email" type="email" defaultValue={customer.email ?? ""} />
      </div>
      <Field label="Company (optional)" name="company" defaultValue={customer.company ?? ""} />
      <Field label="Address" name="address" defaultValue={customer.address ?? ""} />
      <div className="grid grid-cols-3 gap-3">
        <Field label="City" name="city" defaultValue={customer.city ?? ""} />
        <Field label="State" name="state" defaultValue={customer.state ?? ""} />
        <Field label="Zip" name="zip" defaultValue={customer.zip ?? ""} />
      </div>
      <SelectField label="Preferred Contact Method" name="preferredContactMethod" options={CONTACT_METHODS} defaultValue={customer.preferredContactMethod} />
      <TextField label="Special Requests" name="specialRequests" defaultValue={customer.specialRequests ?? ""} placeholder="e.g. Always stock chilled champagne, prefers Marcus as chauffeur" />
      <TextField label="Notes" name="notes" defaultValue={customer.notes ?? ""} />
      <div className="flex justify-end gap-2 pt-2">
        <button type="submit" disabled={pending} className="btn btn-primary">{pending ? "Saving…" : "Save Changes"}</button>
      </div>
    </form>
  );
}
