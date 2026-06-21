# Saleval — Sales Call Evaluator

Paste a YouTube sales-call URL. Saleval downloads the audio, transcribes Hindi calls into English with speaker diarization, and scores the call across 5 sales-quality criteria using AI.

Built with Express, React + Vite, Sarvam AI (transcription), and OpenRouter (DeepSeek).

## How it works

```
URL → YouTube audio (mp3) → Sarvam saaras:v3 transcription + diarization → DeepSeek rating → results
```

1. Enter a YouTube URL
2. Audio is downloaded and converted to mono 16 kHz mp3
3. Sarvam transcribes Hindi audio to English diarized text
4. DeepSeek (via OpenRouter) rates the call on 5 criteria
5. Results show overall score, per-criteria breakdown, strengths, improvements, and the full transcript

## Quick start

```bash
cp .env.example .env
# Edit .env — set SARVAM_API_KEY and OPENROUTER_API_KEY

npm install
npm run dev
```

Frontend at `http://localhost:5173`, backend at `http://localhost:4000`.

### Production (Render)

```bash
# Render build command
npm install && npm run build

# Render start command
npm start
```

Set env vars (`SARVAM_API_KEY`, `OPENROUTER_API_KEY`, etc.) in the Render dashboard — no `.env` file needed. The backend serves both the API and the built frontend on a single port.

## Requirements

- Node.js 18+
- npm 9+
- ~500 MB disk for Puppeteer Chromium (tests only)

## API

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/evaluate` | Submit a YouTube URL for evaluation |
| `GET` | `/api/evaluate/:id` | Get a single evaluation |
| `GET` | `/api/history` | List past evaluations (newest first) |

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Run both backend + frontend |
| `npm run dev:backend` | Backend only on `:4000` |
| `npm run dev:frontend` | Frontend only on `:5173` |
| `npm run build` | Production build frontend to `frontend/dist/` |
| `npm start` | Production server (API + frontend on one port) |
| `npm run test:e2e` | End-to-end test (Puppeteer) |

## Tech stack

- **Backend**: Express, `@distube/ytdl-core`, `ffmpeg-static`, `sarvamai`, OpenRouter API
- **Frontend**: React 18, Vite 8
- **DB**: File-based JSON (`backend/src/data/db.json`)
- **Tests**: Puppeteer 24
- **Monorepo**: npm workspaces, ESM everywhere

## Project structure

```
├── backend/          Express API server
│   └── src/
│       ├── server.js
│       ├── routes/   evaluate, history
│       └── services/ youtube, sarvam, openrouter, db
├── frontend/         React + Vite SPA
│   └── src/
│       ├── App.jsx
│       └── components/ EvaluateForm, ResultsView, HistoryList, TimingsPanel
└── tests/            Puppeteer E2E
```

## License

MIT
