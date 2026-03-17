# March Madness Bracket Tracker

## Context

You want a self-hosted web app to: (1) upload a digitally-filled bracket PDF, (2) parse it into structured picks, (3) visualize the bracket, and (4) pull live scores every few minutes to track how your bracket is doing.

## Tech Stack

- **Framework**: [vinext](https://github.com/cloudflare/vinext) (Vite-based Next.js reimplementation)
- **Self-hosting**: Nitro `node` preset → standalone Node.js server, Dockerized
- **Bracket visualization**: [Bracketry.js](https://bracketry.app/) (framework-agnostic, 12kb gzip, MIT, active maintenance)
- **PDF parsing**: Claude API vision (convert PDF page to image, send to Claude to extract picks as structured JSON)
- **Live scores**: ESPN undocumented API (free, no API key, returns JSON)
- **Data storage**: SQLite via `better-sqlite3` (single file, zero config, perfect for single-user self-hosted app)

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   Browser                        │
│  ┌───────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ Upload PDF│  │ Bracket  │  │  Scoreboard  │  │
│  │   Page    │  │  Viewer  │  │   + Status   │  │
│  └─────┬─────┘  └────┬─────┘  └──────┬───────┘  │
│        │              │               │          │
│        │    polls every 2min          │          │
└────────┼──────────────┼───────────────┼──────────┘
         │              │               │
    ┌────┴──────────────┴───────────────┴────┐
    │           vinext API Routes             │
    │  POST /api/bracket/upload               │
    │  GET  /api/brackets                     │
    │  GET  /api/bracket/:id                  │
    │  DELETE /api/bracket/:id                │
    │  GET  /api/scores                       │
    │  GET  /api/bracket/:id/status           │
    └────┬──────────────┬───────────────┬────┘
         │              │               │
    ┌────┴────┐   ┌─────┴─────┐   ┌────┴────┐
    │ Claude  │   │  SQLite   │   │  ESPN   │
    │  API    │   │   DB      │   │  API    │
    │ (parse) │   │ (storage) │   │(scores) │
    └─────────┘   └───────────┘   └─────────┘
```

## Project Structure

```
march-calmness/
├── app/
│   ├── layout.tsx                 # Root layout with nav
│   ├── page.tsx                   # Home / dashboard
│   ├── upload/
│   │   └── page.tsx               # PDF upload page
│   ├── bracket/
│   │   └── page.tsx               # Bracket viewer with live scores
│   └── api/
│       ├── brackets/
│       │   └── route.ts           # GET: list all brackets
│       ├── bracket/
│       │   ├── upload/route.ts    # POST: accept PDF + name, parse via Claude, store picks
│       │   └── [id]/
│       │       ├── route.ts       # GET: return bracket picks; DELETE: remove bracket
│       │       └── status/route.ts # GET: bracket score/status summary
│       └── scores/
│           └── route.ts           # GET: fetch ESPN scores (with server-side cache)
├── lib/
│   ├── db.ts                      # SQLite setup + queries
│   ├── espn.ts                    # ESPN API client + caching
│   ├── poller.ts                  # Background ESPN polling loop
│   ├── bracket-parser.ts          # PDF→image→Claude API→structured JSON
│   ├── bracket-scorer.ts          # Compare picks vs actual results → points
│   └── types.ts                   # Shared TypeScript types
├── components/
│   ├── BracketViewer.tsx          # Bracketry.js wrapper component
│   ├── ScoreOverlay.tsx           # Live score indicators on bracket
│   ├── UploadForm.tsx             # PDF drag-and-drop upload
│   └── StatusBar.tsx              # Points summary / leaderboard position
├── public/
├── package.json
├── vite.config.ts
├── Dockerfile
└── docker-compose.yml
```

## Design: Calm Vibes (Zen Browser-inspired)

Minimal, spacious, and quiet — not the typical loud sports aesthetic.

**Color palette (dark mode default, light mode supported):**
- Background: `#1a1a2e` (deep navy) / light: `#f8f7f4` (warm off-white)
- Surface/cards: `#16213e` (darker navy) / light: `#ffffff`
- Accent: `#e2c2a2` (warm sand/muted gold — calmer than sports orange)
- Correct pick: `#7eb89a` (sage green)
- Eliminated: `#c47a7a` (muted rose, not aggressive red)
- Pending: `#6b7280` (quiet gray)
- Text primary: `#e8e6e3` / light: `#2d2d2d`
- Text secondary: `#9ca3af` / light: `#6b7280`

**Typography:**
- Font: `Inter` (clean, modern, excellent readability) with system font fallback
- Generous line-height (1.6), relaxed letter-spacing
- Headers: semi-bold (600), body: regular (400)

**Components:**
- Rounded corners: `0.75rem` on cards, `0.5rem` on buttons/inputs
- Soft shadows: `0 4px 6px -1px rgb(0 0 0 / 0.1)`
- Smooth transitions: `0.2s ease-in-out` on hover states
- Cards with subtle borders (`1px solid` at 10% opacity)
- Generous padding: `1.5rem` on cards, `1rem` on smaller elements

**Layout:**
- Max-width container (`1200px`) centered with ample side margins
- Minimal navigation — simple top bar with app name + 2-3 links
- The bracket view is full-width for readability, with horizontal scroll on mobile
- Upload page is centered with a large, inviting drop zone

**Motion:**
- Subtle fade-in on page transitions
- Gentle pulse on live game scores (breathing animation, not flashing)
- Smooth color transitions when pick status changes

## Implementation Plan

### Phase 0: Scaffolding ✅

**PR #0 — [PR #1](https://github.com/kingscott/march-calmness/pull/1) (draft)**

- [x] Initialize Next.js 16 App Router project with pnpm
- [x] Install all dependencies: `better-sqlite3`, `@anthropic-ai/sdk`, `bracketry`, `swr`, `pdf-to-img`
- [x] Add `vinext` + `@vitejs/plugin-rsc` for Vite-based dev server
- [x] Create `lib/types.ts` with all shared TypeScript types (bracket picks, game results, scoring)
- [x] Create `lib/db.ts` with SQLite setup (WAL mode) and both table schemas
- [x] Create `app/layout.tsx` with root layout, Inter font, top nav
- [x] Create `app/globals.css` with full color palette, design tokens, component classes
- [x] Stub out pages: `app/page.tsx`, `app/upload/page.tsx`, `app/bracket/page.tsx`
- [x] `pnpm dev` launches successfully on port 3000

---

### Phase 1: Parallel PRs (all independent — can run as concurrent agents)

**PR #1: ESPN client + background poller** `lib/espn.ts`, `lib/poller.ts`, `app/api/scores/route.ts`

- [ ] `lib/espn.ts`: ESPN API client
  - Fetch `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?dates=YYYYMMDD&groups=50&limit=100`
  - Parse response: team names, scores, game status (pre/in/post), round from `notes[].headline`
  - Filter tournament games via `competitions[].type.abbreviation === "TRNMNT"`
- [ ] `lib/poller.ts`: Background polling loop (`setInterval` in server process)
  - 2-minute interval during active game hours, 15-minute otherwise
  - Upsert each game into `games` table; skip re-fetching games with `status = 'final'`
  - Poll multiple days during the tournament window
- [ ] `GET /api/scores`: reads from SQLite only. Supports `?live=true` filter.

**PR #2: PDF parser + Claude integration** `lib/bracket-parser.ts`, `app/api/bracket/upload/route.ts`

- [ ] `POST /api/bracket/upload`: accepts multipart form (PDF file + bracket name)
- [ ] Convert PDF first page to PNG via `pdf-to-img`
- [ ] Send to Claude API with structured extraction prompt:
  ```
  Extract all bracket picks... Return JSON: { regions: { "<name>": { round1: [...], round2: [...], sweet16: [...], elite8: "..." } }, final_four: [...], champion: "..." }
  ```
- [ ] Validate: every round N+1 pick must be one of two teams from the corresponding round N matchup
- [ ] Store in `brackets` table
- [ ] Also: `GET /api/brackets` (list all), `GET /api/bracket/[id]` (get one), `DELETE /api/bracket/[id]`

**PR #3: Bracket visualization component** `components/BracketViewer.tsx`

- [x] `"use client"` component wrapping Bracketry.js
- [x] Single `useEffect` with cleanup for mounting/unmounting the Bracketry instance on a ref div
- [x] Bracketry's `.applyMatchesUpdates()` for live updates without re-mount
- [x] Accepts props: `picks` (user's bracket), `games` (actual results)
- [x] Color-codes picks: sage green (correct), muted rose (eliminated), quiet gray (pending)
- [x] Breathing animation on live game scores (via `getMatchTopHTML` Live indicator)
- [x] Can be developed and tested with hardcoded mock data — visit `/bracket/mock`

---

### Phase 2: Integration (depends on Phase 1 — can partially parallelize)

**PR #4: Scoring engine** `lib/bracket-scorer.ts`, `app/api/bracket/[id]/status/route.ts`
- *Depends on*: types from PR #0, game data format from PR #1, bracket data format from PR #2
- [ ] Compare user picks against completed games
- [ ] Scoring: 10 (R64), 20 (R32), 40 (S16), 80 (E8), 160 (F4), 320 (CHIP)
- [ ] Returns: correct picks, wrong picks, pending, total points, max possible remaining
- [ ] `GET /api/bracket/:id/status` endpoint

**PR #5: Upload page UI** `app/upload/page.tsx`, `components/UploadForm.tsx`
- *Depends on*: PR #2 (upload API), PR #3 (bracket viewer for preview)
- [ ] Drag-and-drop PDF upload with name field
- [ ] Progress states: uploading → parsing → validating → done
- [ ] After parsing, renders `BracketViewer` with extracted picks for user review before saving
- [ ] "Save" button to confirm, or "Try Again" to re-upload

**PR #5 and #4 can run in parallel** — they depend on different Phase 1 PRs.

---

### Phase 3: Assembly (depends on Phase 2)

**PR #6: Dashboard + bracket switcher** `app/page.tsx`, `app/bracket/page.tsx`, `components/StatusBar.tsx`
- *Depends on*: PR #3 (viewer), PR #4 (scoring), PR #5 (upload exists)
- [ ] Home page: bracket switcher (dropdown/tabs), per-bracket score summary cards, comparison view across all brackets
- [ ] Bracket page: full bracket viewer with SWR polling (`refreshInterval: 30000`) for live scores
- [ ] Today's games list with your pick for the selected bracket
- [ ] Delete bracket button

**PR #7: Design polish pass**
- *Can run in parallel with PR #6 or after*
- [ ] Apply calm vibes design system across all pages
- [ ] Dark/light mode toggle with `prefers-color-scheme` detection
- [ ] Subtle fade-in page transitions
- [ ] Breathing animation on live scores
- [ ] Responsive layout: horizontal scroll bracket on mobile
- [ ] Final CSS pass for consistent spacing, shadows, rounded corners

---

### Phase 4: Deployment

**PR #8: Docker setup** `Dockerfile`, `docker-compose.yml`
- *Can start anytime after PR #0, finalize after PR #7*
- [ ] Multi-stage Dockerfile: build with `NITRO_PRESET=node`, run `node .output/server/index.mjs`
- [ ] `docker-compose.yml` with volume for SQLite persistence
- [ ] `ANTHROPIC_API_KEY` environment variable

---

### Dependency Graph

```
PR #0 (scaffolding) ✅
  ├── PR #1 (ESPN poller)      ─┐
  ├── PR #2 (PDF parser)       ─┼── all parallel
  └── PR #3 (bracket viewer)   ─┘
        │         │        │
        │    PR #4 (scoring)    PR #5 (upload UI)  ── partial parallel
        │         │                    │
        └─────────┴────────────────────┘
                       │
                  PR #6 (dashboard)
                  PR #7 (design polish)  ── can parallel with #6
                       │
                  PR #8 (docker)
```

## Verification

- [x] `vinext dev` starts the dev server successfully
- [ ] Upload a sample bracket PDF → Claude parses it → picks appear in bracket viewer
- [ ] Bracket viewer renders all 63 games with correct matchup structure
- [ ] `/api/scores` returns current ESPN tournament data
- [ ] Bracket viewer color-codes picks based on actual results
- [ ] `docker compose up` runs the self-hosted app successfully
- [ ] Scores auto-refresh every 2 minutes in the browser
