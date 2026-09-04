import { NextRequest, NextResponse } from "next/server";
import { syncAutoMaxInventoryWithRetry } from "@/lib/inventory/sync";

// Hit by an external scheduler (same pattern as /api/cron/reminders) to
// pull live inventory from automaxlv.com in the background throughout the
// day. Recommended cadence: every 1-4 hours for the "background sync"
// requirement, which also satisfies "at least once daily". Protected by
// the same CRON_SECRET.
//
// This route now renders every automaxlv.com page with a real headless
// Chromium (see src/lib/inventory/automaxlv.ts) instead of a plain
// fetch() — necessary because the site's vehicle data doesn't appear in
// plain-fetch HTML (see that file's header for the evidence). That's
// slower and needs the Node.js runtime (Edge can't run a browser) plus a
// much longer timeout than the previous fetch-only version needed:
//   - runtime "nodejs" is required for playwright-core/@sparticuz/chromium.
//   - maxDuration below is set to 300s (5 min), the standard-function cap
//     on Vercel Pro; Hobby caps out at 60s, which will NOT be enough to
//     render 75+ vehicle pages even with the concurrency automaxlv.ts
//     uses — if this project is on Hobby, either upgrade the plan, reduce
//     RENDER_CONCURRENCY's impact by splitting this into multiple smaller
//     cron hits (e.g. paginate vehicles across invocations with a cursor),
//     or move this specific job off Vercel to a small persistent
//     worker/VM that can run Playwright with no duration limit at all.
//   - NOT load-tested against the live site or a real Vercel deploy from
//     the sandbox this was written in (no network access to verify
//     timing). If a real run times out, that's the next thing to tune —
//     lower RENDER_CONCURRENCY if it's a memory/CPU problem, or split the
//     job if it's a wall-clock problem.
export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await syncAutoMaxInventoryWithRetry("CRON");
  return NextResponse.json(result, { status: result.status === "SUCCESS" ? 200 : 502 });
}
