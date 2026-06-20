import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import os from "os";
import { mixTracks } from "@/lib/services/audioMixer";

const OUT_DIR = path.join(os.tmpdir(), "nightstory-output");

export async function POST(req: NextRequest) {
  let body: { speechUrl: string; sfxUrl: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { speechUrl, sfxUrl } = body;
  if (!speechUrl || !sfxUrl) {
    return NextResponse.json({ error: "speechUrl and sfxUrl are required." }, { status: 400 });
  }

  // Convert public-relative URLs (/output/foo.wav) to absolute file paths
  const speechPath = path.join(process.cwd(), "public", speechUrl);
  const sfxPath    = path.join(process.cwd(), "public", sfxUrl);

  if (!fs.existsSync(speechPath)) {
    return NextResponse.json({ error: "Speech audio file not found." }, { status: 400 });
  }
  if (!fs.existsSync(sfxPath)) {
    return NextResponse.json({ error: "SFX audio file not found." }, { status: 400 });
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const id = crypto.randomUUID().slice(0, 8);
  const outPath = path.join(OUT_DIR, `test_merged_${id}.mp3`);

  // Estimate total duration from speech file size (rough heuristic) — ffmpeg will handle the actual length
  const speechStat = fs.statSync(speechPath);
  const estimatedDurationMs = Math.max(10000, Math.ceil(speechStat.size / 32000) * 1000);

  try {
    await mixTracks(
      [
        { filePath: speechPath, startMs: 0, isSfx: false, isLooping: false },
        { filePath: sfxPath,    startMs: 0, isSfx: true,  isLooping: true  },
      ],
      outPath,
      estimatedDurationMs,
    );
  } catch (err) {
    console.error("[merge-audio]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Merge failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ audioUrl: `/output/test_merged_${id}.mp3` });
}
