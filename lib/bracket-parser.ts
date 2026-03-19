import Anthropic from "@anthropic-ai/sdk";
import type { BracketPicks, Region, RegionPicks } from "./types";

// ─── Claude extraction prompt ─────────────────────────────────────────────────

const EXTRACTION_PROMPT = `You are analyzing a filled-in NCAA March Madness bracket PDF.

Extract all bracket picks and return them as a single JSON object with this exact shape:

{
  "regions": {
    "East":    { "round1": [8 team names], "round2": [4 team names], "sweet16": [2 team names], "elite8": "1 team name" },
    "West":    { "round1": [8 team names], "round2": [4 team names], "sweet16": [2 team names], "elite8": "1 team name" },
    "South":   { "round1": [8 team names], "round2": [4 team names], "sweet16": [2 team names], "elite8": "1 team name" },
    "Midwest": { "round1": [8 team names], "round2": [4 team names], "sweet16": [2 team names], "elite8": "1 team name" }
  },
  "final4": ["team1", "team2", "team3", "team4"],
  "champion": "team name"
}

Rules:
- Use the common team name WITHOUT mascot nickname (e.g. "Duke", "UConn", "Kansas", "Michigan State", "North Carolina").
- Expand any printed bracket abbreviations to full team names (e.g. "MICHST" → "Michigan State", "MARYCA" → "Saint Mary's", "KENSAW" → "Kennesaw State", "N. CAROLINA" → "North Carolina").
- For teams from California/region-disambiguated schools, use the common name only (e.g. "Saint Mary's", not "St. Mary's CA").
- round1 has 8 winners (Round of 64 → Round of 32 survivors).
- round2 has 4 winners (Round of 32 → Sweet 16 survivors).
- sweet16 has 2 winners (Sweet 16 → Elite 8 survivors).
- elite8 has 1 winner (regional champion advancing to Final Four).
- final4 has 4 teams (both Final Four participants).
- champion is the national champion pick.
- Respond with ONLY valid JSON — no markdown fences, no commentary.`;

// ─── Raw Claude response shape ────────────────────────────────────────────────

interface RawRegionPicks {
  round1: string[];
  round2: string[];
  sweet16: string[];
  elite8: string;
}

interface RawBracketPicks {
  regions: Record<string, RawRegionPicks>;
  final4: string[];
  champion: string;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface ParseResult {
  picks: BracketPicks;
}

export class BracketParseError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "BracketParseError";
  }
}

/**
 * Send a bracket PDF directly to the Claude API as a document source and
 * return structured picks. No image conversion or system binaries required —
 * fully compatible with Cloudflare Workers.
 */
export async function parseBracketPdf(
  pdfArrayBuffer: ArrayBuffer,
): Promise<ParseResult> {
  const client = new Anthropic();

  // Convert to base64 using the Web-standard btoa path
  const pdfBase64 = arrayBufferToBase64(pdfArrayBuffer);

  let rawJson: string;
  try {
    const message = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            {
              // Send the PDF natively — no image conversion needed
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: pdfBase64,
              },
            },
            {
              type: "text",
              text: EXTRACTION_PROMPT,
            },
          ],
        },
      ],
    });

    const block = message.content[0];
    if (!block || block.type !== "text") {
      throw new BracketParseError("Unexpected Claude response format");
    }
    rawJson = block.text.trim();
  } catch (err) {
    if (err instanceof BracketParseError) throw err;
    throw new BracketParseError("Claude API call failed", err);
  }

  // ── Parse Claude's JSON response ────────────────────────────────────────────
  let raw: RawBracketPicks;
  try {
    const cleaned = rawJson.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    raw = JSON.parse(cleaned) as RawBracketPicks;
  } catch (err) {
    throw new BracketParseError(
      `Failed to parse Claude response as JSON: ${rawJson.slice(0, 200)}`,
      err,
    );
  }

  const picks = validateAndNormalize(raw);
  return { picks };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert an ArrayBuffer to a base64 string using Web APIs (no Node Buffer). */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// ─── Validation ───────────────────────────────────────────────────────────────

const REGIONS: Region[] = ["East", "West", "South", "Midwest"];

function validateAndNormalize(raw: RawBracketPicks): BracketPicks {
  if (!raw || typeof raw !== "object") {
    throw new BracketParseError("Response is not an object");
  }
  if (!raw.regions || typeof raw.regions !== "object") {
    throw new BracketParseError("Missing 'regions' field");
  }

  const regions: Partial<Record<Region, RegionPicks>> = {};

  for (const region of REGIONS) {
    const r = raw.regions[region];
    if (!r) {
      throw new BracketParseError(`Missing region: ${region}`);
    }
    assertStringArray(r.round1, `${region}.round1`, 8);
    assertStringArray(r.round2, `${region}.round2`, 4);
    assertStringArray(r.sweet16, `${region}.sweet16`, 2);
    assertString(r.elite8, `${region}.elite8`);

    validateProgression(r.round1, r.round2, region, "round1→round2");
    validateProgression(r.round2, r.sweet16, region, "round2→sweet16");
    if (!r.sweet16.includes(r.elite8)) {
      throw new BracketParseError(
        `${region}.elite8 "${r.elite8}" is not in sweet16 picks`,
      );
    }

    regions[region] = {
      round1: r.round1,
      round2: r.round2,
      sweet16: r.sweet16,
      elite8: r.elite8,
    };
  }

  assertStringArray(raw.final4, "final4", 4);
  assertString(raw.champion, "champion");

  const elite8Winners = REGIONS.map((reg) => regions[reg]!.elite8);
  for (const team of raw.final4) {
    if (!elite8Winners.includes(team)) {
      throw new BracketParseError(
        `final4 team "${team}" is not an elite8 winner`,
      );
    }
  }

  if (!raw.final4.includes(raw.champion)) {
    throw new BracketParseError(`champion "${raw.champion}" is not in final4`);
  }

  return {
    regions: regions as Record<Region, RegionPicks>,
    final4: raw.final4,
    champion: raw.champion,
  };
}

function assertString(val: unknown, field: string): asserts val is string {
  if (typeof val !== "string" || val.trim() === "") {
    throw new BracketParseError(`${field} must be a non-empty string`);
  }
}

function assertStringArray(
  val: unknown,
  field: string,
  length: number,
): asserts val is string[] {
  if (!Array.isArray(val) || val.length !== length) {
    throw new BracketParseError(
      `${field} must be an array of ${length} strings (got ${Array.isArray(val) ? val.length : typeof val})`,
    );
  }
  for (const item of val) {
    if (typeof item !== "string" || item.trim() === "") {
      throw new BracketParseError(`${field} contains a non-string entry`);
    }
  }
}

function validateProgression(
  previous: string[],
  next: string[],
  region: string,
  label: string,
): void {
  for (const pick of next) {
    if (!previous.includes(pick)) {
      throw new BracketParseError(
        `${region} ${label}: "${pick}" was not a winner in the previous round`,
      );
    }
  }
}
