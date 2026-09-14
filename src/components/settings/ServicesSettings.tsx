"use client";

import { useActionState, useRef, useEffect, useTransition, useState } from "react";
import { createService, toggleService, updateServiceRate } from "@/lib/actions/settings";
import { formatCurrency } from "@/lib/format";
import { ErrorBox } from "@/components/ui/Form";
import { cn } from "@/lib/utils";

type Service = { id: string; name: string; baseRate: number | null; active: boolean };

export function ServicesSettings({ services }: { services: Service[] }) {
  const [state, formAction, pending] = useActionState(createService, null);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <div className="space-y-3">
      {services.map((s) => (
        <ServiceRow key={s.id} service={s} />
      ))}
      <form ref={formRef} action={formAction} className="card flex flex-wrap items-center gap-2 p-3">
        <input name="name" required placeholder="New service name" className="input flex-1" />
        <input name="baseRate" type="number" placeholder="Base rate" className="input w-32" />
        <button type="submit" disabled={pending} className="btn btn-primary btn-sm">{pending ? "Adding…" : "Add Service"}</button>
        {state?.error && <div className="w-full"><ErrorBox>{state.error}</ErrorBox></div>}
      </form>
    </div>
  );
}

function ServiceRow({ service }: { service: Service }) {
  const [rate, setRate] = useState(String(service.baseRate ?? ""));
  const [pending, startTransition] = useTransition();
  const [togglePending, startToggle] = useTransition();

  return (
    <div className="card flex items-center gap-3 p-3.5">
      <span className={cn("h-2 w-2 shrink-0 rounded-full", service.active ? "bg-[var(--success)]" : "bg-white/20")} />
      <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--text)]">{service.name}</p>
      <input
        type="number"
        value={rate}
        onChange={(e) => setRate(e.target.value)}
        onBlur={() => startTransition(() => updateServiceRate(service.id, Number(rate) || 0))}
        className="input w-28 !py-1.5 text-[12.5px]"
      />
      <span className="w-20 shrink-0 text-right text-[11px] text-[var(--text-faint)]">{pending ? "Saving…" : formatCurrency(service.baseRate)}</span>
      <button
        disabled={togglePending}
        onClick={() => startToggle(() => toggleService(service.id, !service.active))}
        className="btn btn-secondary btn-sm"
      >
        {service.active ? "Deactivate" : "Activate"}
      </button>
    </div>
  );
}
