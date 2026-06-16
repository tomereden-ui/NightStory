import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "No API key" }, { status: 500 });

  let prompt: string, summary: string | undefined;
  try {
    ({ prompt, summary } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (!prompt) return NextResponse.json({ error: "prompt required" }, { status: 400 });

  const storyContext = [
    `Cover hint: ${prompt}`,
    summary ? `Full story: ${summary}` : "",
  ].filter(Boolean).join("\n");

  // ── Step 1: Gemini text → vivid character-first scene description ──────────
  let scenePrompt = prompt;
  try {
    const enhanceRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [{
              text: `You are a children's book illustrator writing an image prompt. Describe ONLY what a camera would see in the foreground of this book cover — the characters, their expressions, what they are doing, and where they are standing.

RULES:
- START with the main character(s): their species/appearance, clothing or fur color, size, emotion
- Then describe the action they are doing right now (playing, hugging, reaching, looking at something)
- Then the setting behind them (garden path, cozy bedroom, forest clearing, etc.) with 2 specific details
- End with one lighting detail (warm glow from a lantern, soft moonlight falling on them, firefly light, etc.)
- DO NOT mention the sky, clouds, or moon as the subject — they may exist in the background only
- DO NOT write about atmosphere without characters in it
- 3 sentences maximum

${storyContext}

Write ONLY the image prompt. No labels, no quotes.`,
            }],
          }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 200, thinkingConfig: { thinkingBudget: 0 } },
        }),
      }
    );
    if (enhanceRes.ok) {
      const enhanceData = await enhanceRes.json();
      const enhanced = enhanceData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (enhanced && enhanced.length > 20) {
        scenePrompt = enhanced;
        console.log("[CoverGen] Enhanced scene prompt:", scenePrompt);
      }
    }
  } catch {
    console.warn("[CoverGen] Enhancement failed, using raw prompt");
  }

  // ── Step 2: natural language prompt — character description first ────────────
  const fullPrompt = `${scenePrompt}

Illustrated as a glowing monochromatic blue-and-teal cosmic night scene for a children's bedtime book cover. The characters/subject described above are large and centered, rendered as a soft silhouette or gently lit shape glowing from within against a deep navy-black night sky. Scattered stars and a faint nebula-like glow surround the subject. Square composition, dreamy bioluminescent lighting, smooth gradients, minimal flat illustration style — no warm or amber tones, only cool blues, teals, and indigo. No text, no letters, no numbers anywhere in the image.`;

  console.log("[CoverGen] Final image prompt:", fullPrompt.slice(0, 300));

  // ── Pollinations.ai — free, no key, always works ─────────────────────────
  try {
    const seed = Math.floor(Math.random() * 999999);
    const encoded = encodeURIComponent(fullPrompt.slice(0, 1500));
    const url = `https://image.pollinations.ai/prompt/${encoded}?model=flux&width=768&height=768&nologo=true&seed=${seed}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const contentType = res.headers.get("content-type") ?? "image/jpeg";
      if (contentType.startsWith("image/")) {
        const buf = Buffer.from(await res.arrayBuffer());
        console.log("[CoverGen] Generated with Pollinations.ai");
        return NextResponse.json({
          imageData: buf.toString("base64"),
          mimeType: contentType.split(";")[0].trim(),
        });
      }
    }
    console.warn("[CoverGen] Pollinations returned non-image:", res.status, res.headers.get("content-type"));
  } catch (err) {
    console.warn("[CoverGen] Pollinations threw:", err);
  }

  return NextResponse.json({ error: "No image in response from any model" }, { status: 502 });
}
