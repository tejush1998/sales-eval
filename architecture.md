# Sales Call Evaluator — Architecture

A sales call evaluation platform that takes a YouTube URL, downloads the audio, transcribes Hindi audio into English with speaker diarization (Sarvam `saaras:v3`), and rates the call on 5 sales-quality criteria using DeepSeek via OpenRouter.

## Tech Stack

- **Runtime**: Node.js 18+ (ES modules, `"type": "module"`)
- **Backend**: Express 4, Axios, Morgan
- **YouTube download**: `@distube/ytdl-core` (pure JS, maintained fork of `ytdl-core`) + `ffmpeg-static` for audio extraction to mono 16 kHz mp3
- **Transcription**: `sarvamai` SDK — `speechToTextJob` with `withDiarization: true`
- **Rating**: OpenRouter Chat Completions (`deepseek/deepseek-v4-flash`) with `response_format: json_object`
- **Frontend**: React 18 + Vite 8 (proxies `/api` → backend)
- **DB**: File-based JSON store at `backend/src/data/db.json`
- **Monorepo**: npm workspaces + `concurrently` for dev
- **E2E tests**: Puppeteer 24

## Folder Structure

```
sales-app/
├── package.json                 # workspaces + dev script (concurrently)
├── .env / .env.example          # SARVAM_API_KEY, OPENROUTER_API_KEY, …
├── specs.md                     # original spec
│
├── backend/
│   ├── package.json
│   └── src/
│       ├── server.js            # Express bootstrap, CORS, error handler
│       ├── routes/
│       │   ├── evaluate.js      # POST /api/evaluate, GET /api/evaluate/:id
│       │   └── history.js       # GET /api/history
│       ├── services/
│       │   ├── youtube.js       # validate URL, fetch meta, download + transcode to mp3
│       │   ├── sarvam.js        # speech-to-text batch job + diarization, parse JSON
│       │   ├── openrouter.js    # build prompt, call DeepSeek, parse JSON response
│       │   └── db.js            # read/write JSON file
│       └── data/
│           └── db.json          # auto-created on first run
│
├── frontend/
│   ├── package.json
│   ├── vite.config.js           # proxy /api → http://localhost:4000
│   ├── index.html
│   ├── public/favicon.svg
│   └── src/
│       ├── main.jsx
│       ├── App.jsx              # state: current result, history, loading, status
│       ├── App.css
│       └── components/
│           ├── EvaluateForm.jsx # URL input + sample button + live status
│           ├── ResultsView.jsx  # score, criteria bars, strengths/improvements, transcript
│           └── HistoryList.jsx  # past evaluations, click to re-view
│
├── tests/
│   ├── package.json
│   └── puppeteer.test.js        # end-to-end test, writes screenshots + summary.json
│
└── assets/                      # reserved for static assets
```

## Pipeline

```
User pastes URL
     │
     ▼
React (EvaluateForm)            POST /api/evaluate
     │
     ▼
Express route handler           status = "downloading"
     │
     ├── youtube.js             ytdl → ffmpeg → mp3 (mono, 16 kHz, 64 kbps)
     │
     ├── sarvam.js              speechToTextJob (hi-IN, transcribe, withDiarization)
     │                          waits for completion, downloads JSON output,
     │                          parses diarized_transcript.entries
     │
     ├── openrouter.js          DeepSeek V4 Flash scores 5 criteria + summary
     │
     └── db.js                  persist record, status = "completed"
     │
     ▼
React (ResultsView)             renders overall score, per-criteria bars,
                                strengths, improvements, speaker-colored turns
```

## Data Model

`backend/src/data/db.json` is a single object:
```json
{
  "evaluations": [
    {
      "id": "abc1234567",
      "url": "https://www.youtube.com/watch?v=…",
      "status": "downloading | transcribing | rating | completed | failed",
      "createdAt": 1719000000000,
      "updatedAt": 1719000000000,
      "video":      { "title", "author", "lengthSeconds", "thumbnail" },
      "audio":      { "bytes": 1234567 },
      "transcription": {
        "requestId", "languageCode",
        "fullTranscript": "…",
        "turns": [ { "speaker", "text", "start", "end" }, … ]
      },
      "rating": {
        "overallScore": 0–100,
        "summary": "…",
        "criteria": [ { "name", "score", "max": 10, "reasoning" }, … ],
        "strengths": [ "…", … ],
        "improvements": [ "…", … ],
        "speakerInsights": [ { "speaker", "talkSharePct", "notes" }, … ]
      },
      "error": "optional, set when status=failed"
    }
  ]
}
```

The five rating criteria (defined in `backend/src/services/openrouter.js`):
1. Opening & Rapport
2. Needs Discovery
3. Value Proposition
4. Objection Handling
5. Closing & Next Steps

---

## Installation

### Prerequisites

- Node.js **18 or newer** (native `fetch`, `node --watch`)
- npm 9+ (workspaces)
- ~500 MB free disk (Chromium download for Puppeteer)
- Outbound HTTPS to `youtube.com`, `sarvam.ai`, `openrouter.ai`

### Steps

```bash
# from /Users/mac/Desktop/sales-app
cp .env.example .env
# edit .env and fill in:
#   SARVAM_API_KEY=...
#   OPENROUTER_API_KEY=...
#   OPENROUTER_MODEL=deepseek/deepseek-v4-flash   (default)
#   PORT=4000
#   FRONTEND_ORIGIN=http://localhost:5173

npm install
```

