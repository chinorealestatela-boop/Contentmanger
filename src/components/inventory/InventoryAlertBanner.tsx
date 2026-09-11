"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { track } from "@vercel/analytics";
import { Bell, X, CheckCircle2, Loader2 } from "lucide-react";
import { submitInventoryAlertSignup, type InventoryAlertActionState } from "@/lib/actions/inventoryAlert";
import { isValidPhone, formatPhoneInput } from "@/lib/phone";

const DISMISS_KEY = "inventoryAlertDismissedAt";
const SUBMITTED_KEY = "inventoryAlertSubmitted";
const DISMISS_SNOOZE_DAYS = 14;
const SHOW_AFTER_MS = 15000;
const SHOW_AFTER_SCROLL_PX = 500;

/** A soft, dismissible capture for the one group /inventory currently has
 * no way to reach again: anonymous browsers who look at several vehicles
 * and leave without booking or submitting the inquiry form. Appears once
 * per browser (time- or scroll-triggered, works on both mobile and
 * desktop — a true mouse-based "exit intent" doesn't fire on phones,
 * which is most of this site's traffic). Submitting creates one real
 * Lead in the CRM (see src/lib/actions/inventoryAlert.ts) — this banner
 * itself sends nothing automatically; it's just the capture point. */
export function InventoryAlertBanner({ dealershipName }: { dealershipName: string }) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const shownRef = useRef(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(SUBMITTED_KEY)) return;
      const dismissedAt = localStorage.getItem(DISMISS_KEY);
      if (dismissedAt) {
        const days = (Date.now() - Number(dismissedAt)) / 86400000;
        if (days < DISMISS_SNOOZE_DAYS) return;
      }
    } catch {
      // localStorage unavailable (private browsing etc.) — fall through and show it anyway
    }

    function show() {
      if (shownRef.current) return;
      shownRef.current = true;
      setVisible(true);
      track("inventory_alert_shown");
    }

    const timer = setTimeout(show, SHOW_AFTER_MS);
    function onScroll() {
      if (window.scrollY > SHOW_AFTER_SCROLL_PX) show();
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // ignore — worst case it can show again next visit
    }
  }

  if (!visible || dismissed) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--bg-elevated)] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(0,0,0,0.1)] sm:bottom-4 sm:left-auto sm:right-4 sm:max-w-sm sm:rounded-2xl sm:border sm:pb-4">
      <AlertForm dealershipName={dealershipName} onDismiss={dismiss} />
    </div>
  );
}

function AlertForm({ dealershipName, onDismiss }: { dealershipName: string; onDismiss: () => void }) {
  const [state, formAction, pending] = useActionState<InventoryAlertActionState, FormData>(submitInventoryAlertSignup, null);
  const [, startTransition] = useTransition();
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    if (state && "success" in state && state.success) {
      track("inventory_alert_submitted");
      try {
        localStorage.setItem(SUBMITTED_KEY, "1");
      } catch {
        // ignore
      }
    }
  }, [state]);

  if (state && "success" in state && state.success) {
    return (
      <div className="flex items-start gap-3">
        <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-[var(--success)]" />
        <div>
          <p className="text-[13.5px] font-bold text-[var(--text)]">You&rsquo;re on the list!</p>
          <p className="mt-0.5 text-[12.5px] text-[var(--text-muted)]">We&rsquo;ll reach out when something new fits what you&rsquo;re looking for.</p>
        </div>
      </div>
    );
  }

  function submit() {
    const fd = new FormData();
    if (phone) fd.set("phone", phone);
    if (email) fd.set("email", email);
    if (consent) fd.set("commConsent", "on");
    startTransition(() => formAction(fd));
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Bell size={16} className="text-[var(--brand)]" />
          <p className="text-[13.5px] font-bold text-[var(--text)]">Don&rsquo;t see the right fit yet?</p>
        </div>
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="rounded-lg p-1 text-[var(--text-faint)] hover:bg-[var(--bg-subtle)]">
          <X size={16} />
        </button>
      </div>
      <p className="mt-1 text-[12px] text-[var(--text-muted)]">Leave your number and we&rsquo;ll text you when new inventory that matches shows up.</p>

      {state && "error" in state && state.error && (
        <p className="mt-2 text-[11.5px] text-red-600">{state.error}</p>
      )}

      <div className="mt-3 space-y-2">
        <input
          type="tel"
          inputMode="tel"
          className="input py-2 text-[13px]"
          placeholder="(702) 555-0123"
          value={phone}
          onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
          autoComplete="tel"
        />
        <input
          type="email"
          className="input py-2 text-[13px]"
          placeholder="Email (optional)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
        <label className="flex items-start gap-2 text-[10.5px] leading-snug text-[var(--text-faint)]">
          <input type="checkbox" className="mt-0.5" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>
            I agree to be contacted by {dealershipName} by text/email. Msg &amp; data rates may apply.{" "}
            <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="underline">Privacy &amp; SMS Terms</Link>.
          </span>
        </label>
        <button
          type="button"
          onClick={submit}
          disabled={pending || !isValidPhone(phone) || !consent}
          className="btn btn-primary w-full justify-center py-2 text-[13px]"
        >
          {pending ? <Loader2 size={14} className="animate-spin" /> : null}
          {pending ? "Signing up…" : "Notify Me"}
        </button>
      </div>
    </div>
  );
}
