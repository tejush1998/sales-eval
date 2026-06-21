import fs from "node:fs/promises";
import path from "node:path";
import { SarvamAIClient } from "sarvamai";

export class SarvamError extends Error {
  constructor(message) {
    super(message);
    this.name = "SarvamError";
    this.status = 502;
  }
}

export async function transcribeWithDiarization({
  audioFilePath,
  apiKey,
  outDir,
}) {
  if (!apiKey) throw new SarvamError("SARVAM_API_KEY is not set");

  const client = new SarvamAIClient({ apiSubscriptionKey: apiKey });

  const job = await client.speechToTextJob.createJob({
    model: "saaras:v3",
    languageCode: "hi-IN",
    mode: "transcribe",
    withDiarization: true,
  });

  await job.uploadFiles([audioFilePath]);
  await job.start();
  const finalStatus = await job.waitUntilComplete();
  await job.downloadOutputs(outDir);

  const files = await fs.readdir(outDir);
  const jsonFile = files.find((f) => f.endsWith(".json"));
  if (!jsonFile)
    throw new SarvamError(`No JSON output from Sarvam in ${outDir}`);
  const raw = await fs.readFile(path.join(outDir, jsonFile), "utf8");
  const result = JSON.parse(raw);

  const entries = result.diarized_transcript?.entries || [];
  const turns = entries.map((e) => ({
    speaker: e.speaker_id,
    text: e.transcript?.trim(),
    start: e.start_time_seconds,
    end: e.end_time_seconds,
  }));

  return {
    requestId: result.request_id,
    languageCode: result.language_code,
    fullTranscript: result.transcript,
    turns,
    job: {
      jobId: job.jobId,
      jobState: finalStatus?.job_state,
      createdAt: finalStatus?.created_at,
      updatedAt: finalStatus?.updated_at,
      totalFiles: finalStatus?.total_files,
      successfulFiles: finalStatus?.successful_files_count,
      failedFiles: finalStatus?.failed_files_count,
    },
  };
}
