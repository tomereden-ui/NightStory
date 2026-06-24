export const IMAGE_MODEL = "gemini-3.1-flash-image";

interface ImagenResult {
  buf: Buffer;
  mimeType: string;
}

export async function generateWithImagen(
  prompt: string,
  apiKey: string,
): Promise<ImagenResult | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent?key=${apiKey}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
      }),
    });
  } catch (err) {
    console.error("[ImageGen] fetch error:", err);
    return null;
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[ImageGen] HTTP ${res.status}:`, body.slice(0, 300));
    return null;
  }

  let data: {
    candidates?: Array<{
      content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> };
    }>;
  };
  try { data = await res.json(); } catch { return null; }

  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p) => p.inlineData?.data);
  if (!imagePart?.inlineData?.data) {
    console.error("[ImageGen] No image in response:", JSON.stringify(data).slice(0, 200));
    return null;
  }

  return {
    buf: Buffer.from(imagePart.inlineData.data, "base64"),
    mimeType: imagePart.inlineData.mimeType ?? "image/png",
  };
}