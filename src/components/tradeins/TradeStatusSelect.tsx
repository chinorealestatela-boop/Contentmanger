"use client";

import { useTransition } from "react";
import { updateTradeInStatus } from "@/lib/actions/tradeins";
import { APPRAISAL_STATUSES, optionColor } from "@/lib/constants";

export function TradeStatusSelect({ tradeInId, customerId, status }: { tradeInId: string; customerId: string; status: string }) {
  const [pending, startTransition] = useTransition();
  const color = optionColor(APPRAISAL_STATUSES, status);
  return (
    <select
      defaultValue={status}
      disabled={pending}
      onChange={(e) => startTransition(() => updateTradeInStatus(tradeInId, customerId, e.target.value))}
      className="badge cursor-pointer border-0"
      style={{ background: `${color}1a`, color }}
    >
      {APPRAISAL_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
    </select>
  );
}
