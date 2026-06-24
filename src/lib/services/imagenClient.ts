// Gemini Imagen — raw HTTP client (the @google/generative-ai SDK doesn't expose Imagen yet)

// Switch between Imagen 3 Fast (GA, stable) and Imagen 4 Fast (preview) here.
// imagen-3.0-fast-generate-001  — GA, well-tested
// imagen-4.0-fast-generate-preview-05-20 — preview, better quality, same cost tier
export const IMAGEN_MODEL = "imagen-3.0-fast-generate-001";

interface ImagenResult {
  buf: Buffer;
  mimeType: string;
}

export async function generateWithImagen(
  prompt: string,
  apiKey: string,
): Promise<ImagenResult | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${IMAGEN_MODEL}:predict?key=${apiKey}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: "1:1",
          outputOptions: { mimeType: "image/jpeg" },
        },
      }),
    });
  } catch (err) {
    console.error("[Imagen] fetch error:", err);
    return null;
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[Imagen] HTTP ${res.status}:`, body.slice(0, 300));
    return null;
  }

  let data: { predictions?: Array<{ bytesBase64Encoded?: string; mimeType?: string }> };
  try {
    data = await res.json();
  } catch {
    console.error("[Imagen] Non-JSON response");
    return null;
  }

  const prediction = data?.predictions?.[0];
  if (!prediction?.bytesBase64Encoded) {
    console.error("[Imagen] No image in response:", JSON.stringify(data).slice(0, 200));
    return null;
  }

  return {
    buf: Buffer.from(prediction.bytesBase64Encoded, "base64"),
    mimeType: prediction.mimeType ?? "image/jpeg",
  };
}
