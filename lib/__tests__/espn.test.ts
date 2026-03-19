/**
 * ESPN API shape tests.
 *
 * Purpose: catch drift if ESPN changes their undocumented scoreboard API.
 * These tests use fixture data modelled on real ESPN responses (verified
 * against live API calls on 2026-03-15 through 2026-03-23) so that any
 * structural change will break a test here before it silently breaks the app.
 *
 * VERIFIED REAL API SHAPE (2026-03-15 to 2026-03-23):
 *   - event.notes is absent / null in real responses
 *   - headline lives at competitions[0].notes[0].headline
 *   - team.seed is absent; seeds come from curatedRank.current
 *   - competition.type.abbreviation === "TRNMNT" for all tournament games INCLUDING NIT
 *   - Round strings use ordinal form: "1st Round", "2nd Round" (NOT "First Round"/"Second Round")
 *   - Region strings use "X Region": "Midwest Region" (NOT "Midwest Regional")
 *   - NIT games filtered by parseRound rejecting headlines that don't start with "NCAA"
 *
 * To refresh fixtures after a confirmed ESPN API change:
 *   1. Capture: curl "https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?dates=20260320&groups=50&limit=100"
 *   2. Diff the response against the shape documented above
 *   3. Update makeEvent() and the source code (lib/espn.ts) accordingly
 */

import { describe, it, expect } from "vitest";
import { parseGame, fetchTournamentGames } from "../espn";

// ─── Fixture builders (matching real ESPN response shape) ─────────────────────

function makeCompetitor(overrides: {
  displayName?: string;
  name?: string;
  seed?: string;          // team.seed — absent in real pre-tournament responses
  curatedRank?: number;
  score?: string;
  winner?: boolean;
} = {}) {
  const team: Record<string, unknown> = {
    id: "1",
    name: overrides.name ?? overrides.displayName ?? "Duke",
    displayName: overrides.displayName ?? "Duke Blue Devils",
    abbreviation: "DUKE",
  };
  // Only include seed if explicitly provided — real API omits it pre-tournament
  if (overrides.seed !== undefined) team.seed = overrides.seed;

  return {
    homeAway: "home",
    winner: overrides.winner ?? false,
    team,
    score: overrides.score ?? "0",
    curatedRank: overrides.curatedRank != null ? { current: overrides.curatedRank } : undefined,
  };
}

/**
 * Builds a fixture event matching the real ESPN API shape.
 * IMPORTANT: notes live on competitions[0], NOT on the event itself.
 */
function makeEvent(overrides: {
  id?: string;
  headline?: string;
  state?: string;
  completed?: boolean;
  scoreA?: string;
  scoreB?: string;
  winnerIndex?: 0 | 1;
  typeAbbr?: string;
  noNotes?: boolean;
  noCompetitions?: boolean;
  /** Put notes on event instead of competition (old/incorrect shape) */
  notesOnEvent?: boolean;
} = {}) {
  const {
    id = "401638924",
    headline = "NCAA Men's Basketball Championship - South Region - 1st Round",
    state = "post",
    completed = true,
    scoreA = "78",
    scoreB = "65",
    winnerIndex = 0,
    typeAbbr = "TRNMNT",
    noNotes = false,
    noCompetitions = false,
    notesOnEvent = false,
  } = overrides;

  const competitorA = makeCompetitor({ displayName: "Duke Blue Devils", curatedRank: 1, score: scoreA, winner: winnerIndex === 0 });
  const competitorB = makeCompetitor({ displayName: "Vermont Catamounts", curatedRank: 16, score: scoreB, winner: winnerIndex === 1 });

  const notes = noNotes ? [] : [{ type: "event", headline }];

  return {
    id,
    date: "2026-03-20T19:10Z",
    name: "Vermont Catamounts at Duke Blue Devils",
    // Real API: event.notes is absent. notesOnEvent lets us test the fallback.
    notes: notesOnEvent ? notes : undefined,
    competitions: noCompetitions
      ? []
      : [
          {
            id: "401638924",
            type: { id: "3", abbreviation: typeAbbr },
            // Real API: notes live HERE, on the competition
            notes: notesOnEvent ? [] : notes,
            status: {
              clock: 0,
              displayClock: "0:00",
              period: 2,
              type: {
                id: "3",
                name: "STATUS_FINAL",
                state,
                completed,
                description: "Final",
                detail: "Final",
              },
            },
            competitors: [competitorA, competitorB],
          },
        ],
  };
}

