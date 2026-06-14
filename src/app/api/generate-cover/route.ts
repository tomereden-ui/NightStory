import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "No API key" }, { status: 500 });

  let prompt: string;
  try {
    ({ prompt } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!prompt) return NextResponse.json({ error: "prompt required" }, { status: 400 });

  const styledPrompt = `Dark mystical nighttime children's story illustration. Cosmic purple and deep blue color palette. Ethereal glowing atmosphere, stars and soft magical light. Dreamlike and soothing, gentle watercolor style. No text, no words. Scene: ${prompt}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: styledPrompt }] }],
          generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
        }),
      }
    );

    const data = await res.json();
    const parts = data?.candidates?.[0]?.content?.parts ?? [];
    for (const part of parts) {
      if (part.inlineData?.data) {
        return NextResponse.json({
          imageData: part.inlineData.data,
          mimeType: part.inlineData.mimeType ?? "image/jpeg",
        });
      }
    }
    return NextResponse.json({ error: "No image in response" }, { status: 502 });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
