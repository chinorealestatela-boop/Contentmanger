"use client";

// Review-before-save screen for the AI Lead Scanner. Submits to the exact
// same createLead action every other lead-creation path in the app uses
// (NewLeadForm, ScanLeadFlow) — this form's only job is turning what the
// AI read off the photo into the same field names createLead already
// expects, with confidence highlighting so a person can catch and fix
// anything the AI wasn't sure about before it's saved. Nothing here is
// persisted until "Confirm and Create Lead" is pressed.

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Plus, Trash2, RotateCcw } from "lucide-react";
import { createLead } from "@/lib/actions/leads";
import { attachScannedDocument } from "@/lib/actions/aiLeadScan";
import type { DuplicateMatch } from "@/lib/actions/licenseScan";
import type { ExtractedLeadForm } from "@/lib/aiScan/extractLeadForm";
import {
  CONTACT_METHODS, PURCHASE_TIMEFRAMES, TEMPERATURES, FINANCE_TYPES,
} from "@/lib/constants";

type Confidence = "low" | "missing" | undefined;

function confidenceOf(extracted: ExtractedLeadForm | null, key: keyof ExtractedLeadForm, rawValue: unknown): Confidence {
  if (!extracted) return undefined;
  if (extracted.lowConfidenceFields.includes(key)) return "low";
  if (rawValue === null || rawValue === undefined || rawValue === "") return "missing";
  return undefined;
}

