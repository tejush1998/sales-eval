import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function findEnvFile(startDir) {
  let dir = startDir;
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(dir, '.env');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

const envFile = findEnvFile(__dirname);
if (envFile) dotenv.config({ path: envFile });

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { evaluateRouter } from './routes/evaluate.js';
import { historyRouter } from './routes/history.js';
import { authRouter } from './routes/auth.js';
import { requireAuth } from './middleware/auth.js';
import { db } from './services/db.js';

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';

console.log('[env]', JSON.stringify({
  envFile: envFile || '<none>',
  sarvam: process.env.SARVAM_API_KEY ? `set (${process.env.SARVAM_API_KEY.length} chars)` : 'MISSING',
  openrouter: process.env.OPENROUTER_API_KEY ? `set (${process.env.OPENROUTER_API_KEY.length} chars)` : 'MISSING',
  model: process.env.OPENROUTER_MODEL || '<unset, will use default>',
}));

app.use(cors({ origin: FRONTEND_ORIGIN.split(','), credentials: false }));
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));
app.use(cookieParser(process.env.SESSION_SECRET));

app.get('/api/health', (_req, res) => res.json({ ok: true, evaluations: db.count() }));

app.use('/api/auth', authRouter);
app.use('/api/evaluate', requireAuth, evaluateRouter);
app.use('/api/history', requireAuth, historyRouter);

const distPath = path.join(__dirname, '..', '..', 'frontend', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

app.use((err, _req, res, _next) => {
  console.error('[error]', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`[backend] listening on http://localhost:${PORT}`);
});
