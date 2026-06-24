import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "No GEMINI_API_KEY" }, { status: 500 });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-fast-generate-001:predict?key=${apiKey}`;

  let status: number, body: string;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [{ prompt: "a red apple on a white table" }],
        parameters: { sampleCount: 1, aspectRatio: "1:1", outputOptions: { mimeType: "image/jpeg" } },
      }),
    });
    status = res.status;
    body = await res.text();
  } catch (err) {
    return NextResponse.json({ error: String(err) });
  }

  let parsed: unknown;
  try { parsed = JSON.parse(body); } catch { parsed = body; }

  return NextResponse.json({ status, response: parsed });
}
