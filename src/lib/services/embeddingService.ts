// Gemini embeddings — tries multiple models/versions to find what's available on this API key

export const EMBEDDING_DIM = 768;

const CANDIDATES = [
  { model: "text-embedding-004", api: "v1beta" },
  { model: "text-embedding-005", api: "v1beta" },
  { model: "text-embedding-004", api: "v1" },
  { model: "text-embedding-005", api: "v1" },
  { model: "embedding-001",      api: "v1beta" },
];

export async function getEmbedding(text: string, apiKey: string): Promise<number[] | null> {
  for (const { model, api } of CANDIDATES) {
    const url = `https://generativelanguage.googleapis.com/${api}/models/${model}:embedContent?key=${apiKey}`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: { parts: [{ text }] } }),
      });
      if (!res.ok) {
        console.warn(`[Embedding] ${model} (${api}) HTTP ${res.status}`);
        continue;
      }
      const data: { embedding?: { values?: number[] } } = await res.json().catch(() => ({}));
      const values = data?.embedding?.values;
      if (!Array.isArray(values) || values.length === 0) continue;
      if (values.length !== EMBEDDING_DIM) {
        console.warn(`[Embedding] ${model} dim mismatch: got ${values.length}, need ${EMBEDDING_DIM}`);
        continue;
      }
      console.log(`[Embedding] success with ${model} (${api})`);
      return values;
    } catch (err) {
      console.warn(`[Embedding] ${model} error:`, err);
    }
  }
  console.error("[Embedding] all candidates failed");
  return null;
}