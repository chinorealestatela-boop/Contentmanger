// Shared helpers for the FollowUp feature: computing the reminder
// timestamp, and the "aging" sweep that keeps status accurate over time
// without a background scheduler (same pattern as the automation engine's
// time-based checks — see src/lib/automation/engine.ts).
import { prisma } from "@/lib/prisma";

/** Combines a follow-up's date + "HH:mm" time into a single Date. */
export function followUpDateTime(followUpDate: Date, followUpTime: string) {
  const d = new Date(followUpDate);
  const [h, m] = followUpTime.split(":").map(Number);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

/** When reminderOffsetMinutes is set, the moment the reminder should fire. */
export function reminderAt(followUpDate: Date, followUpTime: string, reminderOffsetMinutes: number | null) {
  if (reminderOffsetMinutes === null) return null;
  const at = followUpDateTime(followUpDate, followUpTime);
  at.setMinutes(at.getMinutes() - reminderOffsetMinutes);
  return at;
}

/** No background job runner in this app (v1, zero external services) — so
 * this sweep is invoked opportunistically wherever follow-ups are read
 * (dashboard, calendar, customer profile). It's cheap and idempotent:
 * - Flips SCHEDULED follow-ups whose time has passed to MISSED.
 * - Fires an in-app reminder Notification once per follow-up, exactly
 *   when its reminder time arrives.
 */
export async function syncFollowUps() {
  const now = new Date();

  const scheduled = await prisma.followUp.findMany({
    where: { status: "SCHEDULED" },
    include: { customer: { select: { firstName: true, lastName: true } } },
  });

  const missedIds: string[] = [];
  const toRemind: typeof scheduled = [];

  for (const f of scheduled) {
    const due = followUpDateTime(f.followUpDate, f.followUpTime);
    if (due < now) {
      missedIds.push(f.id);
      continue; // don't also remind for something we're marking missed
    }
    if (f.reminderOffsetMinutes !== null && !f.reminderSentAt) {
      const fireAt = reminderAt(f.followUpDate, f.followUpTime, f.reminderOffsetMinutes);
      if (fireAt && fireAt <= now) toRemind.push(f);
    }
  }

  if (missedIds.length > 0) {
    await prisma.followUp.updateMany({ where: { id: { in: missedIds } }, data: { status: "MISSED" } });
  }

  for (const f of toRemind) {
    await prisma.notification.create({
      data: {
        userId: f.assigneeId,
        type: "FOLLOW_UP_REMINDER",
        title: "Follow-up reminder",
        body: `${f.customer.firstName} ${f.customer.lastName} — ${f.topic}`,
        link: `/customers/${f.customerId}`,
      },
    });
    await prisma.followUp.update({ where: { id: f.id }, data: { reminderSentAt: now } });
  }

  return { missed: missedIds.length, reminded: toRemind.length };
}