export function AiScanReviewForm({
  extracted,
  existingCustomer,
  imageFile,
  sources,
  users,
  vehicles,
  currentUserId,
  onRescan,
}: {
  extracted: ExtractedLeadForm | null;
  existingCustomer: DuplicateMatch | null;
  imageFile: File | null;
  sources: { id: string; name: string }[];
  users: { id: string; firstName: string; lastName: string }[];
  vehicles: { id: string; year: number; make: string; model: string; stockNumber: string }[];
  currentUserId: string;
  onRescan: () => void;
}) {
  const [state, formAction, pending] = useActionState(createLead, null);
  const [, startAttachTransition] = useTransition();
  const router = useRouter();
  const e = extracted;

  const [pickPaymentEnabled, setPickPaymentEnabled] = useState(!!e && ((e.initialPaymentToday ?? 0) > 0 || e.pickPayments.length > 0));
  const [pickPaymentInitial, setPickPaymentInitial] = useState(e?.initialPaymentToday != null ? String(e.initialPaymentToday) : "");
  const [paymentRows, setPaymentRows] = useState<{ amount: string; dueDate: string }[]>(
    e && e.pickPayments.length > 0 ? e.pickPayments.map((p) => ({ amount: p.amount != null ? String(p.amount) : "", dueDate: p.dueDate ?? "" })) : [{ amount: "", dueDate: "" }]
  );

  const paymentNotesDefault = e?.pickPayments.map((p) => p.description).filter(Boolean).join("; ") || "";

  const salespersonMatch = e?.salespersonName
    ? users.find((u) => `${u.firstName} ${u.lastName}`.toLowerCase() === e.salespersonName!.trim().toLowerCase())
    : undefined;

  const extraNotesLines: string[] = [];
  if (e?.appointmentDate) extraNotesLines.push(`[AI Scan] Appointment noted on form: ${e.appointmentDate}${e.appointmentTime ? ` ${e.appointmentTime}` : ""} — add to calendar manually if confirmed.`);
  if (e?.otherCheckedOptions && e.otherCheckedOptions.length > 0) extraNotesLines.push(`[AI Scan] Other marked options on form: ${e.otherCheckedOptions.join(", ")}`);
  const salesNotesDefault = [...extraNotesLines, e?.salesNotes].filter(Boolean).join("\n");

  useEffect(() => {
    if (!state?.success || !state.customerId || !imageFile) return;
    const fd = new FormData();
    fd.set("customerId", state.customerId);
    fd.set("image", imageFile);
    if (e) fd.set("extractedData", JSON.stringify(e));
    startAttachTransition(() => { attachScannedDocument(null, fd); });
    router.push(`/customers/${state.customerId}`);
  }, [state, router, imageFile, e, startAttachTransition]);

  const qualityWarning = e && e.imageQuality !== "ok";

  return (
    <form action={formAction} className="space-y-4">
      {existingCustomer && <input type="hidden" name="existingCustomerId" value={existingCustomer.id} />}
      {state?.error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</div>}

      <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] px-3.5 py-2.5">
        <p className="text-[12.5px] text-[var(--text-muted)]">
          {existingCustomer ? (
            <>Linking to existing customer <span className="font-semibold text-[var(--text)]">{existingCustomer.firstName} {existingCustomer.lastName}</span>.</>
          ) : (
            <>Review what the AI read off the form below — nothing is saved until you confirm.</>
          )}
        </p>
        <button type="button" onClick={onRescan} className="shrink-0 text-[12px] font-semibold text-[var(--brand)] hover:underline">Rescan</button>
      </div>

      {qualityWarning && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>
            This photo may be hard to read ({e!.imageQuality}{e!.qualityNotes ? ` — ${e!.qualityNotes}` : ""}). Double-check every field below carefully, or{" "}
            <button type="button" onClick={onRescan} className="font-semibold underline">retake the photo</button>.
          </span>
        </div>
      )}

      <div className="card space-y-3.5 p-5">
        <h3 className="text-[12.5px] font-bold uppercase tracking-wide text-[var(--text-muted)]">Customer Information</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First Name" name="firstName" required defaultValue={existingCustomer?.firstName ?? e?.firstName ?? ""} confidence={confidenceOf(e, "firstName", e?.firstName)} />
          <Field label="Last Name" name="lastName" required defaultValue={existingCustomer?.lastName ?? e?.lastName ?? ""} confidence={confidenceOf(e, "lastName", e?.lastName)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone" name="phone" type="tel" defaultValue={existingCustomer?.phone ?? e?.phone ?? ""} confidence={confidenceOf(e, "phone", e?.phone)} />
          <Field label="Email" name="email" type="email" defaultValue={existingCustomer?.email ?? e?.email ?? ""} confidence={confidenceOf(e, "email", e?.email)} />
        </div>
        <Field label="Address" name="address" defaultValue={e?.address ?? ""} confidence={confidenceOf(e, "address", e?.address)} />
        <div className="grid grid-cols-3 gap-3">
          <Field label="City" name="city" defaultValue={existingCustomer?.city ?? e?.city ?? ""} confidence={confidenceOf(e, "city", e?.city)} />
          <Field label="State" name="state" defaultValue={e?.state ?? ""} confidence={confidenceOf(e, "state", e?.state)} />
          <Field label="Zip" name="zip" defaultValue={e?.zip ?? ""} confidence={confidenceOf(e, "zip", e?.zip)} />
        </div>
        <SelectField label="Preferred Contact Method" name="preferredContactMethod" options={CONTACT_METHODS} defaultValue={e?.preferredContactMethod ?? "PHONE"} />
      </div>

      <div className="card space-y-3.5 p-5">
        <h3 className="text-[12.5px] font-bold uppercase tracking-wide text-[var(--text-muted)]">Lead</h3>
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Lead Source" name="sourceId" options={sources.map((s) => ({ value: s.id, label: s.name }))} placeholder="Select source…" />
          <div>
            <SelectField
              label="Assigned Salesperson"
              name="assigneeId"
              required
              options={users.map((u) => ({ value: u.id, label: `${u.firstName} ${u.lastName}` }))}
              defaultValue={salespersonMatch?.id ?? currentUserId}
            />
            {e?.salespersonName && !salespersonMatch && (
              <p className="mt-1 text-[11px] text-amber-700">Form says &ldquo;{e.salespersonName}&rdquo; — no matching user found, defaulted to you.</p>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Temperature" name="temperature" options={TEMPERATURES} defaultValue="WARM" />
          <SelectField label="Purchase Timeframe" name="purchaseTimeframe" options={PURCHASE_TIMEFRAMES} placeholder="Select…" />
        </div>
      </div>

      <div className="card space-y-3.5 p-5">
        <h3 className="text-[12.5px] font-bold uppercase tracking-wide text-[var(--text-muted)]">Vehicle of Interest</h3>
        <SelectField label="From Inventory (optional)" name="vehicleId" options={vehicles.map((v) => ({ value: v.id, label: `${v.year} ${v.make} ${v.model} (#${v.stockNumber})` }))} placeholder="— None —" />
        <p className="text-xs text-[var(--text-muted)]">Or what the form says, if it&rsquo;s not in inventory yet:</p>
        <div className="grid grid-cols-4 gap-3">
          <Field label="Year" name="vehicleYear" type="number" defaultValue={e?.vehicleYear != null ? String(e.vehicleYear) : ""} confidence={confidenceOf(e, "vehicleYear", e?.vehicleYear)} />
          <Field label="Make" name="vehicleMake" defaultValue={e?.vehicleMake ?? ""} confidence={confidenceOf(e, "vehicleMake", e?.vehicleMake)} />
          <Field label="Model" name="vehicleModel" defaultValue={e?.vehicleModel ?? ""} confidence={confidenceOf(e, "vehicleModel", e?.vehicleModel)} />
          <Field label="Trim" name="vehicleTrim" defaultValue={e?.vehicleTrim ?? ""} confidence={confidenceOf(e, "vehicleTrim", e?.vehicleTrim)} />
        </div>
        {e?.vehicleStockNumber && (
          <p className="text-[11.5px] text-[var(--text-muted)]">Stock # on form: <span className="font-semibold text-[var(--text)]">{e.vehicleStockNumber}</span> — match it against inventory above if it&rsquo;s listed.</p>
        )}
      </div>

      <div className="card space-y-3.5 p-5">
        <h3 className="text-[12.5px] font-bold uppercase tracking-wide text-[var(--text-muted)]">Financing</h3>
        <SelectField label="Finance Type" name="financeType" options={FINANCE_TYPES} placeholder="—" defaultValue={e?.financeType ?? undefined} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Desired Monthly Payment" name="desiredPayment" type="number" defaultValue={e?.desiredPayment != null ? String(e.desiredPayment) : ""} confidence={confidenceOf(e, "desiredPayment", e?.desiredPayment)} />
          <Field label="Down Payment" name="downPayment" type="number" defaultValue={e?.downPayment != null ? String(e.downPayment) : ""} confidence={confidenceOf(e, "downPayment", e?.downPayment)} />
        </div>
      </div>

      <div className="card space-y-3.5 p-5">
        <h3 className="text-[12.5px] font-bold uppercase tracking-wide text-[var(--text-muted)]">Pick Payment / Future Payment Due</h3>
        <label className="flex items-center gap-2 text-[13px] text-[var(--text)]">
          <input type="checkbox" name="enablePickPayment" checked={pickPaymentEnabled} onChange={(ev) => setPickPaymentEnabled(ev.target.checked)} className="h-4 w-4 rounded border-[var(--border)]" />
          Enable Pick Payment for this customer
        </label>
        {pickPaymentEnabled && (
          <>
            {e && e.pickPayments.length > 0 && (
              <p className="text-xs text-[var(--text-muted)]">AI found {e.pickPayments.length} future payment{e.pickPayments.length === 1 ? "" : "s"} on the form — double-check the amounts and dates below.</p>
            )}
            <div>
              <label className="label">Initial Payment Collected Today ($)</label>
              <input name="pickPaymentInitialAmount" type="number" step="0.01" min="0" className={inputClass(confidenceOf(e, "initialPaymentToday", e?.initialPaymentToday))} placeholder="0" value={pickPaymentInitial} onChange={(ev) => setPickPaymentInitial(ev.target.value)} />
            </div>

            <div className="space-y-2">
              <label className="label">Future Payments</label>
              {paymentRows.map((row, i) => {
                const extractedRow = e?.pickPayments[i];
                const amountLow = extractedRow ? e!.lowConfidenceFields.includes("pickPayments") : false;
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-14 shrink-0 text-[12px] text-[var(--text-faint)]">#{i + 1}</span>
                    <input
                      name="pickPaymentAmount"
                      type="number"
                      step="0.01"
                      required
                      placeholder="Amount"
                      className={inputClass(amountLow ? "low" : extractedRow && extractedRow.amount == null ? "missing" : undefined)}
                      value={row.amount}
                      onChange={(ev) => setPaymentRows((r) => r.map((x, idx) => (idx === i ? { ...x, amount: ev.target.value } : x)))}
                    />
                    <input
                      name="pickPaymentDueDate"
                      type="date"
                      required
                      className={inputClass(amountLow ? "low" : extractedRow && !extractedRow.dueDate ? "missing" : undefined)}
                      value={row.dueDate}
                      onChange={(ev) => setPaymentRows((r) => r.map((x, idx) => (idx === i ? { ...x, dueDate: ev.target.value } : x)))}
                    />
                    {paymentRows.length > 1 && (
                      <button type="button" onClick={() => setPaymentRows((r) => r.filter((_, idx) => idx !== i))} className="shrink-0 rounded-lg p-1.5 text-red-500 hover:bg-red-50">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
              <button type="button" onClick={() => setPaymentRows((r) => [...r, { amount: "", dueDate: "" }])} className="btn btn-secondary btn-sm">
                <Plus size={13} /> Add Another Payment
              </button>
            </div>

            <div>
              <label className="label">Payment Status</label>
              <select name="pickPaymentStatus" defaultValue="PENDING" className="input">
                <option value="PENDING">Pending</option>
                <option value="PAID">Paid</option>
              </select>
            </div>
            <TextField label="Payment Notes (optional)" name="pickPaymentNotes" defaultValue={paymentNotesDefault} />
          </>
        )}
      </div>

      <div className="card space-y-3.5 p-5">
        <h3 className="text-[12.5px] font-bold uppercase tracking-wide text-[var(--text-muted)]">Notes</h3>
        <TextField label="Sales Notes" name="salesNotes" defaultValue={salesNotesDefault} rows={extraNotesLines.length > 0 ? 5 : 2} />
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={onRescan} className="btn btn-ghost"><RotateCcw size={14} /> Rescan</button>
        <button type="submit" disabled={pending} className="btn btn-primary flex-1 justify-center py-3.5 text-[15px]">{pending ? "Saving…" : "Confirm and Create Lead"}</button>
      </div>
    </form>
  );
}

function inputClass(confidence: Confidence): string {
  if (confidence === "low") return "input border-amber-400 bg-amber-50";
  return "input";
}

function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  if (confidence === "low") return <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">AI unsure — check</span>;
  if (confidence === "missing") return <span className="ml-1.5 text-[10px] font-normal text-[var(--text-faint)]">(not found on form)</span>;
  return null;
}

function Field({ label, name, type = "text", required, defaultValue, confidence }: { label: string; name: string; type?: string; required?: boolean; defaultValue?: string; confidence?: Confidence }) {
  return (
    <div>
      <label className="label">{label}<ConfidenceBadge confidence={confidence} /></label>
      <input name={name} type={type} required={required} defaultValue={defaultValue} className={inputClass(confidence)} />
    </div>
  );
}

function TextField({ label, name, defaultValue, rows = 2 }: { label: string; name: string; defaultValue?: string; rows?: number }) {
  return (
    <div>
      <label className="label">{label}</label>
      <textarea name={name} rows={rows} defaultValue={defaultValue} className="input" />
    </div>
  );
}

function SelectField({
  label,
  name,
  options,
  defaultValue,
  placeholder,
  required,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <select name={name} defaultValue={defaultValue ?? ""} required={required} className="input">
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
