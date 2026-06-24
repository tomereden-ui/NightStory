import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const CANDIDATE_MODELS = [
  "imagen-3.0-fast-generate-001",
  "imagen-3.0-generate-001",
  "imagen-3.0-generate-002",
  "imagen-4.0-fast-generate-preview-05-20",
  "imagegeneration@006",
];

export async function GET(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "No GEMINI_API_KEY" }, { status: 500 });

  const { searchParams } = new URL(req.url);

  // ?list=1 — return all models that support generateContent or predict
  if (searchParams.get("list")) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=200`
    );
    const data = await res.json();
    const imageModels = (data.models ?? []).filter((m: { name: string; supportedGenerationMethods?: string[] }) =>
      m.name.toLowerCase().includes("imagen") ||
      m.name.toLowerCase().includes("image") ||
      (m.supportedGenerationMethods ?? []).includes("predict")
    );
    return NextResponse.json({ total: data.models?.length, imageModels });
  }

  // Default: try each candidate model and return first success or all errors
  const results: { model: string; status: number; ok: boolean; error?: string }[] = [];
  for (const model of CANDIDATE_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${apiKey}`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instances: [{ prompt: "a red apple on a white table" }],
          parameters: { sampleCount: 1, aspectRatio: "1:1" },
        }),
      });
      const body = await res.text();
      let parsed: unknown;
      try { parsed = JSON.parse(body); } catch { parsed = body.slice(0, 200); }
      results.push({ model, status: res.status, ok: res.ok, error: res.ok ? undefined : JSON.stringify(parsed).slice(0, 200) });
      if (res.ok) break; // stop at first working model
    } catch (err) {
      results.push({ model, status: 0, ok: false, error: String(err) });
    }
  }
  return NextResponse.json({ results });
}
