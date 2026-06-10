import { spawn } from "child_process";
import fs from "fs";

export interface MixTrack {
  filePath: string;
  startMs: number;
  isSfx: boolean;
  isLooping: boolean;
}

// Lazy require so Next.js never tries to bundle ffmpeg-static at module load time
function getFfmpegPath(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const p = require("ffmpeg-static") as string | null;
  if (!p) throw new Error("ffmpeg-static binary not found");
  return p;
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

/** Fallback: simple concatenation of dialogue clips with no timing */
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