// ─── parseGame: happy path ────────────────────────────────────────────────────

describe("parseGame — happy path", () => {
  it("parses a completed Round 1 game correctly", () => {
    const event = makeEvent();
    const game = parseGame(event);

    expect(game).not.toBeNull();
    expect(game!.espnId).toBe("401638924");
    expect(game!.round).toBe("round1");
    expect(game!.region).toBe("South");
    expect(game!.teamA).toBe("Duke Blue Devils");
    expect(game!.teamB).toBe("Vermont Catamounts");
    expect(game!.seedA).toBe(1);
    expect(game!.seedB).toBe(16);
    expect(game!.scoreA).toBe(78);
    expect(game!.scoreB).toBe(65);
    expect(game!.status).toBe("post");
    expect(game!.winner).toBe("Duke Blue Devils");
    expect(game!.gameDate).toBe("2026-03-20T19:10Z");
  });

  it("reads headline from competition.notes (real API shape)", () => {
    // The real ESPN API puts notes on competitions[0], not on the event.
    // This test ensures we're reading from the right place.
    const event = makeEvent({ headline: "NCAA Men's Basketball Championship - Elite Eight - East Regional" });
    expect(event.notes).toBeUndefined();             // event-level notes absent
    expect(event.competitions[0].notes).toBeDefined(); // competition-level notes present
    const game = parseGame(event);
    expect(game).not.toBeNull();
    expect(game!.round).toBe("elite8");
    expect(game!.region).toBe("East");
  });

  it("falls back to event.notes when competition.notes is absent (legacy shape)", () => {
    const event = makeEvent({ notesOnEvent: true });
    const game = parseGame(event);
    expect(game).not.toBeNull();
    expect(game!.round).toBe("round1");
  });

  it("parses an in-progress game (live scores, no winner yet)", () => {
    const event = makeEvent({ state: "in", completed: false, scoreA: "42", scoreB: "39" });
    const game = parseGame(event);

    expect(game).not.toBeNull();
    expect(game!.status).toBe("in");
    expect(game!.scoreA).toBe(42);
    expect(game!.scoreB).toBe(39);
    expect(game!.winner).toBeNull();
  });

  it("returns null scores for a pre-game event", () => {
    const event = makeEvent({ state: "pre", completed: false, scoreA: "0", scoreB: "0" });
    const game = parseGame(event);

    expect(game).not.toBeNull();
    expect(game!.status).toBe("pre");
    expect(game!.scoreA).toBeNull();
    expect(game!.scoreB).toBeNull();
  });

  it("uses curatedRank for seeds (real API shape — team.seed is absent)", () => {
    // Real API does not include team.seed for pre-tournament TBD matchups.
    // Seeds come from curatedRank.current.
    const event = makeEvent();
    const comp = event.competitions[0];
    // Confirm team.seed is not set in our fixture (matches real API)
    expect((comp.competitors[0].team as Record<string, unknown>).seed).toBeUndefined();
    const game = parseGame(event);
    expect(game!.seedA).toBe(1);
    expect(game!.seedB).toBe(16);
  });

  it("falls back to team.seed when curatedRank is absent", () => {
    const event = makeEvent();
    // Override competitors to have seed in team but no curatedRank
    const comp = event.competitions[0];
    comp.competitors[0] = makeCompetitor({ displayName: "Duke Blue Devils", seed: "2", score: "78", winner: true });
    comp.competitors[1] = makeCompetitor({ displayName: "Vermont Catamounts", seed: "15", score: "65", winner: false });
    const game = parseGame(event);
    expect(game!.seedA).toBe(2);
    expect(game!.seedB).toBe(15);
  });

  it("returns null when headline has no parseable round even with fallback to event.name", () => {
    const event = makeEvent({ noNotes: true });
    // competition.notes is empty, event.notes is undefined
    // event.name = "Vermont Catamounts at Duke Blue Devils" — no round keyword
    const game = parseGame(event);
    expect(game).toBeNull();
  });
});

