import { NextResponse } from "next/server";
import { pollOnce } from "@/lib/poller";

/**
 * POST /api/poll
 *
 * Manually triggers the ESPN poller — useful in local dev where the
 * Cloudflare Cron Trigger doesn't fire automatically.
 */
export async function POST() {
  try {
    const result = await pollOnce();
    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/poll] Error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
