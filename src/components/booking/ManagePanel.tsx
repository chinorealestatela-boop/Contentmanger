"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, CalendarCheck, XCircle, Phone } from "lucide-react";
import { rescheduleBookingAppointment, cancelBookingAppointment, fetchAvailableSlots, type ManageActionState } from "@/lib/actions/booking";
import { formatDate, formatTime12h } from "@/lib/format";
import { WHAT_TO_BRING } from "@/lib/messaging/templates";
import { cn } from "@/lib/utils";

export type ManageAppointment = {
  manageToken: string;
  confirmationCode: string;
  status: string;
  date: string; // ISO
  time: string;
  location: string | null;
  vehicleLabel: string;
  customerFirstName: string;
  agentName: string;
  agentPhone: string;
};

export function ManagePanel({ appt }: { appt: ManageAppointment }) {
  const [mode, setMode] = useState<"view" | "reschedule" | "cancel">("view");

  if (appt.status === "CANCELLED") {
    return (
      <Panel>
        <XCircle size={28} className="mx-auto text-[var(--text-faint)]" />
        <h1 className="mt-3 text-xl font-bold text-[var(--text)]">This appointment was cancelled</h1>
        <p className="mt-2 text-[13.5px] text-[var(--text-muted)]">Whenever you&rsquo;re ready, book a new time.</p>
        <Link href="/book" className="btn btn-primary mt-5">Book a Test Drive</Link>
      </Panel>
    );
  }

  return (
    <Panel>
      <p className="text-[12.5px] font-semibold uppercase tracking-wide text-[var(--brand)]">Confirmation #{appt.confirmationCode}</p>
      <h1 className="mt-1 text-xl font-bold text-[var(--text)]">Hey {appt.customerFirstName}, here&rsquo;s your test drive</h1>

      <div className="mt-4 space-y-2 rounded-xl border border-[var(--border)] p-4 text-left text-[13.5px]">
        <Row label="Vehicle" value={appt.vehicleLabel} />
        <Row label="Date" value={formatDate(new Date(appt.date), "EEEE, MMM d, yyyy")} />
        <Row label="Time" value={formatTime12h(appt.time)} />
        {appt.location && <Row label="Location" value={appt.location} />}
        <Row label="With" value={appt.agentName} />
      </div>

      {mode === "view" && (
        <div className="mt-4 rounded-xl border border-[var(--brand)]/30 bg-[var(--brand-soft)] p-4 text-left">
          <p className="text-[13px] font-bold text-[var(--text)]">What to Bring</p>
          <ul className="mt-2 space-y-1.5 text-[12.5px] text-[var(--text)]">
            {WHAT_TO_BRING.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-0.5 text-[var(--brand)]">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {mode === "view" && (
        <p className="mt-4 text-[13px] font-semibold text-[var(--text)]">
          When you arrive, please let the staff know you&rsquo;re here for your test drive with {appt.agentName}.
        </p>
      )}

      {mode === "view" && (
        <div className="mt-5 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
          <a href={`/api/appointments/${appt.manageToken}/ics`} className="btn btn-secondary py-2.5"><CalendarCheck size={15} /> Add to Calendar</a>
          <button onClick={() => setMode("reschedule")} className="btn btn-secondary py-2.5">Reschedule</button>
          <button onClick={() => setMode("cancel")} className="btn btn-danger py-2.5">Cancel</button>
        </div>
      )}

      {mode === "reschedule" && <ReschedulePanel token={appt.manageToken} onDone={() => setMode("view")} onBack={() => setMode("view")} />}
      {mode === "cancel" && <CancelPanel token={appt.manageToken} onBack={() => setMode("view")} />}

      <p className="mt-6 flex items-center justify-center gap-1.5 text-[12px] text-[var(--text-faint)]">
        <Phone size={12} /> Need help? Call {appt.agentPhone}
      </p>
    </Panel>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-10 text-center sm:px-6">
      <div className="card p-6">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] py-1.5 last:border-0">
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className="text-right font-semibold text-[var(--text)]">{value}</span>
    </div>
  );
}

function toDateInputValue(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function ReschedulePanel({ token, onDone, onBack }: { token: string; onDone: () => void; onBack: () => void }) {
  const [state, formAction, pending] = useActionState<ManageActionState, FormData>(rescheduleBookingAppointment, null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [slots, setSlots] = useState<string[] | null>(null);
  const [loadingSlots, startTransition] = useTransition();
  const todayStr = useMemo(() => toDateInputValue(new Date()), []);

  useEffect(() => {
    if (!date) return;
    startTransition(async () => {
      setSlots(null);
      setTime("");
      setSlots(await fetchAvailableSlots(date));
    });
  }, [date]);

  const router = useRouter();
  useEffect(() => {
    if (state && "success" in state && state.success) {
      router.refresh();
      onDone();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="mt-5 space-y-3 text-left">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="time" value={time} />

      {state && "error" in state && state.error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</div>}

      <div>
        <label className="label">New date</label>
        <input type="date" className="input" min={todayStr} value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      {date && (
        <div>
          <label className="label">Available times</label>
          {loadingSlots && <div className="flex items-center gap-2 py-3 text-[13px] text-[var(--text-muted)]"><Loader2 size={14} className="animate-spin" /> Checking…</div>}
          {!loadingSlots && slots?.length === 0 && <p className="text-[13px] text-[var(--text-faint)]">No openings — try another date.</p>}
          {!loadingSlots && slots && slots.length > 0 && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {slots.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTime(t)}
                  className={cn("rounded-lg border px-2 py-2 text-[12.5px] font-semibold", time === t ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--border)] text-[var(--text)]")}
                >
                  {formatTime12h(t)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="flex gap-2 pt-2">
        <button type="button" onClick={onBack} className="btn btn-secondary flex-1">Back</button>
        <button type="submit" disabled={!date || !time || pending} className="btn btn-primary flex-1">{pending ? "Saving…" : "Confirm New Time"}</button>
      </div>
    </form>
  );
}

function CancelPanel({ token, onBack }: { token: string; onBack: () => void }) {
  const [state, formAction, pending] = useActionState<ManageActionState, FormData>(cancelBookingAppointment, null);
  const router = useRouter();
  useEffect(() => {
    if (state && "success" in state && state.success) router.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="mt-5 space-y-3">
      <input type="hidden" name="token" value={token} />
      {state && "error" in state && state.error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</div>}
      <p className="text-[13.5px] text-[var(--text-muted)]">Are you sure you want to cancel this test drive?</p>
      <div className="flex gap-2">
        <button type="button" onClick={onBack} className="btn btn-secondary flex-1">Keep It</button>
        <button type="submit" disabled={pending} className="btn btn-danger flex-1">{pending ? "Cancelling…" : "Yes, Cancel"}</button>
      </div>
    </form>
  );
}
