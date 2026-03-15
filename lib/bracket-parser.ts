import Anthropic from "@anthropic-ai/sdk";
import { execFile } from "child_process";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { promisify } from "util";
import type { BracketPicks, Region, RegionPicks } from "./types";

const execFileAsync = promisify(execFile);

// ─── Claude extraction prompt ─────────────────────────────────────────────────

const EXTRACTION_PROMPT = `You are analyzing a filled-in NCAA March Madness bracket PDF image.

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
- Use the exact team name as printed on the bracket (e.g. "Duke", "UConn", "Kansas").
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
  /** Base-64 encoded PNG of the first PDF page (for preview) */
  previewBase64: string;
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
 * Convert the first page of a bracket PDF to a PNG, send it to the Claude
 * Vision API, and return structured picks + a preview image.
 */
export async function parseBracketPdf(
  pdfBuffer: Buffer,
): Promise<ParseResult> {
  // ── 1. Convert first PDF page to PNG via pdftoppm ────────────────────────
  let previewBase64: string;
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "bracket-"));
  try {
    const pdfPath = path.join(tmpDir, "input.pdf");
    const outPrefix = path.join(tmpDir, "page");

    await fs.writeFile(pdfPath, pdfBuffer);

    // pdftoppm -r 150 -png -f 1 -l 1 input.pdf page
    // Produces page-1.png (first page only)
    await execFileAsync("pdftoppm", [
      "-r", "150",
      "-png",
      "-f", "1",
      "-l", "1",
      pdfPath,
      outPrefix,
    ]);

    // Find the output file (pdftoppm zero-pads: page-01.png or page-1.png)
    const files = await fs.readdir(tmpDir);
    const pngFile = files.find((f) => f.startsWith("page") && f.endsWith(".png"));
    if (!pngFile) {
      throw new BracketParseError("PDF contains no pages or pdftoppm produced no output");
    }
    const pngBuffer = await fs.readFile(path.join(tmpDir, pngFile));
    previewBase64 = pngBuffer.toString("base64");
  } catch (err) {
    if (err instanceof BracketParseError) throw err;
    throw new BracketParseError("Failed to render PDF to image", err);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }

  // ── 2. Send to Claude vision API ─────────────────────────────────────────
  const client = new Anthropic();
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
              type: "image",
              source: {
                type: "base64",
                media_type: "image/png",
                data: previewBase64,
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

  // ── 3. Parse Claude's JSON response ──────────────────────────────────────
  let raw: RawBracketPicks;
  try {
    // Strip any accidental markdown fences just in case
    const cleaned = rawJson.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    raw = JSON.parse(cleaned) as RawBracketPicks;
  } catch (err) {
    throw new BracketParseError(
      `Failed to parse Claude response as JSON: ${rawJson.slice(0, 200)}`,
      err,
    );
  }

  // ── 4. Validate structure ─────────────────────────────────────────────────
  const picks = validateAndNormalize(raw);

  return { picks, previewBase64 };
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

    // Each round's winners must be a subset of the previous round's entrants.
    // We can only partially validate since we don't have the full bracket seedings,
    // but we verify round N+1 picks came from round N winners.
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

  // Each elite8 winner must appear in final4
  const elite8Winners = REGIONS.map((reg) => regions[reg]!.elite8);
  for (const team of raw.final4) {
    if (!elite8Winners.includes(team)) {
      throw new BracketParseError(
        `final4 team "${team}" is not an elite8 winner`,
      );
    }
  }

  if (!raw.final4.includes(raw.champion)) {
    throw new BracketParseError(
      `champion "${raw.champion}" is not in final4`,
    );
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
