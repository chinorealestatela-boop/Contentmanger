import { NextRequest, NextResponse } from "next/server";
import { syncAutoMaxInventoryWithRetry } from "@/lib/inventory/sync";

// Hit by an external scheduler (same pattern as /api/cron/reminders) to
// pull live inventory from automaxlv.com in the background throughout the
// day. Recommended cadence: every 1-4 hours for the "background sync"
// requirement, which also satisfies "at least once daily". Protected by
// the same CRON_SECRET.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await syncAutoMaxInventoryWithRetry("CRON");
  return NextResponse.json(result, { status: result.status === "SUCCESS" ? 200 : 502 });
}
