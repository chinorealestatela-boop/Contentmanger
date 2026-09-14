// Shared form building blocks — used across every intake/edit form in the
// app (leads, bookings, quotes, vehicles, drivers, settings) so forms stay
// visually consistent without re-declaring the same primitives everywhere.

export function FormSection({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card space-y-3.5 p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-[12.5px] font-bold uppercase tracking-wide text-[var(--text-muted)]">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

export function Field({
  label,
  name,
  type = "text",
  required,
  defaultValue,
  placeholder,
  step,
  min,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string | number;
  placeholder?: string;
  step?: string;
  min?: string | number;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input name={name} type={type} required={required} defaultValue={defaultValue} placeholder={placeholder} step={step} min={min} className="input" />
    </div>
  );
}

export function TextField({ label, name, rows = 2, defaultValue, placeholder }: { label: string; name: string; rows?: number; defaultValue?: string; placeholder?: string }) {
  return (
    <div>
      <label className="label">{label}</label>
      <textarea name={name} rows={rows} defaultValue={defaultValue} placeholder={placeholder} className="input" />
    </div>
  );
}

export function SelectField({
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
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function CheckboxField({ label, name, defaultChecked }: { label: string; name: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-[13px] text-[var(--text)]">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="h-4 w-4 rounded border-[var(--border)] bg-transparent accent-[var(--brand)]" /> {label}
    </label>
  );
}

export function ErrorBox({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-[var(--danger)]/40 bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">{children}</div>;
}

export function SuccessBox({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-[var(--success)]/40 bg-[var(--success-soft)] px-3 py-2 text-sm text-[var(--success)]">{children}</div>;
}
