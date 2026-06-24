// Gemini text-embedding-004 — 768-dimensional embeddings used for avatar bank similarity search

const EMBEDDING_MODEL = "text-embedding-004";
export const EMBEDDING_DIM = 768;

export async function getEmbedding(text: string, apiKey: string): Promise<number[] | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${apiKey}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: { parts: [{ text }] } }),
    });
  } catch (err) {
    console.error("[Embedding] fetch error:", err);
    return null;
  }

  if (!res.ok) {
    console.error(`[Embedding] HTTP ${res.status}`);
    return null;
  }

  const data: { embedding?: { values?: number[] } } = await res.json().catch(() => ({}));
  const values = data?.embedding?.values;
  if (!Array.isArray(values) || values.length !== EMBEDDING_DIM) {
    console.error("[Embedding] unexpected shape:", values?.length);
    return null;
  }

  return values;
}
