import { supabase } from "@/lib/supabase";
import { geminiPost, geminiText } from "@/lib/geminiClient";

// Module-level cache so repeated calls within a session don't re-fetch the bank
let bankCache: Array<{ id: string; description: string; image_url: string }> | null = null;

// Rows tagged "_generated" are one-off avatars auto-generated for a specific story
// character's exact description (see /api/generate-avatar) — they're an exact-match
// cache, not general-purpose portraits, so they're excluded from fallback matching
// here to avoid surfacing a previous story's leftover character art.
async function getBank() {
  if (bankCache) return bankCache;
  const { data } = await supabase.from("avatar_bank").select("id, description, image_url, traits");
  const rows = (data ?? []) as Array<{ id: string; description: string; image_url: string; traits: string[] | null }>;
  bankCache = rows.filter((r) => !r.traits?.includes("_generated")).map(({ id, description, image_url }) => ({ id, description, image_url }));
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
    const { data } = await geminiPost(apiKey, "gemini-3.5-flash", {
      contents: [{
        role: "user",
        parts: [{
          text: `You are matching a character to the closest pre-made avatar.\n\nCharacter: "${description}"\n\nAvatars:\n${list}\n\nReply with ONLY the number of the best match. Nothing else.`,
        }],
      }],
      // maxOutputTokens must be comfortably larger than the answer: at 5,
      // multi-digit picks got truncated (MAX_TOKENS) — "40" came back as "4",
      // silently selecting the wrong avatar while looking like a clean reply.
      generationConfig: { temperature: 0, maxOutputTokens: 50, thinkingConfig: { thinkingBudget: 0 } },
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

// ── Story-character matching (profile-based, not a bare description) ───────
// Separate cache from getBank() above since this keeps type/gender/age_bucket
// columns needed for pool filtering, which the plain-description matcher
// never needed. Includes "_generated" rows (unlike getBank()) — the curated,
// non-generated pool alone is only ~47 rows, too thin once gender is also a
// hard filter (e.g. 7-9 rows per child gender bucket); the occasional reuse
// of a portrait originally tailored to a past character's exact description
// is a smaller cost than the matcher regularly running out of real options.
interface BankRowFull { id: string; description: string; image_url: string; type: string | null; gender: string | null; ageBucket: string | null; category: string | null; }
let bankCacheFull: BankRowFull[] | null = null;
async function getBankFull(): Promise<BankRowFull[]> {
  if (bankCacheFull) return bankCacheFull;
  type Row = { id: string; description: string; image_url: string; type: string | null; gender: string | null; age_bucket: string | null; category: string | null };
  let data: Row[] | null = null;
  let error: { message: string; code?: string } | null = null;
  ({ data, error } = await supabase.from("avatar_bank").select("id, description, image_url, type, gender, age_bucket, category"));
  if (error) {
    // age_bucket/category may not exist yet if the avatar-bank migration
    // hasn't been run — degrade to matching without them rather than silently
    // treating the whole bank as empty (which broke type/gender matching
    // too, not just age, the first time this shipped ahead of the migration).
    console.warn("[AvatarBank] full-row fetch failed, retrying without age_bucket/category:", error.message);
    const retry = await supabase.from("avatar_bank").select("id, description, image_url, type, gender");
    if (retry.error) {
      console.error("[AvatarBank] retry without age_bucket/category also failed:", retry.error.message);
      bankCacheFull = [];
      return bankCacheFull;
    }
    data = (retry.data as Omit<Row, "age_bucket" | "category">[] | null)?.map((r) => ({ ...r, age_bucket: null, category: null })) ?? [];
  }
  const rows = data ?? [];
  bankCacheFull = rows.map(({ id, description, image_url, type, gender, age_bucket, category }) => ({ id, description, image_url, type, gender, ageBucket: age_bucket, category }));
  return bankCacheFull;
}

// avatar_bank uses "boy"/"girl" for child-type rows but "male"/"female" for
// adult-type rows (confirmed against real data) — CharacterProfile.gender is
// always "male"/"female"/"neutral" regardless of type, so a naive string
// match would silently fail every child-gender comparison. Normalize to
// whichever vocabulary the bank actually uses for this dbType.
function bankGenderFor(gender: string, dbType: string): string {
  if (dbType === "child") {
    if (gender === "male") return "boy";
    if (gender === "female") return "girl";
  }
  return gender;
}

/**
 * Match a story character to the closest avatar-bank portrait using its
 * persisted profile (type/gender/ageBucket/visualDescription) — the same
 * profile data already driving nature-based voice casting
 * (voiceAssignment.ts), applied here to images instead of voices.
 *
 * type and gender are HARD filters (never cross an adult avatar into a
 * child's pool, never hand a boy avatar to a girl character) — both degrade
 * to the broader pool only if the strict filter would leave zero candidates,
 * so an unusual/unlabeled combination still resolves to something rather
 * than failing outright. ageBucket is a SOFT preference on top of that,
 * since it isn't populated for every character yet (only classifyCharacters
 * emits it so far, not the main story-generation prompt) — narrows the pool
 * when it helps, ignored when it would empty it.
 *
 * excludeUrls lets a caller assigning a whole cast avoid handing two
 * different characters the exact same portrait when a distinct option
 * exists in the filtered pool.
 */
export async function findBestAvatarForCharacter(
  profile: { type: string; gender?: string; ageBucket?: string; category?: string; visualDescription?: string },
  apiKey: string,
  excludeUrls?: Set<string>,
): Promise<string | null> {
  const bank = await getBankFull();
  if (bank.length === 0) {
    console.warn("[AvatarBank] bank is empty — run /api/admin/seed-avatar-bank first");
    return null;
  }

  // Exact-description short-circuit: /api/generate-avatar caches every
  // Studio-generated portrait into the bank keyed by the character's exact
  // visualDescription — when that art exists, it IS this character (that's
  // where the Studio screen's own avatar came from), so returning it here
  // keeps the story card consistent with Studio instead of independently
  // re-matching to different art. Checked before any type/gender filtering,
  // since a bespoke exact match trumps label-based narrowing.
  const visual = profile.visualDescription?.trim().toLowerCase();
  if (visual) {
    const exact = bank.find((a) => a.description.trim().toLowerCase() === visual && !excludeUrls?.has(a.image_url));
    if (exact) return exact.image_url;
  }

  const dbType = profile.type === "narrator" ? "adult" : profile.type;
  let pool = bank.filter((a) => a.type === dbType);
  if (pool.length === 0) pool = bank; // type column not populated for every row — fall back to full bank

  // Category splits type's catch-all "animal" (any non-human) into real
  // kinds — a tree character must never draw from the pig pool. Hard filter
  // when both sides carry the label; graceful fallback while the bank's
  // category backfill hasn't run (all bank categories null → empty match →
  // keep the type pool) or when a category simply has no art yet.
  if (profile.category) {
    const categoryMatched = pool.filter((a) => a.category === profile.category);
    if (categoryMatched.length > 0) pool = categoryMatched;
  }

  if (profile.gender) {
    const bankGender = bankGenderFor(profile.gender, dbType);
    const genderMatched = pool.filter((a) => a.gender === bankGender);
    if (genderMatched.length > 0) pool = genderMatched;
    // else: no rows labeled with this gender within this type — keep the
    // type-only pool rather than return nothing.
  }

  if (profile.ageBucket) {
    const ageMatched = pool.filter((a) => a.ageBucket === profile.ageBucket);
    if (ageMatched.length > 0) pool = ageMatched;
    // else: age granularity not populated for enough of this bucket yet —
    // keep the type(+gender)-filtered pool, don't dead-end on it.
  }

  if (excludeUrls?.size) {
    const distinct = pool.filter((a) => !excludeUrls.has(a.image_url));
    if (distinct.length > 0) pool = distinct;
  }

  const description = [profile.visualDescription, profile.gender ? `gender: ${profile.gender}` : ""]
    .filter(Boolean).join(". ") || profile.type;
  const list = pool.map((a, i) => `${i + 1}. ${a.description}`).join("\n");

  try {
    const { data } = await geminiPost(apiKey, "gemini-3.5-flash", {
      contents: [{
        role: "user",
        parts: [{
          text: `You are matching a story character to the closest pre-made avatar portrait.\n\nCharacter: "${description}"\n\nAvatars:\n${list}\n\nReply with ONLY the number of the best match. Nothing else.`,
        }],
      }],
      // See findBestAvatar above: 50 not 5, or multi-digit picks truncate to
      // a wrong single digit (this is exactly how a tree once matched a pig).
      generationConfig: { temperature: 0, maxOutputTokens: 50, thinkingConfig: { thinkingBudget: 0 } },
    });

    const text = geminiText(data)?.trim() ?? "";
    const index = parseInt(text.replace(/\D/g, "")) - 1;

    if (isNaN(index) || index < 0 || index >= pool.length) {
      console.warn("[AvatarBank] unexpected Gemini response for character match:", text);
      return null;
    }
    return pool[index].image_url;
  } catch (err) {
    console.error("[AvatarBank] character matching failed:", err);
    // null, NOT pool[0]: the caller keeps the character's existing avatar /
    // the read path's deterministic fallback. Returning pool[0] here once
    // assigned an alphabetically-first pig portrait to a tree character —
    // an arbitrary wrong picture is worse than no change at all.
    return null;
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
