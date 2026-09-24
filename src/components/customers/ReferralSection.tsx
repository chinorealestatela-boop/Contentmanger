"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { UserPlus, Trash2, Gift } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency } from "@/lib/format";
import { linkReferral, removeReferral, updateReferralStatus, setReferralEligibility } from "@/lib/actions/referrals";
import { summarizeReferrals } from "@/lib/referrals";

type ReferralRow = {
  id: string;
  rewardAmount: number;
  status: string;
  referredCustomer: { id: string; firstName: string; lastName: string };
};

type ReferrerInfo = { id: string; firstName: string; lastName: string };
type CustomerOption = { id: string; firstName: string; lastName: string };

function statusVariant(status: string) {
  return status === "PAID" ? "sold" : status === "INELIGIBLE" ? "lost" : "warm";
}

/** Referral-program section for the customer profile (Feature 6/7) —
 * additive, sits alongside the existing profile sections. "Referred by"
 * links to whoever sent this customer in; "Referrals made" lists everyone
 * this customer has referred, with per-referral reward status a person
 * sets explicitly (nothing here ever auto-marks a reward Paid). */
export function ReferralSection({
  customer,
  referredBy,
  referralsMade,
  otherCustomers,
}: {
  customer: { id: string; firstName: string; lastName: string; referralEligible: boolean };
  referredBy: ReferrerInfo | null;
  referralsMade: ReferralRow[];
  otherCustomers: CustomerOption[];
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [eligiblePending, startEligible] = useTransition();
  const summary = summarizeReferrals(referralsMade);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 text-[13px]">
        <div>
          <span className="text-[var(--text-faint)]">Referred by:</span>{" "}
          {referredBy ? (
            <Link href={`/customers/${referredBy.id}`} className="font-semibold text-[var(--brand)] hover:underline">
              {referredBy.firstName} {referredBy.lastName}
            </Link>
          ) : (
            <span className="text-[var(--text-muted)]">No one on file</span>
          )}
        </div>
        <label className="flex items-center gap-1.5 text-[12px] text-[var(--text-muted)]">
          <input
            type="checkbox"
            defaultChecked={customer.referralEligible}
            disabled={eligiblePending}
            onChange={(e) => startEligible(() => setReferralEligibility(customer.id, e.target.checked))}
            className="h-3.5 w-3.5 accent-[var(--brand)]"
          />
          Referral-program eligible
        </label>
      </div>

      <div className="grid grid-cols-3 gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] p-3 text-center">
        <div>
          <p className="text-[17px] font-bold text-[var(--text)]">{summary.count}</p>
          <p className="text-[10.5px] font-medium text-[var(--text-faint)]">Referrals</p>
        </div>
        <div>
          <p className="text-[17px] font-bold text-[var(--text)]">{formatCurrency(summary.totalReward)}</p>
          <p className="text-[10.5px] font-medium text-[var(--text-faint)]">Total Reward</p>
        </div>
        <div>
          <p className="text-[17px] font-bold text-emerald-600">{formatCurrency(summary.paidReward)}</p>
          <p className="text-[10.5px] font-medium text-[var(--text-faint)]">Paid Out</p>
        </div>
      </div>

      {referralsMade.length > 0 && (
        <ul className="space-y-2">
          {referralsMade.map((r) => (
            <ReferralRowItem key={r.id} referral={r} />
          ))}
        </ul>
      )}

      <button type="button" onClick={() => setAddOpen(true)} className="btn btn-secondary btn-sm">
        <UserPlus size={13} /> Add Referral
      </button>

      {addOpen && <AddReferralModal referrerId={customer.id} otherCustomers={otherCustomers} onClose={() => setAddOpen(false)} />}
    </div>
  );
}

function ReferralRowItem({ referral }: { referral: ReferralRow }) {
  const [pending, startTransition] = useTransition();
  const [removing, startRemove] = useTransition();

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-3.5 py-2.5">
      <div className="min-w-0">
        <Link href={`/customers/${referral.referredCustomer.id}`} className="text-[13px] font-semibold text-[var(--text)] hover:text-[var(--brand)]">
          {referral.referredCustomer.firstName} {referral.referredCustomer.lastName}
        </Link>
        <p className="text-[11.5px] text-[var(--text-muted)]">{formatCurrency(referral.rewardAmount)} reward</p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <select
          defaultValue={referral.status}
          disabled={pending}
          onChange={(e) => startTransition(() => updateReferralStatus(referral.id, e.target.value as "PENDING" | "PAID" | "INELIGIBLE"))}
          className="badge cursor-pointer border-0"
        >
          <option value="PENDING">Pending</option>
          <option value="PAID">Paid</option>
          <option value="INELIGIBLE">Ineligible</option>
        </select>
        <Badge variant={statusVariant(referral.status) as never}>{referral.status === "PAID" ? "Paid" : referral.status === "INELIGIBLE" ? "Ineligible" : "Pending"}</Badge>
        <button
          type="button"
          disabled={removing}
          title="Remove"
          onClick={() => {
            if (confirm("Remove this referral link?")) startRemove(() => removeReferral(referral.id));
          }}
          className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </li>
  );
}

function AddReferralModal({ referrerId, otherCustomers, onClose }: { referrerId: string; otherCustomers: CustomerOption[]; onClose: () => void }) {
  const [state, formAction, pending] = useActionState(linkReferral, null);
  useEffect(() => {
    if (state?.success) onClose();
  }, [state, onClose]);

  return (
    <Modal title="Add Referral" onClose={onClose}>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="referrerId" value={referrerId} />
        {state?.error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
        <div className="flex items-start gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] p-3 text-[12.5px] text-[var(--text-muted)]">
          <Gift size={15} className="mt-0.5 shrink-0 text-[var(--brand)]" />
          Pick the customer this person referred to the dealership — the $200 referral reward tracks against this link.
        </div>
        <div>
          <label className="label">Customer Referred</label>
          <select name="referredCustomerId" required className="input" autoFocus>
            <option value="">Select customer…</option>
            {otherCustomers.map((c) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
          </select>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button type="submit" disabled={pending} className="btn btn-primary">{pending ? "Saving…" : "Add Referral"}</button>
        </div>
      </form>
    </Modal>
  );
}
