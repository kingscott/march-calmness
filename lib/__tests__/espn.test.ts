/**
 * ESPN API shape tests.
 *
 * Purpose: catch drift if ESPN changes their undocumented scoreboard API.
 * These tests use fixture data modelled on real ESPN responses so that
 * any structural change to the API will break a test here before it
 * silently breaks the app.
 *
 * To update after a confirmed API change:
 *   1. Capture a fresh response: curl "https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?dates=20260320&groups=50&limit=100"
 *   2. Update the fixtures below to match the new shape.
 *   3. Update parseGame / parseRound / parseRegion in lib/espn.ts as needed.
 */

import { describe, it, expect } from "vitest";
import { parseGame, fetchTournamentGames } from "../espn";

// ─── Fixture builders ─────────────────────────────────────────────────────────

function makeCompetitor(overrides: {
  displayName?: string;
  seed?: string;
  curatedRank?: number;
  score?: string;
  winner?: boolean;
} = {}) {
  return {
    homeAway: "home",
    winner: overrides.winner ?? false,
    team: {
      id: "1",
      name: overrides.displayName ?? "Duke",
      displayName: overrides.displayName ?? "Duke Blue Devils",
      abbreviation: "DUKE",
      seed: overrides.seed ?? "1",
    },
    score: overrides.score ?? "0",
    curatedRank: overrides.curatedRank != null ? { current: overrides.curatedRank } : undefined,
  };
}

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
} = {}) {
  const {
    id = "401638924",
    headline = "NCAA Men's Basketball Tournament - First Round - South Regional",
    state = "post",
    completed = true,
    scoreA = "78",
    scoreB = "65",
    winnerIndex = 0,
    typeAbbr = "TRNMNT",
    noNotes = false,
    noCompetitions = false,
  } = overrides;

  const competitorA = makeCompetitor({ displayName: "Duke Blue Devils", seed: "1", curatedRank: 1, score: scoreA, winner: winnerIndex === 0 });
  const competitorB = makeCompetitor({ displayName: "Vermont Catamounts", seed: "16", curatedRank: 16, score: scoreB, winner: winnerIndex === 1 });

  return {
    id,
    date: "2026-03-20T19:10Z",
    name: "Vermont Catamounts at Duke Blue Devils",
    notes: noNotes ? [] : [{ type: "rotation", headline }],
    competitions: noCompetitions
      ? []
      : [
          {
            id: "401638924",
            type: { id: "3", abbreviation: typeAbbr },
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

  it("falls back to team.seed when curatedRank is absent", () => {
    const event = makeEvent();
    // Remove curatedRank from both competitors
    event.competitions[0].competitors[0].curatedRank = undefined;
    event.competitions[0].competitors[1].curatedRank = undefined;
    const game = parseGame(event);

    expect(game!.seedA).toBe(1);   // parsed from team.seed "1"
    expect(game!.seedB).toBe(16);  // parsed from team.seed "16"
  });

  it("uses event.name as fallback when notes array is empty", () => {
    // Without a parseable headline we still get a null round — but with
    // a name that includes round keywords the fallback should work.
    const event = makeEvent({ noNotes: true });
    // event.name = "Vermont Catamounts at Duke Blue Devils" — no round keyword,
    // so parseGame should return null (unparseable round).
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
    // If ESPN renames rounds (e.g. "Round of 64" → "Opening Round") this test
    // will pass but the round detection will break — update parseRound accordingly.
    const event = makeEvent({ headline: "NCAA Tournament - Unknown Round - East Regional" });
    expect(parseGame(event)).toBeNull();
  });

  it("gracefully handles missing team.displayName by falling back to team.name", () => {
    const event = makeEvent();
    // Simulate ESPN dropping displayName from the response
    (event.competitions[0].competitors[0].team as { displayName?: string }).displayName = undefined;
    const game = parseGame(event);
    expect(game).not.toBeNull();
    // Should fall back to team.name
    expect(game!.teamA).toBe("Duke Blue Devils"); // team.name on the fixture
  });
});

// ─── Round parsing — all ESPN headline variants ───────────────────────────────

describe("round detection via ESPN headlines", () => {
  const cases: Array<[string, string, string]> = [
    // [headline, expectedRound, description]
    ["NCAA Men's Basketball Tournament - First Round - East Regional", "round1", "First Round"],
    ["NCAA Men's Basketball Tournament - First Four - Dayton", "round1", "First Four"],
    ["NCAA Men's Basketball Tournament - Round of 64 - West Regional", "round1", "Round of 64"],
    ["NCAA Men's Basketball Tournament - Second Round - Midwest Regional", "round2", "Second Round"],
    ["NCAA Men's Basketball Tournament - Round of 32 - South Regional", "round2", "Round of 32"],
    ["NCAA Men's Basketball Tournament - Sweet Sixteen - East Regional", "sweet16", "Sweet Sixteen"],
    ["NCAA Men's Basketball Tournament - Sweet 16 - West Regional", "sweet16", "Sweet 16"],
    ["NCAA Men's Basketball Tournament - Regional Semifinal - Midwest", "sweet16", "Regional Semifinal"],
    ["NCAA Men's Basketball Tournament - Elite Eight - South Regional", "elite8", "Elite Eight"],
    ["NCAA Men's Basketball Tournament - Elite 8 - East Regional", "elite8", "Elite 8"],
    ["NCAA Men's Basketball Tournament - Regional Final - West Regional", "elite8", "Regional Final"],
    ["NCAA Men's Basketball Tournament - Final Four - National Semifinals", "final4", "Final Four"],
    ["NCAA Men's Basketball Tournament - National Semifinal", "final4", "National Semifinal"],
    ["NCAA Men's Basketball Tournament - National Championship", "championship", "National Championship"],
    ["NCAA Men's Basketball Tournament - Championship Game", "championship", "Championship Game"],
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
    ["NCAA Men's Basketball Tournament - First Round - East Regional", "East", "East"],
    ["NCAA Men's Basketball Tournament - Second Round - West Regional", "West", "West"],
    ["NCAA Men's Basketball Tournament - Sweet Sixteen - South Regional", "South", "South"],
    ["NCAA Men's Basketball Tournament - Elite Eight - Midwest Regional", "Midwest", "Midwest"],
    ["NCAA Men's Basketball Tournament - Final Four - National Semifinals", "Final Four", "Final Four"],
    ["NCAA Men's Basketball Tournament - National Championship", "Championship", "Championship"],
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
    // Uses today's date. During the tournament this will return real games;
    // outside the window it returns an empty array — both are valid.
    const today = new Date();
    const dateStr = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, "0"),
      String(today.getDate()).padStart(2, "0"),
    ].join("");

    const events = await fetchTournamentGames(dateStr);

    // The response must be an array (even if empty outside tournament window)
    expect(Array.isArray(events)).toBe(true);

    // If there are events, each must have an id field (key shape assertion)
    for (const event of events) {
      expect(event).toHaveProperty("id");
      expect(typeof event.id).toBe("string");
    }
  }, 15_000); // generous timeout for a real network call
});
