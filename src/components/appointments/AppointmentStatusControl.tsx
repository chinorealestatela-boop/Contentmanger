"use client";

import { useTransition } from "react";
import { updateAppointmentStatus } from "@/lib/actions/appointments";
import { APPOINTMENT_STATUSES, optionColor } from "@/lib/constants";

export function AppointmentStatusControl({ appointmentId, status }: { appointmentId: string; status: string }) {
  const [pending, startTransition] = useTransition();
  const color = optionColor(APPOINTMENT_STATUSES, status);
  return (
    <select
      defaultValue={status}
      disabled={pending}
      onChange={(e) => startTransition(() => updateAppointmentStatus(appointmentId, e.target.value))}
      className="badge cursor-pointer border-0"
      style={{ background: `${color}1a`, color }}
    >
      {APPOINTMENT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
    </select>
  );
}
