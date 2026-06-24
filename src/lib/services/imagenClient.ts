export const IMAGE_MODEL = "imagen-4.0-fast-generate-001";

interface ImagenResult {
  buf: Buffer;
  mimeType: string;
}

export async function generateWithImagen(
  prompt: string,
  apiKey: string,
): Promise<ImagenResult | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:predict?key=${apiKey}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: { sampleCount: 1, aspectRatio: "1:1" },
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

  let data: { predictions?: Array<{ bytesBase64Encoded?: string; mimeType?: string }> };
  try { data = await res.json(); } catch { return null; }

  const prediction = data?.predictions?.[0];
  if (!prediction?.bytesBase64Encoded) return null;

  return {
    buf: Buffer.from(prediction.bytesBase64Encoded, "base64"),
    mimeType: prediction.mimeType ?? "image/png",
  };
}