import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "No GEMINI_API_KEY" }, { status: 500 });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${apiKey}`;

  let status: number, rawBody: string;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "a small red apple on a white table" }] }],
        generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
      }),
    });
    status = res.status;
    rawBody = await res.text();
  } catch (err) {
    return NextResponse.json({ fetchError: String(err) });
  }

  let parsed: unknown;
  try { parsed = JSON.parse(rawBody); } catch { parsed = rawBody.slice(0, 500); }

  return NextResponse.json({ status, body: parsed });
}
