# March Calmness

A self-hosted March Madness bracket tracker with a quiet, minimal aesthetic. Upload a filled-in bracket PDF, watch Claude extract your picks, and follow along with live ESPN scores — all without the noise of a typical sports app.

## Features

- **PDF bracket upload** — drag-and-drop your bracket PDF; Claude Vision parses it into structured picks
- **Live scores** — ESPN's public API polled every 2 minutes during active game windows
- **Bracket visualization** — full 63-game bracket via [Bracketry.js](https://bracketry.app/), color-coded by pick status
- **Scoring engine** — tracks correct/eliminated/pending picks and max possible points remaining
- **Self-hosted** — SQLite storage, no external database, runs as a single Node.js process
- **Dark mode default** — calm, Zen-inspired design with light mode support

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) + [vinext](https://github.com/cloudflare/vinext) dev server |
| Styling | Tailwind CSS v4 + CSS custom properties |
| Storage | SQLite via `better-sqlite3` |
| PDF parsing | `pdf-to-img` → Claude API vision |
| Live scores | ESPN undocumented scoreboard API |
| Bracket UI | Bracketry.js |
| Data fetching | SWR |

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm (`curl -fsSL https://get.pnpm.io/install.sh | sh -`)
- An [Anthropic API key](https://console.anthropic.com/) (for PDF parsing)

### Development

```bash
pnpm install
cp .env.example .env.local   # add your ANTHROPIC_API_KEY
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

```
ANTHROPIC_API_KEY=sk-ant-...   # required for PDF bracket parsing
DB_PATH=./data.db              # optional, defaults to ./data.db
```

## Project Structure

```
app/
  layout.tsx          # Root layout — nav, Inter font, CSS tokens
  page.tsx            # Dashboard — bracket switcher + score summaries
  upload/page.tsx     # PDF upload + Claude parse + preview
  bracket/page.tsx    # Full bracket viewer with live scores
  api/
    brackets/         # GET  /api/brackets
    bracket/
      upload/         # POST /api/bracket/upload
      [id]/           # GET, DELETE /api/bracket/:id
        status/       # GET /api/bracket/:id/status
    scores/           # GET /api/scores

lib/
  types.ts            # Shared TypeScript types
  db.ts               # SQLite setup + queries
  espn.ts             # ESPN API client + caching
  poller.ts           # Background score polling loop
  bracket-parser.ts   # PDF → image → Claude → structured JSON
  bracket-scorer.ts   # Compare picks vs results → points

components/
  BracketViewer.tsx   # Bracketry.js wrapper
  UploadForm.tsx      # Drag-and-drop PDF form
  StatusBar.tsx       # Points summary
  ScoreOverlay.tsx    # Live score indicators
```

## Scoring

| Round | Points |
|---|---|
| Round of 64 | 10 |
| Round of 32 | 20 |
| Sweet 16 | 40 |
| Elite 8 | 80 |
| Final Four | 160 |
| Championship | 320 |

## Docker (coming in a later PR)

```bash
docker compose up
```

SQLite data is persisted via a named volume. Set `ANTHROPIC_API_KEY` in your environment or a `.env` file.

## Implementation Status

- [x] Phase 0 — Scaffolding, types, DB schema, design system, stub pages
- [ ] Phase 1 — ESPN client + poller, PDF parser, bracket viewer component
- [ ] Phase 2 — Scoring engine, upload UI
- [ ] Phase 3 — Dashboard, bracket page, design polish
- [ ] Phase 4 — Docker setup
