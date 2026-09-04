// Real Web Push notifications — no native app, no third-party push service
// account required. Uses the standard Push API (service worker + VAPID)
// supported by Chrome/Edge/Firefox everywhere and Safari 16.4+ (iOS
// requires the site be added to the home screen first; that's an iOS
// platform restriction, not something this code can work around).
//
// VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are a self-generated keypair (see
// .env.example) — unlike Twilio/Resend this needs no signup or account,
// they're just this app's own identity for the push protocol. Already
// generated and set for this deployment.

import webpush from "web-push";
import { prisma } from "@/lib/prisma";

let configured = false;
function ensureConfigured() {
  if (configured) return true;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export function isPushConfigured(): boolean {
  return ensureConfigured();
}

export type PushPayload = { title: string; body: string; url?: string };

/** Sends to every device the user has subscribed on. A dead subscription
 * (browser says 404/410 — uninstalled, permissions revoked, storage
 * cleared) is pruned right away rather than retried forever. */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<{ sent: boolean; simulated: boolean; error?: string }> {
  if (!ensureConfigured()) {
    console.log(`[PUSH SIMULATED -> user ${userId}] ${payload.title}: ${payload.body}`);
    return { sent: false, simulated: true };
  }

  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subs.length === 0) {
    return { sent: false, simulated: false, error: "No push subscription on file for this user (device not enabled)." };
  }

  const body = JSON.stringify(payload);
  let anySent = false;
  let lastError: string | undefined;

  for (const sub of subs) {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, body);
      anySent = true;
    } catch (err) {
      const statusCode = (err as { statusCode?: number })?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        // Subscription is dead — the browser told us so explicitly.
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => undefined);
      } else {
        lastError = err instanceof Error ? err.message : "Unknown push error.";
      }
    }
  }

  return { sent: anySent, simulated: false, error: anySent ? undefined : lastError ?? "All subscriptions failed." };
}
