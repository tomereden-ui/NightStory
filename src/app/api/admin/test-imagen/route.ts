import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "No GEMINI_API_KEY" }, { status: 500 });

  const { searchParams } = new URL(req.url);

  // ?list=1 — return all models
  if (searchParams.get("list")) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=200`
    );
    const data = await res.json() as { models?: Array<{ name: string; supportedGenerationMethods?: string[] }> };
    const all = (data.models ?? []).map((m) => ({ name: m.name, methods: m.supportedGenerationMethods }));
    return NextResponse.json({ count: all.length, models: all });
  }

  // Default: try a specific model
  const model = searchParams.get("model") ?? "gemini-2.0-flash-preview-image-generation";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: "a small red apple" }] }],
      generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
    }),
  });
  const body = await res.text();
  let parsed: unknown;
  try { parsed = JSON.parse(body); } catch { parsed = body.slice(0, 500); }
  return NextResponse.json({ status: res.status, model, body: parsed });
}
