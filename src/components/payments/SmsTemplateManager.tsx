"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { createSmsTemplate, updateSmsTemplate, deleteSmsTemplate, toggleSmsTemplateActive } from "@/lib/actions/smsTemplates";
import { renderTemplate } from "@/lib/payments/templates";
import { PAYMENT_REMINDER_STAGES } from "@/lib/payments/status";

type Template = { id: string; name: string; trigger: string | null; body: string; active: boolean; isDefault: boolean };

const SAMPLE_VARS = { firstName: "John", amount: "$500", dueDate: "October 17", agentName: "Chino", dealershipName: "AutoMax LV" };

const TRIGGER_LABEL: Record<string, string> = Object.fromEntries(PAYMENT_REMINDER_STAGES.map((s) => [s.value, s.label]));

export function SmsTemplateManager({ templates }: { templates: Template[] }) {
  const [modal, setModal] = useState<"NEW" | Template | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[12.5px] text-[var(--text-muted)]">Edit the wording, add more templates per stage, or turn one off without deleting it.</p>
        <button onClick={() => setModal("NEW")} className="btn btn-secondary btn-sm"><Plus size={13} /> New Template</button>
      </div>
      <ul className="space-y-2">
        {templates.map((t) => (
          <li key={t.id} className="rounded-lg border border-[var(--border)] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-[var(--text)]">{t.name}</span>
                {t.trigger && <Badge variant="neutral">{TRIGGER_LABEL[t.trigger] ?? t.trigger}</Badge>}
                {!t.active && <Badge variant="lost">Off</Badge>}
              </div>
              <div className="flex items-center gap-1">
                <label className="mr-2 flex items-center gap-1.5 text-[11.5px] text-[var(--text-muted)]">
                  <input type="checkbox" defaultChecked={t.active} onChange={(e) => toggleSmsTemplateActive(t.id, e.target.checked)} className="h-3.5 w-3.5 accent-[var(--brand)]" />
                  Active
                </label>
                <button onClick={() => setModal(t)} title="Edit" className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]"><Pencil size={13} /></button>
                {!t.isDefault && (
                  <button
                    onClick={() => {
                      if (confirm(`Delete "${t.name}"?`)) deleteSmsTemplate(t.id);
                    }}
                    title="Delete"
                    className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
            <p className="mt-2 text-[12.5px] italic text-[var(--text-muted)]">&ldquo;{renderTemplate(t.body, SAMPLE_VARS)}&rdquo;</p>
          </li>
        ))}
      </ul>

      {modal === "NEW" && <TemplateModal onClose={() => setModal(null)} />}
      {modal && modal !== "NEW" && <TemplateModal template={modal} onClose={() => setModal(null)} />}
    </div>
  );
}

function TemplateModal({ template, onClose }: { template?: Template; onClose: () => void }) {
  const action = template ? updateSmsTemplate : createSmsTemplate;
  const [state, formAction, pending] = useActionState(action, null);
  const [body, setBody] = useState(template?.body ?? "");
  useEffect(() => {
    if (state?.success) onClose();
  }, [state, onClose]);

  return (
    <Modal title={template ? "Edit Template" : "New SMS Template"} onClose={onClose} width="max-w-lg">
      <form action={formAction} className="space-y-4">
        {template && <input type="hidden" name="templateId" value={template.id} />}
        {state?.error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
        <div>
          <label className="label">Name</label>
          <input name="name" required defaultValue={template?.name} className="input" autoFocus />
        </div>
        <div>
          <label className="label">Used For</label>
          <select name="trigger" defaultValue={template?.trigger ?? "NONE"} className="input">
            <option value="NONE">Manual only (not auto-sent)</option>
            {PAYMENT_REMINDER_STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Message</label>
          <textarea name="body" required rows={4} className="input" value={body} onChange={(e) => setBody(e.target.value)} />
          <p className="mt-1 text-[11px] text-[var(--text-faint)]">Variables: {"{{firstName}} {{amount}} {{dueDate}} {{agentName}} {{dealershipName}}"}</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] p-3">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">Preview</p>
          <p className="text-[13px] italic text-[var(--text)]">&ldquo;{renderTemplate(body || "…", SAMPLE_VARS)}&rdquo;</p>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button type="submit" disabled={pending} className="btn btn-primary">{pending ? "Saving…" : "Save Template"}</button>
        </div>
      </form>
    </Modal>
  );
}
