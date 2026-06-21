import fs from "node:fs";
import fsp from "node:fs/promises";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { Router } from "express";
import { nanoid } from "nanoid";
import multer from "multer";
import ffmpegPath from "ffmpeg-static";
import { db } from "../services/db.js";
import {
  downloadAudioAsMp3,
  getVideoMeta,
  YouTubeError,
} from "../services/youtube.js";
import { transcribeWithDiarization, SarvamError } from "../services/sarvam.js";
import { rateTranscript, OpenRouterError } from "../services/openrouter.js";

function ndjsonStream(res) {
  res.writeHead(200, {
    'Content-Type': 'application/x-ndjson',
    'Transfer-Encoding': 'chunked',
  });
  return (msg) => res.write(JSON.stringify(msg) + '\n');
}

export const evaluateRouter = Router();

const TMP_ROOT = path.join(process.cwd(), "tmp");
const UPLOADS_DIR = path.join(TMP_ROOT, "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const upload = multer({ dest: UPLOADS_DIR,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("audio/")) return cb(null, true);
    cb(new Error("Only audio files are allowed"));
  },
});

function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("data", (d) => hash.update(d));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

function getAudioDurationSeconds(filePath) {
  const result = spawnSync(ffmpegPath, ['-i', filePath], { encoding: 'utf8' });
  const match = result.stderr.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
  if (match) {
    const [, h, m, s] = match;
    return Number(h) * 3600 + Number(m) * 60 + Number(s);
  }
  return null;
}

function nowMs() { return Date.now(); }
function elapsed(start) { return nowMs() - start; }
function fmtMs(ms) { return Number(ms || 0).toFixed(0); }

