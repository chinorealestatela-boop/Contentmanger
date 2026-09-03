import { NextRequest, NextResponse } from "next/server";
import { sendPendingReminders } from "@/lib/actions/reminders";

// Hit by an external scheduler (Vercel Cron, cron-job.org, a GitHub Actions
// schedule, etc.) every ~15 minutes in production to fire 24h/2h test-drive
// reminders. Protected by a shared secret so it can't be triggered by
// anyone who finds the URL. See CRON_SECRET in .env and the note at the
// top of src/lib/actions/reminders.ts.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost:3000";
  const proto = req.headers.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const result = await sendPendingReminders(`${proto}://${host}`);

  return NextResponse.json({ ok: true, ...result });
}
