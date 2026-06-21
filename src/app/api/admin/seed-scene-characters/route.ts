import { NextResponse } from "next/server";
import { supabase, ensureBuckets } from "@/lib/supabase";
import { SCENE_CHARS } from "@/config/sceneCharacters";

export const dynamic = "force-dynamic";

const BUCKET = "voice-avatars";
const FOLDER = "scene";

export async function GET() {
  await ensureBuckets();

  const { data: existingFiles } = await supabase.storage
    .from(BUCKET)
    .list(FOLDER, { limit: 50 });
  const existingNames = new Set((existingFiles ?? []).map((f) => f.name));

  const urls: Record<string, string> = {};

  for (const char of SCENE_CHARS) {
    const fileName = `${char.label.toLowerCase()}.svg`;

    if (existingNames.has(fileName)) {
      urls[char.label] = supabase.storage.from(BUCKET).getPublicUrl(`${FOLDER}/${fileName}`).data.publicUrl;
      continue;
    }

    try {
      const res = await fetch(char.url, { headers: { "User-Agent": "NightStory/1.0" } });
      if (!res.ok) continue;
      const svg = await res.text();
      const buf = Buffer.from(svg, "utf-8");

      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(`${FOLDER}/${fileName}`, buf, { contentType: "image/svg+xml", upsert: true });

      if (!error) {
        urls[char.label] = supabase.storage.from(BUCKET).getPublicUrl(`${FOLDER}/${fileName}`).data.publicUrl;
      }
    } catch {
      // Leave this character out of urls — caller falls back to DiceBear URL
    }
  }

  return NextResponse.json({ urls });
}
