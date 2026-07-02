import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ELEVENLABS_API_KEY not configured." }, { status: 500 });
  }

  const { searchParams } = req.nextUrl;
  const mode = searchParams.get("mode") ?? "personal"; // "personal" | "library"
  const language = searchParams.get("language") ?? "";  // e.g. "he"
  const pageSize = Math.min(100, Number(searchParams.get("page_size") ?? "50"));
  const page = Number(searchParams.get("page") ?? "1");

  if (mode === "library") {
    // Query ElevenLabs shared voice library with optional language filter.
    // Returns community/professional voices that can be added to a project.
    const params = new URLSearchParams({
      page_size: String(pageSize),
      page: String(page - 1), // EL is 0-indexed
      sort: "trending",
    });
    if (language) params.set("language", language);

    const res = await fetch(
      `https://api.elevenlabs.io/v1/shared-voices?${params}`,
      { headers: { "xi-api-key": apiKey } },
    );

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `EL shared-voices fetch failed: ${res.status} ${text.slice(0, 200)}` },
        { status: 502 },
      );
    }

    const data = await res.json() as {
      voices: {
        voice_id: string;
        name: string;
        category: string;
        description?: string;
        labels?: Record<string, string>;
        preview_url?: string;
        language?: string;
        use_cases?: string[];
        verified_languages?: { language: string; model_id: string; accent?: string }[];
      }[];
      has_more: boolean;
      total_count?: number;
      last_evaluated_key?: string;
    };

    const voices = (data.voices ?? []).map((v) => ({
      id: v.voice_id,
      name: v.name,
      category: v.category,
      description: v.description ?? "",
      labels: v.labels ?? {},
      previewUrl: v.preview_url ?? null,
      language: v.language ?? null,
      useCases: v.use_cases ?? [],
      verifiedLanguages: v.verified_languages ?? [],
    }));

    return NextResponse.json({ voices, hasMore: data.has_more, totalCount: data.total_count ?? null });
  }

  // Default: personal library (own + previously added voices)
  const res = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: { "xi-api-key": apiKey },
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    return NextResponse.json({ error: `EL voices fetch failed: ${res.status}` }, { status: 502 });
  }

  const data = await res.json() as {
    voices: {
      voice_id: string;
      name: string;
      category: string;
      labels?: Record<string, string>;
      preview_url?: string;
      verified_languages?: { language: string; model_id: string; accent?: string }[];
    }[];
  };

  const voices = (data.voices ?? []).map((v) => ({
    id: v.voice_id,
    name: v.name,
    category: v.category,
    labels: v.labels ?? {},
    previewUrl: v.preview_url ?? null,
    verifiedLanguages: v.verified_languages ?? [],
  }));

  return NextResponse.json({ voices });
}