evaluateRouter.post("/", upload.single("audio"), async (req, res, next) => {
  const id = nanoid(10);
  const workDir = path.join(TMP_ROOT, id);
  const outDir = path.join(workDir, "sarvam-out");
  const t0 = nowMs();
  const timings = { totalMs: 0, metaMs: 0, downloadMs: 0, transcribeMs: 0, rateMs: 0 };
  const USD_TO_INR = Number(process.env.OPENROUTER_USD_TO_INR) || 86;
  const costs = {
    sarvam: null,
    sarvamCurrency: "INR",
    sarvamRatePerHourINR: Number(process.env.SARVAM_PRICE_PER_HOUR_INR) || 45,
    sarvamLengthSeconds: null,
    openrouter: null,
    openrouterCurrency: "INR",
    openrouterUSD: null,
    usdToInrRate: USD_TO_INR,
  };

  function computeSarvamCostINR(lengthSeconds) {
    if (!lengthSeconds || lengthSeconds <= 0) return null;
    const hours = lengthSeconds / 3600;
    return Number((hours * costs.sarvamRatePerHourINR).toFixed(4));
  }

  function buildRecord(status, extra = {}) {
    return {
      id, status,
      ...(req.file ? { audioSource: "upload", originalName: req.file.originalname } : { url: req.body?.url }),
      timings: {
        ...timings,
        metaMs: fmtMs(timings.metaMs),
        downloadMs: fmtMs(timings.downloadMs),
        transcribeMs: fmtMs(timings.transcribeMs),
        rateMs: fmtMs(timings.rateMs),
        totalMs: fmtMs(timings.totalMs),
      },
      costs,
      createdAt: t0,
      updatedAt: nowMs(),
      ...extra,
    };
  }

  function save(status, extra = {}) {
    return db.save(buildRecord(status, extra));
  }

  try {
    await fsp.mkdir(workDir, { recursive: true });

    const isFileUpload = !!req.file;
    let transcription;
    let audio;
    let meta;
    let cached;
    let fileHash;

    if (isFileUpload) {
      const filePath = req.file.path;
      const stats = await fsp.stat(filePath);
      fileHash = await hashFile(filePath);
      cached = db.findByFileHash(fileHash);

      if (cached) {
        transcription = cached.transcription;
        audio = cached.audio || null;
        meta = cached.video || { title: req.file.originalname };
        timings.transcribeMs = 0;
        costs.sarvam = 0;
        costs.sarvamLengthSeconds = 0;
        save("rating", { video: meta, audio, transcription, fileHash, cached: true, audioSource: "upload", originalName: req.file.originalname });
      } else {
        audio = { bytes: stats.size, originalname: req.file.originalname, mimetype: req.file.mimetype };
        meta = { title: req.file.originalname, filename: req.file.originalname };
        const duration = getAudioDurationSeconds(filePath);
        if (duration) {
          costs.sarvamLengthSeconds = duration;
          costs.sarvam = computeSarvamCostINR(duration);
        }
        save("transcribing", { video: meta, audio, fileHash, source: "upload" });

        const tTr = nowMs();
        transcription = await transcribeWithDiarization({
          audioFilePath: filePath,
          apiKey: process.env.SARVAM_API_KEY,
          outDir,
        });
        timings.transcribeMs = elapsed(tTr);

        save("rating", { video: meta, audio, transcription, fileHash, source: "upload" });
      }
    } else {
      const { url } = req.body || {};
      if (!url) return res.status(400).json({ error: "url is required" });

      const tMeta = nowMs();
      meta = await getVideoMeta(url);
      timings.metaMs = elapsed(tMeta);
      costs.sarvamLengthSeconds = Number(meta.lengthSeconds) || 0;
      costs.sarvam = computeSarvamCostINR(costs.sarvamLengthSeconds);
      save("downloading", { url, video: meta, audio, source: "youtube" });

      cached = db.findByUrl(url);

      if (cached) {
        transcription = cached.transcription;
        audio = cached.audio || null;
        timings.downloadMs = 0;
        timings.transcribeMs = 0;
        costs.sarvam = 0;
        costs.sarvamLengthSeconds = 0;
        save("rating", { url, video: meta, audio, transcription, cached: true, source: "youtube" });
      } else {
        const tDl = nowMs();
        const { filePath, bytes } = await downloadAudioAsMp3(url, path.join(workDir, "audio"));
        timings.downloadMs = elapsed(tDl);
        audio = { bytes };
        save("transcribing", { url, video: meta, audio, source: "youtube" });

        const tTr = nowMs();
        transcription = await transcribeWithDiarization({
          audioFilePath: filePath,
          apiKey: process.env.SARVAM_API_KEY,
          outDir,
        });
        timings.transcribeMs = elapsed(tTr);
        save("rating", { url, video: meta, audio, transcription, source: "youtube" });
      }
    }

    const transcriptText = transcription.turns
      .map((t) => `[Speaker ${t.speaker}] ${t.text}`)
      .join("\n");

    const tRt = nowMs();
    const { rating, meta: openRouterMeta } = await rateTranscript({
      transcript: transcriptText,
      apiKey: process.env.OPENROUTER_API_KEY,
      model: process.env.OPENROUTER_MODEL,
    });
    timings.rateMs = elapsed(tRt);
    const openRouterCostUSD = openRouterMeta?.usage?.cost ?? null;
    costs.openrouterUSD = openRouterCostUSD;
    costs.openrouter = openRouterCostUSD != null ? Number((openRouterCostUSD * USD_TO_INR).toFixed(4)) : null;

    timings.totalMs = elapsed(t0);

    const record = save("completed", {
      ...(req.file ? { audioSource: "upload", originalName: req.file.originalname, fileHash } : { url: req.body?.url }),
      ...(cached ? { cached: true } : {}),
      video: meta,
      audio,
      transcription,
      rating,
      openRouter: openRouterMeta,
    });

    fsp.rm(workDir, { recursive: true, force: true }).catch(() => {});
    fsp.rm(req.file?.path, { force: true }).catch(() => {});
    res.json(record);
  } catch (err) {
    timings.totalMs = elapsed(t0);
    save("failed", {
      error: err.message,
      ...(req.file ? { audioSource: "upload" } : { url: req.body?.url }),
    });
    if (!req.file && (err instanceof YouTubeError)) return next(err);
    if (err instanceof SarvamError) return next(err);
    if (err instanceof OpenRouterError) return next(err);
    next(err);
  }
});

evaluateRouter.get("/:id", (req, res) => {
  const record = db.get(req.params.id);
  if (!record) return res.status(404).json({ error: "not found" });
  res.json(record);
});