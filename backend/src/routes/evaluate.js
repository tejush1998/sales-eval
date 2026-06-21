import fs from "node:fs/promises";
import path from "node:path";
import { Router } from "express";
import { nanoid } from "nanoid";
import { db } from "../services/db.js";
import {
  downloadAudioAsMp3,
  getVideoMeta,
  YouTubeError,
} from "../services/youtube.js";
import { transcribeWithDiarization, SarvamError } from "../services/sarvam.js";
import { rateTranscript, OpenRouterError } from "../services/openrouter.js";

export const evaluateRouter = Router();

const TMP_ROOT = path.join(process.cwd(), "tmp");

function nowMs() { return Date.now(); }
function elapsed(start) { return nowMs() - start; }
function fmtMs(ms) { return Number(ms || 0).toFixed(0); }

evaluateRouter.post("/", async (req, res, next) => {
  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: "url is required" });

  const id = nanoid(10);
  const workDir = path.join(TMP_ROOT, id);
  const audioDir = path.join(workDir, "audio");
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

  try {
    await fs.mkdir(workDir, { recursive: true });

    const tMeta = nowMs();
    const meta = await getVideoMeta(url);
    timings.metaMs = elapsed(tMeta);
    costs.sarvamLengthSeconds = Number(meta.lengthSeconds) || 0;
    costs.sarvam = computeSarvamCostINR(costs.sarvamLengthSeconds);
    db.save({
      id, url, status: "downloading",
      video: meta, timings, costs,
      createdAt: t0, updatedAt: nowMs(),
    });

    const cached = db.findByUrl(url);
    let transcription;
    let audio;

    if (cached) {
      transcription = cached.transcription;
      audio = cached.audio || null;
      timings.downloadMs = 0;
      timings.transcribeMs = 0;
      costs.sarvam = 0;
      costs.sarvamLengthSeconds = 0;
      db.save({
        id, url, status: "rating", cached: true,
        video: meta,
        audio,
        transcription,
        timings, costs,
        createdAt: t0, updatedAt: nowMs(),
      });
    } else {
      const tDl = nowMs();
      const { filePath, bytes } = await downloadAudioAsMp3(url, audioDir);
      timings.downloadMs = elapsed(tDl);
      audio = { bytes };
      db.save({
        id, url, status: "transcribing",
        video: meta,
        audio,
        timings, costs,
        createdAt: t0, updatedAt: nowMs(),
      });

      const tTr = nowMs();
      transcription = await transcribeWithDiarization({
        audioFilePath: filePath,
        apiKey: process.env.SARVAM_API_KEY,
        outDir,
      });
      timings.transcribeMs = elapsed(tTr);
      db.save({
        id, url, status: "rating",
        video: meta,
        audio,
        transcription,
        timings, costs,
        createdAt: t0, updatedAt: nowMs(),
      });
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

    const record = db.save({
      id, url, status: "completed",
      cached: !!cached,
      video: meta,
      audio,
      transcription,
      rating,
      openRouter: openRouterMeta,
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
    });

    fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
    res.json(record);
  } catch (err) {
    timings.totalMs = elapsed(t0);
    db.save({
      id, url, status: "failed",
      error: err.message,
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
    });
    if (err instanceof YouTubeError) return next(err);
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
