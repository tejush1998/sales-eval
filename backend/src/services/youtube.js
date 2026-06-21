import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import youtubedl from 'youtube-dl-exec';
import ffmpegPath from 'ffmpeg-static';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const YTDLP_BIN = path.join(__dirname, '..', '..', '..', 'node_modules', 'youtube-dl-exec', 'bin', 'yt-dlp');

export class YouTubeError extends Error {
  constructor(message, code = 'YOUTUBE_ERROR') {
    super(message);
    this.name = 'YouTubeError';
    this.code = code;
    this.status = 400;
  }
}

const yt = youtubedl.create(
  YTDLP_BIN,
  ffmpegPath ? { ffmpegLocation: path.dirname(ffmpegPath) } : {}
);

export async function getVideoMeta(url) {
  try {
    const meta = await yt(url, {
      dumpSingleJson: true,
      noWarnings: true,
      noPlaylist: true,
      skipDownload: true,
    });
    return {
      title: meta.title,
      author: meta.uploader || meta.channel,
      lengthSeconds: Number(meta.duration) || 0,
      thumbnail: meta.thumbnail,
    };
  } catch (err) {
    const msg = (err.stderr || err.message || '').toString().slice(0, 500);
    throw new YouTubeError(`yt-dlp metadata failed: ${msg || err.message}`, 'YOUTUBE_META_ERROR');
  }
}

export async function downloadAudioAsMp3(url, outDir) {
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const outTemplate = path.join(outDir, 'audio.%(ext)s');
  let stderr = '';

  try {
    const child = yt.exec(url, {
      extractAudio: true,
      audioFormat: 'mp3',
      audioQuality: '0',
      format: 'bestaudio/best',
      output: outTemplate,
      noPlaylist: true,
      noWarnings: true,
      extractorArgs: 'youtube:player_client=tv,web_safari,web',
    });

    child.stderr?.on('data', (d) => { stderr += d.toString(); });

    const exitCode = await new Promise((resolve, reject) => {
      child.on('error', reject);
      child.on('close', resolve);
    });

    if (exitCode !== 0) {
      throw new YouTubeError(`yt-dlp exited ${exitCode}: ${stderr.slice(-500)}`, 'YOUTUBE_DL_ERROR');
    }

    const mp3File = fs.readdirSync(outDir).find((f) => f.endsWith('.mp3'));
    if (!mp3File) throw new YouTubeError('No mp3 produced by yt-dlp', 'YOUTUBE_DL_ERROR');

    const filePath = path.join(outDir, mp3File);
    const stat = fs.statSync(filePath);
    return { filePath, bytes: stat.size };
  } catch (err) {
    if (err instanceof YouTubeError) throw err;
    const msg = (err.stderr || err.message || '').toString().slice(0, 500);
    throw new YouTubeError(`yt-dlp audio download failed: ${msg || err.message}`, 'YOUTUBE_DL_ERROR');
  }
}