The install pulls:
- backend deps: `express`, `cors`, `morgan`, `dotenv`, `axios`, `nanoid`, `@distube/ytdl-core`, `ffmpeg-static`, `sarvamai`
- frontend deps: `react`, `react-dom`, `vite`, `@vitejs/plugin-react`
- test deps: `puppeteer` (Chromium auto-downloads on first run)
- root: `concurrently`

> If Chromium fails to download behind a firewall, set `PUPPETEER_SKIP_DOWNLOAD=true` and run `npx puppeteer browsers install chrome` manually later.

---

## Development

### Run both servers (recommended)

```bash
npm run dev
```

This starts:
- **Backend** at `http://localhost:4000` (via `node --watch src/server.js`)
- **Frontend** at `http://localhost:5173` (Vite dev server, proxies `/api` → backend)

Logs are color-coded: backend = blue, frontend = magenta. Press `Ctrl+C` once and `concurrently` will tear both down.

### Run individually

```bash
npm run dev:backend    # only Express on :4000
npm run dev:frontend   # only Vite on :5173
```

### File watching

- Backend uses Node's native `--watch` — any change under `backend/src/**` reloads automatically.
- Vite handles HMR for React components out of the box.

### Environment variables

Loaded from `/Users/mac/Desktop/sales-app/.env` (root, because `backend` runs with cwd at root via the workspace script). The backend also reads `process.cwd() + '/.env'` so you can keep a single env file at the project root.

| Var                  | Required | Default                              | Purpose                                          |
| -------------------- | -------- | ------------------------------------ | ------------------------------------------------ |
| `SARVAM_API_KEY`     | yes      | —                                    | Sarvam AI subscription key                       |
| `OPENROUTER_API_KEY` | yes      | —                                    | OpenRouter bearer token                          |
| `OPENROUTER_MODEL`   | no       | `deepseek/deepseek-v4-flash`         | Any OpenRouter model id                          |
| `PORT`               | no       | `4000`                               | Backend HTTP port                                |
| `FRONTEND_ORIGIN`    | no       | `http://localhost:5173`              | CORS allow-origin (comma-separated for multiple) |
| `VITE_API_TARGET`    | no       | `http://localhost:4000`              | Where Vite proxies `/api` (frontend dev only)    |

### API

| Method | Path                 | Body                            | Returns                                   |
| ------ | -------------------- | ------------------------------- | ----------------------------------------- |
| GET    | `/api/health`        | —                               | `{ ok, evaluations }`                     |
| POST   | `/api/evaluate`      | `{ "url": "<youtube-url>" }`   | full evaluation record (may take ~1–3 min)|
| GET    | `/api/evaluate/:id`  | —                               | single record                             |
| GET    | `/api/history`       | —                               | `{ evaluations: [...] }` (newest first)   |

Errors return `{ "error": "..." }` with appropriate status codes (400 invalid URL, 404 missing record, 502 upstream API failure, 500 internal).

---

## Running

### Production build of frontend

```bash
npm run build -w frontend       # outputs to frontend/dist/
npm run preview -w frontend     # serve the dist build locally
```

### Run backend without Vite (e.g. behind a reverse proxy)

```bash
npm start                       # alias for `npm run dev -w backend`
```

In this mode, point a reverse proxy (nginx, Caddy, etc.) at port 4000 and serve `frontend/dist/` as static assets.

### End-to-end test (Puppeteer)

Start both dev servers in one terminal (`npm run dev`), then in another:

```bash
npm run test:e2e
```

What it does:
1. Launches headless Chromium.
2. Opens `http://localhost:5173` (override with `FRONTEND_URL=…`).
3. Types the sample YouTube URL from `specs.md`.
4. Submits the form and waits for the button to re-enable (up to `E2E_TIMEOUT_MS` ms, default 4 min).
5. Captures screenshots at every step into `tests/screenshots/`:
   - `01-empty.png` — initial page
   - `02-filled.png` — URL typed in
   - `03-loading.png` — mid-pipeline
   - `04-results.png` — final results
   - `05-results-bottom.png` — scrolled to bottom (headless only)
   - `fail.png` — only on failure
6. Writes `tests/screenshots/summary.json` with title, overall score, criteria count, turn count, screenshot list.

Useful env knobs:

```bash
HEADLESS=false npm run test:e2e          # watch it run in a real browser
E2E_TIMEOUT_MS=600000 npm run test:e2e   # bump the wait timeout for slow networks
FRONTEND_URL=http://localhost:5173 npm run test:e2e
```

Exit code `0` on success, `1` on failure — suitable for CI.

---

## Troubleshooting

- **"SARVAM_API_KEY is not set"** — make sure `.env` is at the project root and contains the key. The backend loads `dotenv/config` at boot.
- **"Invalid YouTube URL"** — the URL must match what `@distube/ytdl-core` accepts (`youtube.com/watch?v=…`, `youtu.be/…`, etc.).
- **ffmpeg errors** — `ffmpeg-static` ships a precompiled binary; if you see `ffmpeg exited 1`, try removing `node_modules/ffmpeg-static` and reinstalling.
- **Sarvam job times out** — Hindi audio that is mostly music/silence will produce an empty diarized transcript. The OpenRouter step will then fail with "Empty transcript provided".
- **CORS errors in browser** — set `FRONTEND_ORIGIN` in `.env` to include your frontend's origin (comma-separated for multiple).
- **Puppeteer won't launch Chromium** — `rm -rf ~/.cache/puppeteer` and re-run, or `npx puppeteer browsers install chrome`.
