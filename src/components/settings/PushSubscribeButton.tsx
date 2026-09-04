"use client";

import { useEffect, useState, useTransition } from "react";
import { BellRing, BellOff, Loader2 } from "lucide-react";
import { getPushPublicKey, savePushSubscription, removePushSubscription } from "@/lib/actions/push";

// PushManager.subscribe wants an ArrayBuffer-backed BufferSource — plain
// Uint8Array.from() (no explicit ArrayBuffer) can type as backed by
// SharedArrayBuffer under recent TS lib.dom typings, which subscribe()'s
// type doesn't accept even though every real browser is fine with it.
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

type Status = "checking" | "unsupported" | "not-configured" | "denied" | "off" | "on" | "working";

// Real Web Push subscribe/unsubscribe for THIS device — see
// src/lib/push/webpush.ts for the server side. Each device a user enables
// this on gets its own PushSubscription row, so "enable on this device"
// really does mean this device (phone, laptop, etc. all separately).
export function PushSubscribeButton() {
  const [status, setStatus] = useState<Status>("checking");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setStatus("unsupported");
        return;
      }
      const publicKey = await getPushPublicKey();
      if (!publicKey) {
        setStatus("not-configured");
        return;
      }
      if (Notification.permission === "denied") {
        setStatus("denied");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js").catch(() => null);
      const existing = await reg?.pushManager.getSubscription();
      setStatus(existing ? "on" : "off");
    })();
  }, []);

  function enable() {
    setStatus("working");
    startTransition(async () => {
      try {
        const publicKey = await getPushPublicKey();
        if (!publicKey) {
          setStatus("not-configured");
          return;
        }
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setStatus(permission === "denied" ? "denied" : "off");
          return;
        }
        const reg = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
        const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
        await savePushSubscription({ endpoint: json.endpoint, keys: json.keys }, navigator.userAgent);
        setStatus("on");
      } catch {
        setStatus("off");
      }
    });
  }

  function disable() {
    setStatus("working");
    startTransition(async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration("/sw.js");
        const sub = await reg?.pushManager.getSubscription();
        if (sub) {
          await removePushSubscription(sub.endpoint);
          await sub.unsubscribe();
        }
      } finally {
        setStatus("off");
      }
    });
  }

  if (status === "checking") return null;

  if (status === "unsupported") {
    return <p className="text-[12.5px] text-[var(--text-faint)]">Push notifications aren&rsquo;t supported in this browser. On iPhone, add this site to your Home Screen first (Share → Add to Home Screen), then open it from there.</p>;
  }
  if (status === "not-configured") {
    return <p className="text-[12.5px] text-[var(--text-faint)]">Push isn&rsquo;t configured on the server yet (missing VAPID keys).</p>;
  }
  if (status === "denied") {
    return <p className="text-[12.5px] text-[var(--danger)]">Notifications are blocked for this site in your browser settings. Enable them there, then reload this page.</p>;
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={status === "on" ? disable : enable}
      className={status === "on" ? "btn btn-secondary" : "btn btn-primary"}
    >
      {status === "working" ? <Loader2 size={14} className="animate-spin" /> : status === "on" ? <BellRing size={14} /> : <BellOff size={14} />}
      {status === "on" ? "Push enabled on this device — tap to disable" : "Enable push notifications on this device"}
    </button>
  );
}
