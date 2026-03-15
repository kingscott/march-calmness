/**
 * Background ESPN polling loop.
 *
 * Rate-limiting strategy:
 *  - Active game hours  (11 AM – 2 AM ET): poll every 2 minutes
 *  - Quiet hours (2 AM – 11 AM ET):        poll every 15 minutes
 *  - Outside tournament window:             poll every 60 minutes
 *    (keeps DB fresh if the app runs year-round without manual restarts)
 *  - Only poll dates that could have games (yesterday, today, tomorrow).
 *  - Any ESPN fetch error is logged and swallowed; the poller reschedules
 *    normally so a transient failure doesn't kill the loop.
 */

import { fetchTournamentGames, parseGame } from "./espn";
import { upsertGame } from "./db";

// ─── Tournament window ────────────────────────────────────────────────────────
// 2026 NCAA Men's Basketball Tournament (adjust if app is reused in future years)
const TOURNAMENT_START = new Date("2026-03-17T00:00:00-04:00"); // First Four tip-off day
const TOURNAMENT_END   = new Date("2026-04-08T00:00:00-04:00"); // Day after Championship

// ─── Poll intervals ───────────────────────────────────────────────────────────
const ACTIVE_MS     =  2 * 60 * 1000; //  2 min  — games are likely live
const QUIET_MS      = 15 * 60 * 1000; // 15 min  — tournament day, no active games
const OFF_SEASON_MS = 60 * 60 * 1000; //  1 hour — outside tournament window

// Active game hours in US Eastern Time (games run ~11 AM – ~midnight ET)
const ACTIVE_HOUR_START = 11; // inclusive
const ACTIVE_HOUR_END   =  2; // exclusive (wraps past midnight → 2 AM)

// ─── State ────────────────────────────────────────────────────────────────────
let _running = false;
let _timer: ReturnType<typeof setTimeout> | null = null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Eastern Time hour (0-23). Accounts for EDT vs EST automatically. */
function easternHour(): number {
  // ECMAScript doesn't expose a direct TZ offset, so use toLocaleString.
  const etStr = new Date().toLocaleString("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false });
  return parseInt(etStr, 10) % 24;
}

function inTournamentWindow(): boolean {
  const now = Date.now();
  return now >= TOURNAMENT_START.getTime() && now <= TOURNAMENT_END.getTime();
}

function isActiveGameHour(): boolean {
  const h = easternHour();
  // Active if between 11 AM (inclusive) and 2 AM next day (exclusive)
  return h >= ACTIVE_HOUR_START || h < ACTIVE_HOUR_END;
}

function nextInterval(): number {
  if (!inTournamentWindow()) return OFF_SEASON_MS;
  return isActiveGameHour() ? ACTIVE_MS : QUIET_MS;
}

/**
 * Returns YYYYMMDD strings for yesterday, today, and tomorrow (UTC dates).
 * Using UTC avoids midnight-boundary edge cases across timezones.
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
}

/**
 * Fetch ESPN data for relevant dates and upsert parsed games into the DB.
 * Safe to call manually (e.g., on server startup or via an admin endpoint).
 */
export async function pollOnce(): Promise<PollResult> {
  const dates = relevantDates();
  const result: PollResult = { dates, eventsFound: 0, gamesUpserted: 0, errors: [] };

  for (const dateStr of dates) {
    try {
      const events = await fetchTournamentGames(dateStr);
      result.eventsFound += events.length;

      for (const event of events) {
        const game = parseGame(event);
        if (game) {
          upsertGame(game);
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

// ─── Scheduler ────────────────────────────────────────────────────────────────

async function tick(): Promise<void> {
  if (!_running) return;

  try {
    const result = await pollOnce();
    const { eventsFound, gamesUpserted, errors } = result;
    if (errors.length) {
      console.warn(`[poller] ${errors.length} fetch error(s):`, errors);
    }
    console.log(`[poller] Done — ${gamesUpserted}/${eventsFound} events stored`);
  } catch (err) {
    // pollOnce is already defensive, but catch anything that slips through
    console.error("[poller] Unexpected error:", err);
  }

  if (_running) {
    const ms = nextInterval();
    _timer = setTimeout(() => void tick(), ms);
    console.log(`[poller] Next poll in ${Math.round(ms / 60_000)} min`);
  }
}

/**
 * Start the background polling loop.
 * Idempotent — safe to call multiple times (e.g., in dev with hot reload).
 */
export function startPoller(): void {
  if (_running) return;
  _running = true;
  console.log("[poller] Starting (tournament window:", inTournamentWindow() ? "ACTIVE" : "inactive", ")");
  // Small startup delay so the server can finish booting before first fetch
  _timer = setTimeout(() => void tick(), 8_000);
}

/**
 * Stop the loop gracefully (for clean shutdown or tests).
 */
export function stopPoller(): void {
  _running = false;
  if (_timer !== null) {
    clearTimeout(_timer);
    _timer = null;
  }
  console.log("[poller] Stopped");
}
