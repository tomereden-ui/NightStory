import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// The Chirp3-HD "voice" names in this app are locale-suffixed on Google's
// side (e.g. "en-US-Chirp3-HD-Aoede" / "he-IL-Chirp3-HD-Aoede") even though
// they're the same underlying voice — this route fetches the real catalog
// and groups by base name so the client can present one entry per voice
// with an accurate EN/HE badge instead of guessing at a hardcoded list.

interface GCVoice {
  name: string;
  languageCodes: string[];
}

export async function GET() {
  const apiKey = process.env.GOOGLE_CLOUD_TTS_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GOOGLE_CLOUD_TTS_API_KEY not configured." }, { status: 500 });

  const res = await fetch(`https://texttospeech.googleapis.com/v1/voices?key=${apiKey}`);
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    return NextResponse.json({ error: `Google Cloud TTS voices fetch failed: ${res.status} ${errText}` }, { status: 502 });
  }

  const data = await res.json() as { voices: GCVoice[] };
  const byBaseName = new Map<string, Set<string>>();

  for (const v of data.voices ?? []) {
    const match = v.name.match(/^(en-US|he-IL)-Chirp3-HD-(.+)$/);
    if (!match) continue;
    const [, locale, baseName] = match;
    const lang = locale === "he-IL" ? "he" : "en";
    if (!byBaseName.has(baseName)) byBaseName.set(baseName, new Set());
    byBaseName.get(baseName)!.add(lang);
  }

  const voices = Array.from(byBaseName.entries())
    .map(([name, langs]) => ({ id: name, name, languages: Array.from(langs).sort() }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({ voices });
}
