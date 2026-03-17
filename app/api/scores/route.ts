import { type NextRequest, NextResponse } from "next/server";
import { listGames } from "@/lib/db";

/**
 * GET /api/scores
 *
 * Returns tournament games stored in D1 (populated by the Cron Trigger poller).
 * Does NOT call ESPN directly — keeps the response fast and avoids rate-limit
 * risk from browser-triggered requests.
 *
 * Query params:
 *   ?live=true  — return only in-progress games
 */
export async function GET(req: NextRequest) {
  try {
    const liveOnly = req.nextUrl.searchParams.get("live") === "true";
    const games = await listGames(liveOnly);
    return NextResponse.json({ games });
  } catch (err) {
    console.error("[api/scores] Error reading games:", err);
    return NextResponse.json({ error: "Failed to read scores" }, { status: 500 });
  }
}
