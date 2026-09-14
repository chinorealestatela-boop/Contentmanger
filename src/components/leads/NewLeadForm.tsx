"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { createLead } from "@/lib/actions/leads";
import { FormSection, Field, TextField, SelectField, CheckboxField, ErrorBox } from "@/components/ui/Form";
import { CONTACT_METHODS, SERVICE_TYPES } from "@/lib/constants";

export function NewLeadForm({
  sources,
  users,
  vehicles,
  currentUserId,
}: {
  sources: { id: string; name: string }[];
  users: { id: string; firstName: string; lastName: string }[];
  vehicles: { id: string; name: string; fleetNumber: string }[];
  currentUserId: string;
}) {
  const [state, formAction, pending] = useActionState(createLead, null);
  const router = useRouter();

  useEffect(() => {
    if (state?.success && state.leadId) router.push(`/leads/${state.leadId}`);
  }, [state, router]);

  return (
    <form action={formAction} className="space-y-6">
      {state?.error && <ErrorBox>{state.error}</ErrorBox>}

      <FormSection
        title="Quick Capture — Paste the Inquiry"
        action={<span className="flex items-center gap-1 text-[10px] font-semibold text-[var(--brand-bright)]"><Sparkles size={11} /> AI-assisted</span>}
      >
        <p className="text-xs text-[var(--text-muted)]">
          Paste the customer&rsquo;s message and the AI assistant will pre-fill trip details below once the lead is created — or just fill the form in manually.
        </p>
        <TextField label="Raw Inquiry (optional)" name="rawInquiry" rows={3} placeholder={'e.g. "Hey I need a Sprinter for 8 people from LAX to Malibu Friday around 7pm."'} />
      </FormSection>

      <FormSection title="Client">
        <div className="grid grid-cols-2 gap-3">
          <Field label="First Name" name="firstName" required />
          <Field label="Last Name" name="lastName" required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone" name="phone" type="tel" />
          <Field label="Email" name="email" type="email" />
        </div>
        <Field label="Company (optional)" name="company" />
        <SelectField label="Preferred Contact Method" name="preferredContactMethod" options={CONTACT_METHODS} defaultValue="PHONE" />
      </FormSection>

      <FormSection title="Lead">
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Lead Source" name="sourceId" options={sources.map((s) => ({ value: s.id, label: s.name }))} placeholder="Select source…" />
          <SelectField label="Assigned Employee" name="assigneeId" options={users.map((u) => ({ value: u.id, label: `${u.firstName} ${u.lastName}` }))} defaultValue={currentUserId} />
        </div>
        <CheckboxField label="Flag as VIP / high-value lead" name="isVip" />
      </FormSection>

      <FormSection title="Trip Details">
        <SelectField label="Service Requested" name="serviceRequested" options={SERVICE_TYPES} placeholder="Select service…" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Pickup Location" name="pickupLocation" />
          <Field label="Drop-off Location" name="dropoffLocation" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Date" name="serviceDate" type="date" />
          <Field label="Pickup Time" name="pickupTime" type="time" />
          <Field label="Passengers" name="passengers" type="number" min="1" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Vehicle Requested" name="vehicleId" options={vehicles.map((v) => ({ value: v.id, label: `${v.name} (${v.fleetNumber})` }))} placeholder="— Not specified —" />
          <Field label="Or describe the vehicle" name="vehicleRequested" placeholder="e.g. Sprinter van" />
        </div>
        <CheckboxField label="Chauffeur requested (uncheck for self-drive rental)" name="chauffeurRequested" defaultChecked />
        <div className="grid grid-cols-3 gap-3">
          <Field label="Estimated Hours" name="estimatedHours" type="number" step="0.5" />
          <Field label="Estimated Price" name="estimatedPrice" type="number" />
          <Field label="Client Budget" name="budget" type="number" />
        </div>
      </FormSection>

      <FormSection title="Notes">
        <TextField label="Notes" name="notes" rows={3} />
      </FormSection>

      <div className="flex justify-end gap-2">
        <button type="submit" disabled={pending} className="btn btn-primary px-6 py-2.5">{pending ? "Creating…" : "Create Lead"}</button>
      </div>
    </form>
  );
}
