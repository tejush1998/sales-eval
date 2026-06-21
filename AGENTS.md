# Sales Call Evaluator — Agent Guide

## Quick start
```bash
cp .env.example .env          # fill in SARVAM_API_KEY, OPENROUTER_API_KEY
npm install
npm run dev                   # concurrently: backend :4000 + frontend :5173
```

## Commands
| Command | Action |
|---|---|
| `npm run dev` | Both servers (backend `node --watch`, frontend Vite) |
| `npm run dev:backend` | Express only on `:4000` |
| `npm run dev:frontend` | Vite only on `:5173` |
| `npm run test:e2e` | Puppeteer E2E (needs both servers up) |
| `HEADLESS=false npm run test:e2e` | Watch tests in real browser |
| `E2E_TIMEOUT_MS=600000 npm run test:e2e` | Bump wait for slow networks |
| `npm run build` | Prod build frontend to `frontend/dist/` |
| `npm start` | Production server (serves API + static frontend) |

## Architecture
- **npm workspaces**: `backend/`, `frontend/`, `tests/` — root `package.json` has workspace scripts
- **`.env` lives at project root**, loaded by backend via `dotenv` walking up directories
- **ESM everywhere** (`"type": "module"` in all packages)
- **DB**: file-based JSON at `backend/src/data/db.json` (auto-created, gitignored)
- **Frontend Vite proxy**: `/api` → `http://localhost:4000` (configurable via `VITE_API_TARGET`)
- **Pipeline**: URL → YouTube download + ffmpeg (mono/16kHz/mp3) → Sarvam `saaras:v3` (hi-IN, diarized) → OpenRouter DeepSeek (5 criteria, `json_object`) → db.json

## Production (Render)
- **Build**: `npm install && npm run build` — builds frontend to `frontend/dist/`
- **Start**: `npm start` — runs backend only; serves API + static frontend on one port
- **No .env needed** on Render — set env vars in Render dashboard
- **Frontend Vite proxy is dev-only** — in production the backend serves static files
- **DB resets on restart** — file-based JSON at `backend/src/data/db.json` is ephemeral on Render

## Key quirks
- **Backend temp files** go to `tmp/<nanoid>/` — cleaned up after completion
- **`backend/src/services/db.js`** uses sync `fs` (fine for single-user, no-concurrency use)
- **Sarvam cost** computed as `SARVAM_PRICE_PER_HOUR_INR * (lengthSeconds / 3600)`
- **OpenRouter cost** comes from response `usage.cost` field (nullable)
- **E2E test** waits for submit button to re-enable (not a specific element), then asserts `[data-testid="results"]`
- **Puppeteer Chromium** auto-downloads on `npm install` in tests workspace; ~500 MB disk needed

## API
| Method | Path | Notes |
|---|---|---|
| `POST /api/evaluate` | `{"url":"..."}` | ~1–3 min, returns full record |
| `GET /api/evaluate/:id` | — | Single record |
| `GET /api/history` | — | Newest first |
| `GET /api/health` | — | `{ ok, evaluations }` |

## E2E test details
- Screenshots go to `tests/screenshots/`
- Test URL: `https://www.youtube.com/watch?v=eoTPt3XNHmk`
- Writes `summary.json` with title, score, criteria/turn counts, screenshots list
- Exit code `0` = pass, `1` = fail

## Conventions
- `data-testid` attributes on key elements (`evaluate-form`, `yt-url-input`, `submit-btn`, `results`, `video-title`, `overall-score`, `criteria`, `turns`, `status`)
- Error classes: `card.error` in frontend
- No test framework — raw Node.js scripts
- **Audio upload** is the default mode; switch to YouTube mode by clicking `.mode-btn` with "YouTube" text
