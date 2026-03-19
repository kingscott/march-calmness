# March Madness Bracket Tracker

## Context

You want a self-hosted web app to: (1) upload a digitally-filled bracket PDF, (2) parse it into structured picks, (3) visualize the bracket, and (4) pull live scores every few minutes to track how your bracket is doing.

## Tech Stack

- **Framework**: [vinext](https://github.com/cloudflare/vinext) (Vite-based Next.js reimplementation)
- **Deployment**: Cloudflare Workers + D1 via `vinext deploy`
- **Bracket visualization**: [Bracketry.js](https://bracketry.app/) (framework-agnostic, 12kb gzip, MIT, active maintenance)
- **PDF parsing**: Claude API vision (convert PDF page to image, send to Claude to extract picks as structured JSON)
- **Live scores**: ESPN undocumented API (free, no API key, returns JSON)
- **Data storage**: Cloudflare D1 (SQLite at the edge — `wrangler.jsonc` + `migrations/`)

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   Browser                        │
│  ┌───────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ Upload PDF│  │ Bracket  │  │  Score bar   │  │
│  │   Page    │  │  Viewer  │  │  (client)    │  │
│  └─────┬─────┘  └────┬─────┘  └──────┬───────┘  │
│        │              │               │          │
│        │    polls every 30s           │          │
└────────┼──────────────┼───────────────┼──────────┘
         │              │               │
    ┌────┴──────────────┴───────────────┴────┐
    │           vinext API Routes             │
    │  POST /api/bracket/upload               │
    │  GET  /api/brackets                     │
    │  GET  /api/bracket/:id                  │
    │  DELETE /api/bracket/:id                │
    │  GET  /api/scores                       │
    └────┬──────────────┬───────────────┬────┘
         │              │               │
    ┌────┴────┐   ┌─────┴─────┐   ┌────┴────┐
    │ Claude  │   │Cloudflare │   │  ESPN   │
    │  API    │   │    D1     │   │  API    │
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
│   │   ├── page.tsx               # Bracket viewer with live scores + score bar
│   │   └── mock/page.tsx          # Mock data dev page
│   └── api/
│       ├── brackets/
│       │   └── route.ts           # GET: list all brackets
│       ├── bracket/
│       │   ├── upload/route.ts    # POST: accept PDF + name, parse via Claude, store picks
│       │   └── [id]/
│       │       └── route.ts       # GET: return bracket picks; DELETE: remove bracket
│       └── scores/
│           └── route.ts           # GET: fetch games from D1
├── lib/
│   ├── db.ts                      # D1 queries
│   ├── espn.ts                    # ESPN API client + normalization
│   ├── poller.ts                  # Background ESPN polling loop
│   ├── bracket-parser.ts          # PDF→image→Claude API→structured JSON
│   ├── mock-data.ts               # Hardcoded mock bracket + games for dev
│   └── types.ts                   # Shared TypeScript types
├── components/
│   ├── BracketViewer.tsx          # Bracketry.js wrapper component
│   ├── UploadForm.tsx             # PDF drag-and-drop upload
│   └── DeleteButton.tsx           # Client island for bracket deletion
├── worker/
│   └── index.ts                   # Cloudflare Worker entry point
├── migrations/
│   └── 0001_initial_schema.sql    # D1 schema (brackets + games tables)
├── instrumentation.ts             # Starts ESPN poller on server init
├── wrangler.jsonc                 # Cloudflare Workers config
└── package.json
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

**Motion:**
- Subtle fade-in on page transitions
- Gentle pulse on live game scores (breathing animation, not flashing)
- Smooth color transitions when pick status changes

## Implementation Status

### Phase 0: Scaffolding ✅ DONE

- [x] Initialize Next.js 16 App Router project with pnpm
- [x] Add `vinext` + `@vitejs/plugin-rsc` for Vite-based dev server
- [x] Create `lib/types.ts` with all shared TypeScript types
- [x] Create `lib/db.ts` with D1 query helpers
- [x] Create `app/layout.tsx` with root layout, Inter font, top nav
- [x] Create `app/globals.css` with full color palette, design tokens, component classes
- [x] `pnpm dev` launches successfully

---

### Phase 1: Core Features ✅ DONE

**ESPN client + background poller** — `lib/espn.ts`, `lib/poller.ts`, `app/api/scores/route.ts`

- [x] `lib/espn.ts`: ESPN scoreboard API client
  - Fetches tournament games, normalizes round strings (`'1st Round'` → `'round1'` etc.)
  - Filters out NIT games
- [x] `lib/poller.ts`: Background polling loop via `setInterval` in `instrumentation.ts`
  - Smart interval: 2 min during game hours, 15 min otherwise
  - Upserts into D1 `games` table
- [x] `GET /api/scores`: reads from D1

**PDF parser + bracket CRUD** — `lib/bracket-parser.ts`, bracket API routes

- [x] `POST /api/bracket/upload`: multipart form (PDF + name) → pdf-to-img → Claude vision → structured JSON picks
- [x] `GET /api/brackets`: list all brackets
- [x] `GET /api/bracket/[id]`: get one bracket with picks
- [x] `DELETE /api/bracket/[id]`: remove bracket

**BracketViewer component** — `components/BracketViewer.tsx`

- [x] `"use client"` component wrapping Bracketry.js
- [x] Single `useEffect` with cleanup for mounting/unmounting
- [x] Bracketry's `.applyMatchesUpdates()` for live updates without re-mount
- [x] Color-codes picks: sage green (correct), muted rose (eliminated), sand (pending), gray (not picked)
- [x] Live game indicator via `getMatchTopHTML`
- [x] Dev mock page at `/bracket/mock`

---

### Phase 2: Upload UI + Scoring ✅ DONE

**Upload page** — `app/upload/page.tsx`, `components/UploadForm.tsx`

- [x] Drag-and-drop PDF upload with name field
- [x] Progress states: uploading → parsing → done
- [x] After parsing, renders `BracketViewer` with extracted picks for review

**Scoring** — inlined in `app/bracket/page.tsx`

- [x] `scorePicksAgainstGames()` runs client-side
- [x] Shows correct / out / pending counts + animated progress bar
- [x] Live game count indicator with `live-pulse` animation
- [x] SWR polling every 30s

> `lib/bracket-scorer.ts` and `/api/bracket/:id/status` from the original plan were
> not built. Scoring is computed client-side instead, which is simpler for a single-user app.

---

### Phase 3: Dashboard + Assembly ✅ DONE

**Dashboard** — `app/page.tsx`

- [x] Lists all brackets with name, upload date, View/Delete actions
- [x] Empty state with upload CTA
- [x] `components/DeleteButton.tsx` client island

**Bracket page** — `app/bracket/page.tsx`

- [x] Full bracket viewer with SWR polling every 30s
- [x] Score bar (correct/out/pending + progress bar) shown once games are available
- [x] Live game count indicator, pick legend, back-to-dashboard link

---

### Phase 4: Deployment ✅ DONE (Cloudflare)

- [x] `wrangler.jsonc` with D1 binding and worker entry
- [x] `migrations/0001_initial_schema.sql` for D1 schema
- [x] `instrumentation.ts` starts ESPN poller on server init
- [x] `pnpm deploy` → `vinext deploy` → Cloudflare Workers

> Original Docker/Nitro self-hosting plan is obsolete. Cloudflare Workers + D1 is the deployment target.

---

### Remaining / Nice-to-have

- **Dashboard score cards**: Show per-bracket correct/out/pending summary on dashboard cards without navigating to the bracket page (requires client-side SWR on dashboard or a `/api/bracket/:id/status` endpoint)
- **Design polish**: Page-enter fade animations, responsive bracket horizontal scroll on mobile
- **Test coverage**: `lib/__tests__/espn.test.ts` exists; add coverage for bracket-parser and scoring logic

---

### Dependency Graph (as-built)

```
Phase 0 (scaffolding) ✅
  ├── Phase 1a: ESPN poller      ✅
  ├── Phase 1b: PDF parser       ✅
  └── Phase 1c: BracketViewer    ✅
        │            │
  Phase 2a: Upload UI ✅   Phase 2b: Scoring (client-side) ✅
        │            │
        └────────────┴──── Phase 3: Dashboard + Bracket page ✅
                                       │
                                 Cloudflare deploy ✅
```

## Verification

- [x] `vinext dev` starts the dev server successfully
- [x] Upload a bracket PDF → Claude parses it → picks appear in bracket viewer
- [x] Bracket viewer renders all 63 games with correct matchup structure
- [x] `/api/scores` returns current ESPN tournament data
- [x] Bracket viewer color-codes picks based on actual results
- [x] Scores auto-refresh every 30s in the browser
- [ ] `pnpm deploy` deploys to Cloudflare Workers successfully