// ─── parseGame: API shape drift detection ────────────────────────────────────

describe("parseGame — API shape drift", () => {
  it("returns null when competitions array is missing", () => {
    const event = makeEvent({ noCompetitions: true });
    expect(parseGame(event)).toBeNull();
  });

  it("returns null when game type is not TRNMNT", () => {
    // ESPN may add non-tournament games to the groups=50 response
    const event = makeEvent({ typeAbbr: "STD" });
    expect(parseGame(event)).toBeNull();
  });

  it("returns null when competitors array has fewer than 2 entries", () => {
    const event = makeEvent();
    event.competitions[0].competitors = [event.competitions[0].competitors[0]];
    expect(parseGame(event)).toBeNull();
  });

  it("returns null when headline does not match any known round", () => {
    // If ESPN renames rounds (e.g. "1st Round" → "Opening Round") this
    // test will pass but the app will silently skip games — update parseRound.
    const event = makeEvent({ headline: "NCAA Tournament - Unknown Round - East Regional" });
    expect(parseGame(event)).toBeNull();
  });

  it("returns null for First Four play-in games (excluded from bracket)", () => {
    const event = makeEvent({ headline: "NCAA Men's Basketball Championship - South Region - First Four" });
    expect(parseGame(event)).toBeNull();
  });

  it("rejects NIT games even though they have type.abbreviation === 'TRNMNT'", () => {
    // groups=50 returns NIT games with the same TRNMNT abbreviation as NCAA tournament games.
    // They must be filtered by parseRound rejecting headlines that don't start with "NCAA".
    const event = makeEvent({ headline: "NIT - 1st Round", typeAbbr: "TRNMNT" });
    expect(parseGame(event)).toBeNull();
  });

  it("gracefully handles missing team.displayName by falling back to team.name", () => {
    const event = makeEvent();
    // Simulate ESPN dropping displayName from the response
    delete (event.competitions[0].competitors[0].team as Record<string, unknown>).displayName;
    const game = parseGame(event);
    expect(game).not.toBeNull();
    expect(game!.teamA).toBe("Duke Blue Devils"); // falls back to team.name
  });
});

// ─── Round parsing — all ESPN headline variants ───────────────────────────────

