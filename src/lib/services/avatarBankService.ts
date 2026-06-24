import { supabase } from "@/lib/supabase";
import { geminiPost, geminiText } from "@/lib/geminiClient";

// Module-level cache so repeated calls within a session don't re-fetch the bank
let bankCache: Array<{ id: string; description: string; image_url: string }> | null = null;

async function getBank() {
  if (bankCache) return bankCache;
  const { data } = await supabase.from("avatar_bank").select("id, description, image_url");
  bankCache = data ?? [];
  return bankCache;
}

/**
 * Find the closest pre-generated avatar from the bank using Gemini Flash as the matcher.
 * No embeddings required — Gemini reads all descriptions and picks the best one.
 */
export async function findBestAvatar(
  description: string,
  apiKey: string,
): Promise<string | null> {
  const bank = await getBank();
  if (bank.length === 0) {
    console.warn("[AvatarBank] bank is empty — run /api/admin/seed-avatar-bank first");
    return null;
  }

  const list = bank.map((a, i) => `${i + 1}. ${a.description}`).join("\n");

  try {
    const { data } = await geminiPost(apiKey, "gemini-2.5-flash", {
      contents: [{
        role: "user",
        parts: [{
          text: `You are matching a character to the closest pre-made avatar.\n\nCharacter: "${description}"\n\nAvatars:\n${list}\n\nReply with ONLY the number of the best match. Nothing else.`,
        }],
      }],
      generationConfig: { temperature: 0, maxOutputTokens: 5, thinkingConfig: { thinkingBudget: 0 } },
    });

    const text = geminiText(data)?.trim() ?? "";
    const index = parseInt(text.replace(/\D/g, "")) - 1;

    if (isNaN(index) || index < 0 || index >= bank.length) {
      console.warn("[AvatarBank] unexpected Gemini response:", text);
      return bank[0].image_url; // fallback to first avatar
    }

    console.log(`[AvatarBank] matched "${description.slice(0, 50)}" → ${bank[index].description.slice(0, 50)}`);
    return bank[index].image_url;
  } catch (err) {
    console.error("[AvatarBank] matching failed:", err);
    return bank[0]?.image_url ?? null;
  }
}

export function childProfileDescription(
  name: string,
  age: number,
  gender: "boy" | "girl" | "other",
): string {
  const genderWord = gender === "other" ? "child" : gender;
  return `${age} year old ${genderWord} named ${name}`;
}
