import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import fs from "fs";

// Use bundled static binary
if (ffmpegStatic) ffmpeg.setFfmpegPath(ffmpegStatic);

export interface MixTrack {
  filePath: string;
  startMs: number;
  isSfx: boolean;
  isLooping: boolean;
}

export async function mixTracks(
  tracks: MixTrack[],
  outputPath: string,
  totalDurationMs: number,
): Promise<void> {
  // Only include tracks whose file actually exists
  const valid = tracks.filter((t) => fs.existsSync(t.filePath));
  if (valid.length === 0) throw new Error("No valid audio tracks to mix");

  const totalSec = Math.ceil(totalDurationMs / 1000);

  return new Promise((resolve, reject) => {
    const cmd = ffmpeg();

    // Add inputs (looping ones use stream_loop)
    for (const track of valid) {
      if (track.isLooping) {
        cmd.input(track.filePath).inputOptions(["-stream_loop", "-1"]);
      } else {
        cmd.input(track.filePath);
      }
    }

    // Build per-input filter chains
    const filterParts: string[] = [];
    const outLabels: string[] = [];

    valid.forEach((track, i) => {
      const label = `mix${i}`;
      const delay = track.startMs;
      const vol = track.isSfx ? "0.28" : "1.0";

      if (track.isLooping) {
        // Trim the infinite loop to total drama duration, then delay + volume
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

    // Mix + loudnorm
    filterParts.push(
      `${outLabels.join("")}amix=inputs=${outLabels.length}:normalize=0[mixed]`,
    );
    filterParts.push(
      `[mixed]loudnorm=I=-16:TP=-1.5:LRA=11[out]`,
    );

    cmd
      .complexFilter(filterParts.join(";"), "out")
      .audioCodec("libmp3lame")
      .audioBitrate("128k")
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", (err: Error) =>
        reject(new Error(`FFmpeg: ${err.message}`)),
      )
      .run();
  });
}

/** Simple fallback: concatenate dialogue clips only (no timing, no SFX) */
export async function concatenateTracks(
  filePaths: string[],
  outputPath: string,
): Promise<void> {
  const valid = filePaths.filter((p) => fs.existsSync(p));
  if (valid.length === 0) throw new Error("No valid tracks");

  return new Promise((resolve, reject) => {
    const cmd = ffmpeg();
    valid.forEach((p) => cmd.input(p));

    const labels = valid.map((_, i) => `[${i}:a]`).join("");
    cmd
      .complexFilter([`${labels}concat=n=${valid.length}:v=0:a=1[out]`], "out")
      .audioCodec("libmp3lame")
      .audioBitrate("128k")
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", (err: Error) => reject(new Error(`FFmpeg concat: ${err.message}`)))
      .run();
  });
}
