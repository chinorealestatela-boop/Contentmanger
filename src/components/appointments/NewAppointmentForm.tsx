"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createAppointment } from "@/lib/actions/appointments";
import { APPOINTMENT_TYPES } from "@/lib/constants";

export function NewAppointmentForm({
  customers,
  vehicles,
}: {
  customers: { id: string; firstName: string; lastName: string }[];
  vehicles: { id: string; year: number; make: string; model: string; stockNumber: string }[];
}) {
  const [state, formAction, pending] = useActionState(createAppointment, null);
  const router = useRouter();

  useEffect(() => {
    if (state?.success) router.push("/appointments");
  }, [state, router]);

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</div>}
      <div>
        <label className="label">Customer</label>
        <select name="customerId" required className="input">
          <option value="">Select customer…</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Vehicle (optional)</label>
        <select name="vehicleId" className="input">
          <option value="">— None —</option>
          {vehicles.map((v) => <option key={v.id} value={v.id}>{v.year} {v.make} {v.model} (#{v.stockNumber})</option>)}
        </select>
      </div>
      <div>
        <label className="label">Type</label>
        <select name="type" className="input" defaultValue="SHOWROOM_VISIT">
          {APPOINTMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Date</label><input type="date" name="date" required defaultValue={todayStr} className="input" /></div>
        <div><label className="label">Time</label><input type="time" name="time" required defaultValue="10:00" className="input" /></div>
      </div>
      <div><label className="label">Notes</label><textarea name="notes" rows={3} className="input" /></div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="submit" disabled={pending} className="btn btn-primary px-6">{pending ? "Scheduling…" : "Schedule Appointment"}</button>
      </div>
    </form>
  );
}
