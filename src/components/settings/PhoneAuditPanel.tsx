"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Search, AlertTriangle, CheckCircle2, HelpCircle } from "lucide-react";
import { runPhoneAudit, type PhoneAuditResult } from "@/lib/actions/phoneAudit";

export function PhoneAuditPanel() {
  const [result, setResult] = useState<PhoneAuditResult | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[13px] text-[var(--text-muted)]">
          Scans every customer&rsquo;s saved phone number. Numbers that are just inconsistently formatted get fixed automatically — no data is
          guessed. Numbers matching the actual bug (a duplicated leading 1 with the true last digit already lost) can&rsquo;t be safely reconstructed,
          so they&rsquo;re listed instead for you to re-contact that customer directly.
        </p>
        <button
          disabled={pending}
          onClick={() => startTransition(async () => setResult(await runPhoneAudit()))}
          className="btn btn-primary mt-3"
        >
          <Search size={14} /> {pending ? "Scanning…" : "Scan & Fix Phone Numbers"}
        </button>
      </div>

      {result && "error" in result && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{result.error}</p>
      )}

      {result && !("error" in result) && (
        <div className="space-y-4">
          <p className="text-[12.5px] text-[var(--text-muted)]">
            Scanned {result.scanned} customer{result.scanned === 1 ? "" : "s"} with a phone number on file.
          </p>

          <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
            <span>
              <strong>{result.fixed.length}</strong> reformatted automatically — same number, just standardized (no digits changed).
            </span>
          </div>

          {result.fixed.length > 0 && (
            <ul className="space-y-1 pl-1 text-[12px] text-[var(--text-faint)]">
              {result.fixed.map((f) => (
                <li key={f.id}>
                  <Link href={`/customers/${f.id}`} className="text-[var(--brand)] hover:underline">{f.name}</Link>: {f.before} → {f.after}
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>
              <strong>{result.corrupted.length}</strong> hit the actual bug — the true last digit is gone and can&rsquo;t be recovered. Where shown
              below, the other 9 digits <em>are</em> recoverable (the area code and first 6 digits) — just confirm the last digit with the
              customer, then update it from their profile&rsquo;s Edit screen.
            </span>
          </div>

          {result.corrupted.length > 0 && (
            <ul className="space-y-1 pl-1 text-[12px]">
              {result.corrupted.map((c) => (
                <li key={c.id}>
                  <Link href={`/customers/${c.id}`} className="text-[var(--brand)] hover:underline">{c.name}</Link>{" "}
                  <span className="text-[var(--text-faint)]">— currently saved as {c.before}</span>
                  {c.recovered && (
                    <span className="text-[var(--text-faint)]">
                      {" "}— likely <strong className="text-[var(--text)]">{c.recovered}</strong> (confirm the last digit)
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}

          {result.unparseable.length > 0 && (
            <>
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
                <HelpCircle size={16} className="mt-0.5 shrink-0" />
                <span>
                  <strong>{result.unparseable.length}</strong> don&rsquo;t look like a standard 10-digit US number at all (could be a foreign number,
                  an extension, or unrelated bad data) — left alone, worth a manual look.
                </span>
              </div>
              <ul className="space-y-1 pl-1 text-[12px]">
                {result.unparseable.map((u) => (
                  <li key={u.id}>
                    <Link href={`/customers/${u.id}`} className="text-[var(--brand)] hover:underline">{u.name}</Link>{" "}
                    <span className="text-[var(--text-faint)]">— currently saved as &ldquo;{u.before}&rdquo;</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
