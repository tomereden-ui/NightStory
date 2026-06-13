import { NextRequest, NextResponse } from "next/server";
import { generateSfx } from "@/lib/services/sfxService";
import fs from "fs";
import os from "os";
import path from "path";

export async function POST(req: NextRequest) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ELEVENLABS_API_KEY not configured." }, { status: 500 });
  }

  const { description, durationSec } = await req.json();
  if (!description?.trim()) {
    return NextResponse.json({ error: "description is required." }, { status: 400 });
  }

  const tmpPath = path.join(os.tmpdir(), `sfx-preview-${Date.now()}.mp3`);

  const result = await generateSfx(description, (durationSec ?? 3) * 1000, apiKey, tmpPath);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  const buf = fs.readFileSync(tmpPath);
  fs.unlink(tmpPath, () => {});

  return NextResponse.json({ audioData: buf.toString("base64"), mimeType: "audio/mpeg" });
}
