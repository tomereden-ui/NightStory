import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ScriptBlock } from "@/types";

export async function generateCoverImage(
  title: string,
  blocks: ScriptBlock[],
  apiKey: string,
): Promise<Buffer | null> {
  const excerpt = blocks
    .slice(0, 6)
    .map((b) => b.textPayload.replace(/\[.*?\]/g, "").trim())
    .join(" ")
    .slice(0, 600);

  const prompt =
    `Create a stunning, vibrant children's book cover illustration for a story titled "${title}". ` +
    `Story excerpt: "${excerpt}". ` +
    `Style: magical, painterly, richly detailed children's book art with warm lighting and an enchanting atmosphere. ` +
    `Colorful, imaginative, and age-appropriate for children aged 5–9. Square composition. No text or lettering in the image.`;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash-preview-image-generation",
    });

    const result = await (model as any).generateContent({ // eslint-disable-line
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ["IMAGE"] },
    });

    const parts: any[] = // eslint-disable-line
      result?.response?.candidates?.[0]?.content?.parts ?? [];

    for (const part of parts) {
      if (part?.inlineData?.mimeType?.startsWith("image/")) {
        return Buffer.from(part.inlineData.data, "base64");
      }
    }

    console.warn("[CoverImage] No image part in Gemini response");
    return null;
  } catch (err) {
    console.warn("[CoverImage] Generation failed:", err);
    return null;
  }
}
