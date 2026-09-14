"use client";

import { useTransition } from "react";
import { setCustomerTier } from "@/lib/actions/customers";
import { CUSTOMER_TIERS } from "@/lib/constants";

export function TierControl({ customerId, tier }: { customerId: string; tier: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <select
      className="input !w-auto !py-1.5 text-[12.5px] font-semibold"
      value={tier}
      disabled={pending}
      onChange={(e) => startTransition(() => setCustomerTier(customerId, e.target.value))}
    >
      {CUSTOMER_TIERS.map((t) => (
        <option key={t.value} value={t.value}>{t.label}</option>
      ))}
    </select>
  );
}
