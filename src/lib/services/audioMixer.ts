import { spawn } from "child_process";
import path from "path";
import fs from "fs";

export interface MixTrack {
  filePath: string;
  startMs: number;
  isSfx: boolean;
  isLooping: boolean;
}

// Resolve ffmpeg binary path without require() so webpack never tries to bundle it.
// Checks FFMPEG_PATH env var first, then the ffmpeg-static binary inside node_modules.
function getFfmpegPath(): string {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;

  const candidates = [
    path.join(process.cwd(), "node_modules", "ffmpeg-static", "ffmpeg"),
    path.join(process.cwd(), "node_modules", "ffmpeg-static", "ffmpeg.exe"),
    "/usr/bin/ffmpeg",
    "/usr/local/bin/ffmpeg",
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  throw new Error(
    "ffmpeg binary not found. Install ffmpeg-static or set the FFMPEG_PATH environment variable.",
  );
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(getFfmpegPath(), args, {
      stdio: ["ignore", "ignore", "pipe"],
    });
    const errLines: string[] = [];
    proc.stderr?.on("data", (d: Buffer) => errLines.push(d.toString()));
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exit ${code}: ${errLines.slice(-4).join("")}`));
    });
    proc.on("error", reject);
  });
}

export async function mixTracks(
  tracks: MixTrack[],
  outputPath: string,
  totalDurationMs: number,
): Promise<void> {
  const valid = tracks.filter((t) => fs.existsSync(t.filePath));
  if (valid.length === 0) throw new Error("No valid audio tracks");

  const totalSec = Math.ceil(totalDurationMs / 1000);
  const args: string[] = ["-y"];

  // Inputs — looping tracks use -stream_loop before -i
  for (const track of valid) {
    if (track.isLooping) args.push("-stream_loop", "-1");
    args.push("-i", track.filePath);
  }

  // Per-input filter chains
  const filterParts: string[] = [];
  const outLabels: string[] = [];

  valid.forEach((track, i) => {
    const label = `o${i}`;
    const vol = track.isSfx ? "0.28" : "1.0";
    const delay = track.startMs;

    if (track.isLooping) {
      filterParts.push(
        `[${i}:a]atrim=0:${totalSec},asetpts=PTS-STARTPTS,` +
        `adelay=${delay}|${delay},volume=${vol}[${label}]`,
      );
    } else {
      filterParts.push(
        `[${i}:a]adelay=${delay}|${delay},volume=${vol}[${label}]`,
      );
    }
    outLabels.push(`[${label}]`);
  });

  filterParts.push(
    `${outLabels.join("")}amix=inputs=${outLabels.length}:normalize=0[mixed]`,
  );
  filterParts.push(`[mixed]loudnorm=I=-16:TP=-1.5:LRA=11[out]`);

  args.push(
    "-filter_complex", filterParts.join(";"),
    "-map", "[out]",
    "-acodec", "libmp3lame",
    "-ab", "128k",
    outputPath,
  );

  await runFfmpeg(args);
}

/** Fallback: simple concatenation of dialogue clips with no timing (requires ffmpeg) */
export async function concatenateTracks(
  filePaths: string[],
  outputPath: string,
): Promise<void> {
  const valid = filePaths.filter((p) => fs.existsSync(p));
  if (valid.length === 0) throw new Error("No valid tracks");

  const args: string[] = ["-y"];
  valid.forEach((p) => args.push("-i", p));

  const labels = valid.map((_, i) => `[${i}:a]`).join("");
  args.push(
    "-filter_complex", `${labels}concat=n=${valid.length}:v=0:a=1[out]`,
    "-map", "[out]",
    "-acodec", "libmp3lame",
    "-ab", "128k",
    outputPath,
  );

  await runFfmpeg(args);
}

/**
 * Pure-JS WAV concatenation — no ffmpeg or native binaries required.
 * All Gemini TTS output is 16-bit PCM WAV, so this works as a universal fallback.
 */
export function concatenateWavFilesPureJS(filePaths: string[], outputPath: string): void {
  const valid = filePaths.filter((p) => fs.existsSync(p));
  if (valid.length === 0) throw new Error("No valid WAV files");

  let numChannels = 1;
  let sampleRate = 24000;
  let bitsPerSample = 16;
  const pcmChunks: Buffer[] = [];

  for (const p of valid) {
    const buf = fs.readFileSync(p);
    if (buf.length < 44) continue;
    if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") continue;

    numChannels = buf.readUInt16LE(22);
    sampleRate = buf.readUInt32LE(24);
    bitsPerSample = buf.readUInt16LE(34);

    // Scan for the "data" chunk (not always at fixed offset)
    let pos = 12;
    while (pos < buf.length - 8) {
      const chunkId = buf.toString("ascii", pos, pos + 4);
      const chunkSize = buf.readUInt32LE(pos + 4);
      if (chunkId === "data") {
        pcmChunks.push(buf.subarray(pos + 8, pos + 8 + chunkSize));
        break;
      }
      pos += 8 + chunkSize + (chunkSize % 2); // word-align
    }
  }

  if (pcmChunks.length === 0) throw new Error("No PCM data found in WAV files");

  const pcm = Buffer.concat(pcmChunks);
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const header = Buffer.alloc(44);

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);

  fs.writeFileSync(outputPath, Buffer.concat([header, pcm]));
}
