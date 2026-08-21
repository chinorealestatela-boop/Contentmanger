"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { updateCustomer } from "@/lib/actions/customers";
import { CONTACT_METHODS, CONTACT_TIMES } from "@/lib/constants";

type Customer = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  preferredContactMethod: string;
  bestContactTime: string | null;
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
      {state?.error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</div>}
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">First Name</label><input name="firstName" required defaultValue={customer.firstName} className="input" /></div>
        <div><label className="label">Last Name</label><input name="lastName" required defaultValue={customer.lastName} className="input" /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Phone</label><input name="phone" defaultValue={customer.phone ?? ""} className="input" /></div>
        <div><label className="label">Email</label><input name="email" type="email" defaultValue={customer.email ?? ""} className="input" /></div>
      </div>
      <div><label className="label">Address</label><input name="address" defaultValue={customer.address ?? ""} className="input" /></div>
      <div className="grid grid-cols-3 gap-3">
        <div><label className="label">City</label><input name="city" defaultValue={customer.city ?? ""} className="input" /></div>
        <div><label className="label">State</label><input name="state" defaultValue={customer.state ?? ""} className="input" /></div>
        <div><label className="label">Zip</label><input name="zip" defaultValue={customer.zip ?? ""} className="input" /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Preferred Contact</label>
          <select name="preferredContactMethod" defaultValue={customer.preferredContactMethod} className="input">
            {CONTACT_METHODS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Best Contact Time</label>
          <select name="bestContactTime" defaultValue={customer.bestContactTime ?? ""} className="input">
            <option value="">—</option>
            {CONTACT_TIMES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="submit" disabled={pending} className="btn btn-primary">{pending ? "Saving…" : "Save Changes"}</button>
      </div>
    </form>
  );
}
