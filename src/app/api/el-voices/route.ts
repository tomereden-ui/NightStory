import { NextResponse } from "next/server";

export async function GET() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ELEVENLABS_API_KEY not configured." }, { status: 500 });
  }

  const res = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: { "xi-api-key": apiKey },
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    return NextResponse.json({ error: `EL voices fetch failed: ${res.status}` }, { status: 502 });
  }

  const data = await res.json() as { voices: { voice_id: string; name: string; category: string }[] };
  const voices = (data.voices ?? []).map((v) => ({
    id: v.voice_id,
    name: v.name,
    category: v.category,
  }));

  return NextResponse.json({ voices });
}
