/**
 * ESPN polling — triggered by Cloudflare Cron Trigger.
 *
 * The cron schedule in wrangler.jsonc runs pollOnce() every 2 minutes during
 * the tournament window. Outside that window a separate hourly cron keeps the
 * DB modestly fresh.
 *
 * Any ESPN fetch error is logged and swallowed so a transient failure doesn't
 * prevent future runs.
 */

import { fetchTournamentGames, parseGame } from "./espn";
import { upsertGame } from "./db";

// ─── Tournament window ────────────────────────────────────────────────────────
// 2026 NCAA Men's Basketball Tournament
const TOURNAMENT_START = new Date("2026-03-17T00:00:00-04:00");
const TOURNAMENT_END   = new Date("2026-04-08T00:00:00-04:00");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function inTournamentWindow(): boolean {
  const now = Date.now();
  return now >= TOURNAMENT_START.getTime() && now <= TOURNAMENT_END.getTime();
}

/**
 * Returns YYYYMMDD strings for yesterday, today, and tomorrow (UTC).
 */
function relevantDates(): string[] {
  const dates: string[] = [];
  const now = new Date();
  for (let offset = -1; offset <= 1; offset++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offset));
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    dates.push(`${y}${m}${day}`);
  }
  return dates;
}

// ─── Core poll ────────────────────────────────────────────────────────────────

export interface PollResult {
  dates: string[];
  eventsFound: number;
  gamesUpserted: number;
  errors: string[];
  skipped: boolean;
}

/**
 * Fetch ESPN data for relevant dates and upsert parsed games into D1.
 * Safe to call from a Cloudflare Cron Trigger scheduled() handler.
 */
export async function pollOnce(): Promise<PollResult> {
  if (!inTournamentWindow()) {
    return { dates: [], eventsFound: 0, gamesUpserted: 0, errors: [], skipped: true };
  }

  const dates = relevantDates();
  const result: PollResult = { dates, eventsFound: 0, gamesUpserted: 0, errors: [], skipped: false };

  for (const dateStr of dates) {
    try {
      const events = await fetchTournamentGames(dateStr);
      result.eventsFound += events.length;

      for (const event of events) {
        const game = parseGame(event);
        if (game) {
          await upsertGame(game);
          result.gamesUpserted++;
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`${dateStr}: ${msg}`);
    }
  }

  return result;
}