describe("round detection via ESPN headlines", () => {
  const cases: Array<[string, string, string]> = [
    // [headline, expectedRound, description]
    // ── Real API strings (verified 2026-03-17 to 2026-03-23) ──────────────────
    ["NCAA Men's Basketball Championship - Midwest Region - 1st Round",  "round1", "Real: 1st Round"],
    ["NCAA Men's Basketball Championship - West Region - 2nd Round",     "round2", "Real: 2nd Round"],
    ["NCAA Men's Basketball Championship - East Region - Sweet 16",      "sweet16", "Real: Sweet 16"],
    ["NCAA Men's Basketball Championship - South Region - Elite 8",      "elite8", "Real: Elite 8"],
    ["NCAA Men's Basketball Championship - National Championship",        "championship", "Real: National Championship"],
    // ── Legacy / alternate strings (kept for robustness) ─────────────────────
    ["NCAA Men's Basketball Championship - First Round - East Regional",  "round1", "Alt: First Round"],
    ["NCAA Men's Basketball Tournament - Round of 64 - West Regional",   "round1", "Alt: Round of 64"],
    ["NCAA Men's Basketball Championship - Second Round - Midwest Regional", "round2", "Alt: Second Round"],
    ["NCAA Men's Basketball Tournament - Round of 32 - South Regional",  "round2", "Alt: Round of 32"],
    ["NCAA Men's Basketball Championship - Sweet Sixteen - East Regional", "sweet16", "Alt: Sweet Sixteen"],
    ["NCAA Men's Basketball Tournament - Regional Semifinal - Midwest",  "sweet16", "Alt: Regional Semifinal"],
    ["NCAA Men's Basketball Championship - Elite Eight - South Regional", "elite8", "Alt: Elite Eight"],
    ["NCAA Men's Basketball Tournament - Regional Final - West Regional", "elite8", "Alt: Regional Final"],
    ["NCAA Men's Basketball Championship - Final Four - National Semifinals", "final4", "Alt: Final Four"],
    ["NCAA Men's Basketball Tournament - National Semifinal",             "final4", "Alt: National Semifinal"],
    ["NCAA Men's Basketball Tournament - Championship Game",              "championship", "Alt: Championship Game"],
  ];

  it.each(cases)('headline "%s" → round "%s" (%s)', (headline, expectedRound) => {
    const event = makeEvent({ headline });
    const game = parseGame(event);
    expect(game, `expected a game for headline: "${headline}"`).not.toBeNull();
    expect(game!.round).toBe(expectedRound);
  });
});

// ─── Region parsing ───────────────────────────────────────────────────────────

describe("region detection via ESPN headlines", () => {
  const cases: Array<[string, string, string]> = [
    ["NCAA Men's Basketball Championship - First Round - East Regional", "East", "East"],
    ["NCAA Men's Basketball Championship - Second Round - West Regional", "West", "West"],
    ["NCAA Men's Basketball Championship - Sweet Sixteen - South Regional", "South", "South"],
    ["NCAA Men's Basketball Championship - Elite Eight - Midwest Regional", "Midwest", "Midwest"],
    ["NCAA Men's Basketball Championship - Final Four - National Semifinals", "Final Four", "Final Four"],
    ["NCAA Men's Basketball Championship - National Championship", "Championship", "Championship"],
  ];

  it.each(cases)('headline "%s" → region "%s" (%s)', (headline, expectedRegion) => {
    const event = makeEvent({ headline });
    const game = parseGame(event);
    expect(game, `expected a game for headline: "${headline}"`).not.toBeNull();
    expect(game!.region).toBe(expectedRegion);
  });
});

// ─── fetchTournamentGames: live smoke test (skipped in CI) ───────────────────

describe.skipIf(process.env.CI === "true")("fetchTournamentGames — live ESPN API smoke test", () => {
  it("returns an array from the ESPN scoreboard endpoint", async () => {
    const today = new Date();
    const dateStr = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, "0"),
      String(today.getDate()).padStart(2, "0"),
    ].join("");

    const events = await fetchTournamentGames(dateStr);
    expect(Array.isArray(events)).toBe(true);

    for (const event of events) {
      expect(event).toHaveProperty("id");
      expect(typeof event.id).toBe("string");
    }
  }, 15_000);

  it("returns events whose headline is on competition.notes, not event.notes", async () => {
    // This is the key shape assertion. If ESPN moves notes back to the event
    // level, this test will fail and alert us to update parseGame accordingly.
    const dateStr = "20260320"; // 1st Round — known to have TRNMNT events (verified)
    const events = await fetchTournamentGames(dateStr);

    // Filter to only TRNMNT events
    const trnmnt = events.filter(
      (e) => e.competitions?.[0]?.type?.abbreviation === "TRNMNT"
    );
    expect(trnmnt.length).toBeGreaterThan(0);

    for (const event of trnmnt) {
      // event.notes should be absent or empty
      expect((event.notes ?? []).length).toBe(0);
      // competition.notes should have the headline
      const compNotes = event.competitions?.[0]?.notes ?? [];
      expect(compNotes.length).toBeGreaterThan(0);
      expect(typeof compNotes[0].headline).toBe("string");
    }
  }, 15_000);
});
