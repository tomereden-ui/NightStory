import { getEmbedding } from "./embeddingService";
import { supabase } from "@/lib/supabase";

// Minimum cosine similarity to accept a match; below this we fall back to null.
// Tune this after real usage — lower = more liberal matching, higher = stricter.
const SIMILARITY_THRESHOLD = 0.65;

interface AvatarMatch {
  imageUrl: string;
  description: string;
  type: string;
  gender: string;
  similarity: number;
}

/**
 * Find the closest pre-generated avatar from the bank for a given description.
 * Returns the public Storage URL, or null if no match clears the threshold
 * (which shouldn't happen once the bank is seeded — every bank entry is a valid fallback).
 */
export async function findBestAvatar(
  description: string,
  apiKey: string,
): Promise<string | null> {
  const embedding = await getEmbedding(description, apiKey);
  if (!embedding) {
    console.warn("[AvatarBank] embedding failed for:", description.slice(0, 60));
    return null;
  }

  const { data, error } = await supabase.rpc("match_avatar", {
    query_embedding: embedding,
    match_threshold: SIMILARITY_THRESHOLD,
  }) as { data: AvatarMatch[] | null; error: unknown };

  if (error) {
    console.error("[AvatarBank] RPC error:", error);
    return null;
  }

  const match = data?.[0];
  if (!match) {
    console.warn("[AvatarBank] no match above threshold for:", description.slice(0, 60));
    return null;
  }

  console.log(`[AvatarBank] match (${(match.similarity * 100).toFixed(1)}%) → ${match.description.slice(0, 60)}`);
  return match.imageUrl;
}

/**
 * Build a description string from child profile fields to pass into findBestAvatar.
 */
export function childProfileDescription(
  name: string,
  age: number,
  gender: "boy" | "girl" | "other",
): string {
  const genderWord = gender === "other" ? "child" : gender;
  return `${age} year old ${genderWord} named ${name}`;
}
