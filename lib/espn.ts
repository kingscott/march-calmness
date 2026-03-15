/**
 * ESPN undocumented scoreboard API client.
 *
 * Rate-limiting strategy:
 *  - This module is ONLY responsible for fetching + parsing.
 *  - Call scheduling (2-min / 15-min / hourly) lives in poller.ts.
 *  - A single in-process cache prevents thundering-herd if multiple
 *    code paths ever call fetchTournamentGames directly.
 */

import type { Game, GameStatus, Round } from "./types";

// ─── ESPN API types (internal) ───────────────────────────────────────────────

interface EspnScoreboardResponse {
  events?: EspnEvent[];
}

interface EspnEvent {
  id: string;
  date?: string;
  name?: string;
  notes?: Array<{ type?: string; headline?: string }>;
  competitions?: EspnCompetition[];
}

interface EspnCompetition {
  id?: string;
  type?: { id?: string; abbreviation?: string };
  notes?: Array<{ type?: string; headline?: string }>;
  status?: {
    clock?: number;
    displayClock?: string;
    period?: number;
    type?: {
      id?: string;
      name?: string;
      state?: string;
      completed?: boolean;
      description?: string;
      detail?: string;
    };
  };
  competitors?: EspnCompetitor[];
}

interface EspnCompetitor {
  id?: string;
  homeAway?: string;
  winner?: boolean;
  team: {
    id?: string;
    name?: string;
    displayName?: string;
    abbreviation?: string;
    seed?: string;
  };
  score?: string;
  curatedRank?: { current?: number };
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

const ESPN_SCOREBOARD =
  "https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard";

// groups=50 = NCAA Tournament; limit=100 covers a full day of bracket games.
export async function fetchTournamentGames(dateStr: string): Promise<EspnEvent[]> {
  const url = `${ESPN_SCOREBOARD}?dates=${dateStr}&groups=50&limit=100`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "march-calmness-bracket-tracker/1.0 (personal, non-commercial)",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(12_000),
    // Next.js cache: revalidate every 90 s so even direct calls are throttled
    next: { revalidate: 90 },
  });

  if (!res.ok) {
    throw new Error(`ESPN API ${res.status} ${res.statusText} for date=${dateStr}`);
  }

  const data = (await res.json()) as EspnScoreboardResponse;
  return data.events ?? [];
}

// ─── Parsers ──────────────────────────────────────────────────────────────────

function parseRound(headline: string): Round | null {
  const h = headline.toLowerCase();
  // Check most specific patterns first
  if (h.includes("national championship") || h.includes("championship game")) return "championship";
  if (h.includes("final four") || h.includes("national semifinal")) return "final4";
  if (h.includes("elite eight") || h.includes("elite 8") || h.includes("regional final")) return "elite8";
  if (h.includes("sweet sixteen") || h.includes("sweet 16") || h.includes("regional semifinal")) return "sweet16";
  if (h.includes("second round") || h.includes("round of 32")) return "round2";
  // "First Round" and "First Four" both map to round1
  if (h.includes("first round") || h.includes("first four") || h.includes("round of 64")) return "round1";
  return null;
}

function parseRegion(headline: string, round: Round): Game["region"] {
  if (round === "championship") return "Championship";
  if (round === "final4") return "Final Four";
  const h = headline.toLowerCase();
  // Check "midwest" before "west" — "midwest" contains the substring "west"
  if (h.includes("midwest")) return "Midwest";
  if (h.includes("east")) return "East";
  if (h.includes("west")) return "West";
  if (h.includes("south")) return "South";
  // If region is ambiguous, fall through — caller can handle null
  return "East"; // safe fallback; scoring engine will use espnId for exact matching
}

/**
 * Convert a raw ESPN event into our Game shape.
 * Returns null if the event is not a parseable NCAA Tournament game.
 */
export function parseGame(event: EspnEvent): Omit<Game, "id"> | null {
  const competition = event.competitions?.[0];
  if (!competition) return null;

  // groups=50 already filters for tournament games, but double-check type
  const typeAbbr = competition.type?.abbreviation ?? "";
  if (typeAbbr && typeAbbr !== "TRNMNT") return null;

  // Headline: real ESPN responses put notes on competitions[0], not the event.
  // Fall back to event.notes (older shape) then event.name as last resort.
  const headline =
    competition.notes?.[0]?.headline ??
    event.notes?.[0]?.headline ??
    event.name ??
    "";
  const round = parseRound(headline);
  if (!round) return null;

  const region = parseRegion(headline, round);

  const competitors = competition.competitors ?? [];
  if (competitors.length < 2) return null;

  const [compA, compB] = competitors;

  const teamA = compA.team.displayName ?? compA.team.name ?? "Unknown";
  const teamB = compB.team.displayName ?? compB.team.name ?? "Unknown";

  // Seed: prefer curatedRank (number) over team.seed (string)
  const seedA = compA.curatedRank?.current ?? (parseInt(compA.team.seed ?? "0", 10) || 0);
  const seedB = compB.curatedRank?.current ?? (parseInt(compB.team.seed ?? "0", 10) || 0);

  const state = competition.status?.type?.state ?? "pre";
  const completed = competition.status?.type?.completed ?? false;
  const status: GameStatus = completed ? "post" : state === "in" ? "in" : "pre";

  // Scores are 0 for pre-game, actual values during/after
  const scoreA = status !== "pre" ? parseInt(compA.score ?? "0", 10) || 0 : null;
  const scoreB = status !== "pre" ? parseInt(compB.score ?? "0", 10) || 0 : null;

  let winner: string | null = null;
  if (completed) {
    const winnerComp = competitors.find((c) => c.winner === true);
    winner = winnerComp?.team.displayName ?? winnerComp?.team.name ?? null;
  }

  return {
    espnId: event.id,
    round,
    region,
    teamA,
    teamB,
    seedA,
    seedB,
    scoreA,
    scoreB,
    status,
    winner,
    gameDate: event.date ?? "",
    updatedAt: new Date().toISOString(),
  };
}
