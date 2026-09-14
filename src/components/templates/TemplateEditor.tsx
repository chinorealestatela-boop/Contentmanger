"use client";

import { useActionState, useState, useTransition } from "react";
import { updateMessageTemplate, toggleMessageTemplate } from "@/lib/actions/templates";
import { ErrorBox, SuccessBox } from "@/components/ui/Form";
import { cn } from "@/lib/utils";

type Template = { key: string; name: string; channel: string; subject: string | null; body: string; active: boolean };

export function TemplateEditor({ template }: { template: Template }) {
  const [state, formAction, pending] = useActionState(updateMessageTemplate, null);
  const [togglePending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-3">
        <button onClick={() => setOpen((o) => !o)} className="min-w-0 flex-1 text-left">
          <p className="text-[13.5px] font-semibold text-[var(--text)]">{template.name}</p>
          <p className="text-[11px] text-[var(--text-faint)]">{template.channel} · {template.key}</p>
        </button>
        <button
          disabled={togglePending}
          onClick={() => startTransition(() => toggleMessageTemplate(template.key, !template.active))}
          className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", template.active ? "bg-[var(--success)]" : "bg-white/10")}
          aria-label={template.active ? "Deactivate template" : "Activate template"}
        >
          <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", template.active ? "translate-x-5" : "translate-x-0.5")} />
        </button>
      </div>

      {open && (
        <form action={formAction} className="mt-4 space-y-3 border-t border-[var(--border)] pt-4">
          <input type="hidden" name="key" value={template.key} />
          {state?.error && <ErrorBox>{state.error}</ErrorBox>}
          {state?.success && <SuccessBox>{state.success}</SuccessBox>}
          {template.channel === "EMAIL" && (
            <div>
              <label className="label">Subject</label>
              <input name="subject" defaultValue={template.subject ?? ""} className="input" />
            </div>
          )}
          <div>
            <label className="label">Message Body</label>
            <textarea name="body" defaultValue={template.body} rows={4} className="input" />
            <p className="mt-1 text-[11px] text-[var(--text-faint)]">Use tokens like {"{{driverName}}"}, {"{{vehicleName}}"}, {"{{pickupTime}}"}, {"{{pickupLocation}}"}.</p>
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={pending} className="btn btn-primary btn-sm">{pending ? "Saving…" : "Save Template"}</button>
          </div>
        </form>
      )}
    </div>
  );
}
