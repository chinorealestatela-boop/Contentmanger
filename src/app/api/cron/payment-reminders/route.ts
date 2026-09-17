import { NextRequest, NextResponse } from "next/server";
import { runPaymentReminderSweep } from "@/lib/payments/reminders";

// Same shared-secret pattern as src/app/api/cron/reminders/route.ts — hit
// by an external scheduler (Vercel Cron, cron-job.org, etc.) once a day to
// check every pending payment against the configured reminder stages (7d/
// 3d/1d/due/overdue) and fire whichever notifications/tasks/SMS are due.
// Safe to call more than once a day: each payment tracks which stages
// already fired, so nothing is ever sent twice.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runPaymentReminderSweep();
  return NextResponse.json({ ok: true, ...result });
}
