import { PRESET_VOICES, type PresetVoiceConfig } from "@/config/presetVoices";
import { HEBREW_VOICE_POOL, type HebrewVoice, type VoiceAgeGroup } from "@/config/hebrewVoices";
import type { VoiceGender, VoiceStyle } from "@/types";
import { geminiPost, geminiText } from "@/lib/geminiClient";
import voiceCatalog from "../../../config/voice-catalog.json";

interface NamedBlock {
  characterName: string;
}

/**
 * Structured "nature" of a character, as emitted by the story-generation LLM
 * in the `characters` map. Every field is optional so older callers (and
 * partial LLM output) degrade gracefully to name/order-based assignment.
 */
export interface CharacterProfile {
  type?: "child" | "adult" | "animal" | "narrator";
  gender?: VoiceGender;
  /** Preferred vocal character; maps directly onto a preset voice's `style`. */
  voicePersona?: VoiceStyle;
  visualDescription?: string;
}

interface VoiceNeed {
  gender?: VoiceGender;
  style?: VoiceStyle;
  age?: VoiceAgeGroup;
}

const AGE_ORDER: VoiceAgeGroup[] = ["child", "young", "adult", "elderly"];

// Styles that read as "close enough" when an exact style match isn't available.
const STYLE_NEIGHBORS: Record<VoiceStyle, VoiceStyle[]> = {
  warm:     ["gentle", "calm"],
  gentle:   ["warm", "calm"],
  calm:     ["warm", "gentle"],
  playful:  ["dramatic"],
  dramatic: ["playful", "calm"],
};

// Default vocal style implied by a character's `type` when no explicit persona
// is provided by the LLM.
const TYPE_STYLE: Record<NonNullable<CharacterProfile["type"]>, VoiceStyle> = {
  narrator: "warm",
  child:    "playful",
  adult:    "calm",
  animal:   "playful",
};

// Default age group implied by `type` (used only for Hebrew EL casting, where
// the voice pool carries an ageGroup). `animal` stays undefined — creatures span
// every age, so we don't want to force a match.
const TYPE_AGE: Partial<Record<NonNullable<CharacterProfile["type"]>, VoiceAgeGroup>> = {
  narrator: "adult",
  child:    "child",
  adult:    "adult",
};

// Age keywords scraped from visualDescription; override the type default.
const DESC_AGE: [RegExp, VoiceAgeGroup][] = [
  [/elderly|old\b|grandmother|grandma|grandfather|grandpa|ancient|wise elder/i, "elderly"],
  [/child|kid|little|young|baby|juvenile|toddler|cub|pup/i, "child"],
  [/teen|youth|young (?:woman|man)|adolescent/i, "young"],
];

// Gender keywords scraped from visualDescription — used when `gender` wasn't
// supplied directly (e.g. older stories generated before that field existed).
// Deliberately excludes bare pronouns (he/she/his/her): visualDescription is a
// noun-phrase fragment, not prose, so pronouns rarely appear and are too weak
// a signal relative to false-positive risk.
const DESC_GENDER: [RegExp, VoiceGender][] = [
  [/\b(girl|woman|female|mother|mom|grandmother|grandma|queen|princess|sister|daughter|witch|aunt|lady|granddaughter|niece)\b/i, "female"],
  [/\b(boy|man|male|father|dad|grandfather|grandpa|king|prince|brother|son|wizard|uncle|gentleman|grandson|nephew)\b/i, "male"],
];

// Keyword → style hints scraped from visualDescription as a last resort.
const DESC_STYLE: [RegExp, VoiceStyle][] = [
  [/gruff|deep|booming|grizzled|weathered|giant|mighty|bold|brave/i, "dramatic"],
  [/mischiev|playful|silly|bouncy|excit|cheeky|goofy/i, "playful"],
  [/shy|timid|soft|delicate|sleepy|tiny|meek|fragile/i, "gentle"],
  [/wise|calm|steady|measured|serene|elder|old/i, "calm"],
  [/warm|kind|gentle|nurtur|loving|comfort/i, "warm"],
];

function deriveNeed(profile: CharacterProfile | undefined): VoiceNeed {
  if (!profile) return {};
  let gender = profile.gender;
  if (!gender && profile.visualDescription) {
    for (const [re, g] of DESC_GENDER) {
      if (re.test(profile.visualDescription)) { gender = g; break; }
    }
  }

  let style: VoiceStyle | undefined = profile.voicePersona;
  if (!style && profile.visualDescription) {
    for (const [re, s] of DESC_STYLE) {
      if (re.test(profile.visualDescription)) { style = s; break; }
    }
  }
  if (!style && profile.type) style = TYPE_STYLE[profile.type];

  let age: VoiceAgeGroup | undefined;
  if (profile.visualDescription) {
    for (const [re, a] of DESC_AGE) {
      if (re.test(profile.visualDescription)) { age = a; break; }
    }
  }
  if (!age && profile.type) age = TYPE_AGE[profile.type];

  return { gender, style, age };
}

function scoreVoice(v: PresetVoiceConfig, need: VoiceNeed): number {
  let score = 0;

  if (need.gender) {
    if (v.gender === need.gender) score += 10;
    else if (v.gender === "neutral" || need.gender === "neutral") score += 3;
    else score -= 12; // wrong binary gender — a hard mismatch we almost never want
  }

  if (need.style) {
    if (v.style === need.style) score += 5;
    else if (STYLE_NEIGHBORS[need.style]?.includes(v.style)) score += 2;
  }

  return score;
}

/**
 * Picks a single best-matching preset voice for a character profile — the
 * same gender/style scoring assignVoicesToCharactersDeterministic uses for
 * the rest of the cast, exposed standalone. Used when the hero represents
 * the child themself: callers previously passed no primaryVoiceId at all in
 * that case, silently defaulting to a fixed preset (PRESET_VOICES[0])
 * regardless of the child's actual gender.
 */
export function pickVoiceForCharacterProfile(profile: CharacterProfile): string {
  const need = deriveNeed(profile);
  let best = PRESET_VOICES[0];
  let bestScore = -Infinity;
  PRESET_VOICES.forEach((c, idx) => {
    const s = scoreVoice(c, need) - idx * 0.001;
    if (s > bestScore) { bestScore = s; best = c; }
  });
  return best.id;
}

/**
 * Deterministic fallback: assigns a preset voice id to every distinct
 * speaking character by scoring gender (hard preference) and vocal style
 * (soft preference) against each candidate. This is the synchronous, free,
 * always-available path used when the Gemini casting call (below) isn't
 * possible or fails — kept as its own function so a network hiccup never
 * blocks story generation.
 */
function assignVoicesToCharactersDeterministic(
  blocks: NamedBlock[],
  heroName: string,
  primaryVoiceId: string = PRESET_VOICES[0].id,
  characters: Record<string, CharacterProfile> = {},
  excludeNames: Set<string> = new Set(),
  excludeVoiceIds: Set<string> = new Set(),
): Record<string, string> {
  const uniqueNames: string[] = [];
  for (const b of blocks) {
    if (b.characterName === "SFX") continue;
    if (excludeNames.has(b.characterName)) continue;
    if (!uniqueNames.includes(b.characterName)) uniqueNames.push(b.characterName);
  }

  // Case-insensitive lookup into the characters map (keys should match block
  // names exactly, but LLM casing occasionally drifts).
  const profileByLower = new Map<string, CharacterProfile>();
  for (const [k, v] of Object.entries(characters)) profileByLower.set(k.toLowerCase(), v);

  // Hero keeps their chosen voice; every other character draws from the rest.
  const pool = PRESET_VOICES.filter((p) => p.id !== primaryVoiceId);
  // Seeded with voices a prior pass (e.g. Gemini casting) already used, so
  // this pass can never collide with an assignment it doesn't know about.
  const used = new Set<string>(excludeVoiceIds);

  const assignments: Record<string, string> = {};
  const heroPrefix = heroName.toLowerCase().slice(0, 5);

  for (const name of uniqueNames) {
    const lower = name.toLowerCase();
    const isHero = !!heroName && lower.includes(heroPrefix) && !lower.includes("narrat");
    if (isHero) {
      assignments[name] = primaryVoiceId;
      continue;
    }

    const need = deriveNeed(profileByLower.get(lower));

    // Prefer voices not yet used; fall back to the full pool once exhausted.
    const unused = pool.filter((p) => !used.has(p.id));
    const candidates = unused.length > 0 ? unused : pool;

    let best = candidates[0] ?? PRESET_VOICES.find((p) => p.id === primaryVoiceId)!;
    let bestScore = -Infinity;
    candidates.forEach((c, idx) => {
      // Tiny order penalty keeps ties deterministic (favours earlier presets).
      const s = scoreVoice(c, need) - idx * 0.001;
      if (s > bestScore) { bestScore = s; best = c; }
    });

    assignments[name] = best.id;
    used.add(best.id);
  }

  return assignments;
}

// ── Gemini-backed casting ────────────────────────────────────────────────────
// The deterministic scorer above only ever compares a character's gender/style
// against a voice's own gender/style — it can't reason about "Peter Pan should
// sound youthful, mischievous, heroic" the way a real casting judgment could.
// config/voice-catalog.json carries each Gemini TTS voice's real pitch/pace/
// energy/texture and suggested archetypes (see that file's _readme) — feeding
// that to Gemini and asking it to actually reason about the match produces a
// materially better cast than keyword-scoring, for the cost of one extra call.

interface CatalogCastingProfile {
  pitch: string;
  pace: string;
  energy: string;
  texture: string;
  ageCharacter?: string;
  suggestedArchetypes: string[];
}
interface CatalogGeminiVoice {
  voiceName: string;
  styleDescriptor: string;
  appPresetId: string | null;
  appGender: string | null;
  castingProfile?: CatalogCastingProfile;
}

const GEMINI_CATALOG_VOICES: CatalogGeminiVoice[] =
  ((voiceCatalog as { engines: Array<{ engine: string; voices: CatalogGeminiVoice[] }> })
    .engines.find((e) => e.engine === "Gemini TTS")?.voices ?? []);

// Real Gemini engine voice name (e.g. "Iapetus") -> this app's own preset id
// (e.g. "Altair") -- most voices map 1:1, but Altair/Isonoe are app-only
// aliases for Iapetus/Pulcherrima (see config/presetVoices.ts).
const PRESET_ID_BY_GEMINI_NAME = new Map(PRESET_VOICES.map((p) => [p.geminiVoiceName, p.id]));

function buildCastingPrompt(characters: Record<string, CharacterProfile>, excludeVoiceNames: Set<string>): string {
  const voiceLines = GEMINI_CATALOG_VOICES.filter((v) => !excludeVoiceNames.has(v.voiceName)).map((v) => {
    const cp = v.castingProfile;
    const traits = cp
      ? `pitch: ${cp.pitch}, pace: ${cp.pace}, energy: ${cp.energy}, texture: ${cp.texture}${cp.ageCharacter ? `, age character: ${cp.ageCharacter}` : ""} — good fit for: ${cp.suggestedArchetypes.join(", ")}`
      : v.styleDescriptor;
    return `- "${v.voiceName}" (${v.appGender ?? "unspecified gender"}): ${traits}`;
  }).join("\n");

  const charLines = Object.entries(characters).map(([name, p]) =>
    `- "${name}": type=${p.type ?? "unspecified"}, gender=${p.gender ?? "unspecified"}, persona=${p.voicePersona ?? "unspecified"}, appearance="${p.visualDescription ?? "none given"}"`
  ).join("\n");

  return `You are a professional voice casting director for a children's bedtime audio drama.

Below is every available voice, with its real vocal qualities (pitch, pace, energy, texture) and the kinds of characters it tends to suit. Below that is a list of characters from a story, each needing exactly one voice.

For EACH character, choose the single best-matching voice by genuinely reasoning about how that voice's actual qualities (not just its label) would suit that character's nature — personality, role, gender, apparent age, and appearance — the way a real casting director would.

RULES:
- Every character MUST get a DIFFERENT voice from every other character.
- Only choose from the exact voice names listed below, spelled exactly as given.
- Gender should usually match the character unless there's a clear narrative reason not to.

AVAILABLE VOICES:
${voiceLines}

CHARACTERS TO CAST:
${charLines}

Return ONLY valid JSON, no markdown, no explanation — a map of character name to chosen voice name:
{ "CharacterName": "VoiceName", ... }`;
}

/**
 * Calls Gemini to cast every character in `characters` against the full
 * voice catalog's real casting-profile data. Returns app preset ids (not raw
 * engine voice names) keyed by character name, containing only characters
 * Gemini validly cast to a real, distinct voice — callers should fill any
 * gaps (missing/invalid/duplicate picks) with the deterministic scorer.
 */
async function castVoicesWithGemini(
  characters: Record<string, CharacterProfile>,
  apiKey: string,
  excludePresetIds: Set<string> = new Set(),
  storyId?: string,
  jobId?: string,
): Promise<Record<string, string>> {
  if (Object.keys(characters).length === 0) return {};

  // Translate excluded app preset ids (e.g. the hero's already-chosen voice)
  // to the real Gemini voice names the prompt/response actually use, so
  // Gemini isn't offered a voice that's unavailable and never double-books it.
  const excludeVoiceNames = new Set(
    GEMINI_CATALOG_VOICES.filter((v) => v.appPresetId && excludePresetIds.has(v.appPresetId)).map((v) => v.voiceName),
  );

  const { data, ok } = await geminiPost(apiKey, "gemini-3.5-flash", {
    contents: [{ role: "user", parts: [{ text: buildCastingPrompt(characters, excludeVoiceNames) }] }],
    generationConfig: { temperature: 0.4, maxOutputTokens: 2048, thinkingConfig: { thinkingBudget: 0 } },
  }, { callType: "casting", storyId, jobId });
  if (!ok) return {};

  const raw = geminiText(data).replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  let picks: Record<string, string>;
  try {
    picks = JSON.parse(raw);
  } catch {
    return {};
  }

  const assignments: Record<string, string> = {};
  const usedPresetIds = new Set<string>(excludePresetIds);
  for (const [name, geminiVoiceName] of Object.entries(picks)) {
    if (!characters[name]) continue; // Gemini invented a name not in our request
    const presetId = PRESET_ID_BY_GEMINI_NAME.get(geminiVoiceName);
    if (!presetId || usedPresetIds.has(presetId)) continue; // invalid, excluded, or duplicate pick — leave for the deterministic fallback
    assignments[name] = presetId;
    usedPresetIds.add(presetId);
  }
  return assignments;
}

/**
 * Assigns a preset voice id to every distinct speaking character. Casts via
 * Gemini (reasoning over the full catalog's real pitch/pace/energy/texture
 * data) when an apiKey is supplied; any character Gemini doesn't validly
 * cast (call failure, invalid JSON, duplicate/unknown voice name) falls back
 * to the deterministic gender/style scorer, so this never blocks story
 * generation on a network hiccup. Without an apiKey or character profiles it
 * degrades straight to the deterministic path (the original behaviour).
 *
 * The hero always keeps the child's chosen `primaryVoiceId`.
 */
export async function assignVoicesToCharacters(
  blocks: NamedBlock[],
  heroName: string,
  primaryVoiceId: string = PRESET_VOICES[0].id,
  characters: Record<string, CharacterProfile> = {},
  apiKey?: string,
  storyId?: string,
  jobId?: string,
): Promise<Record<string, string>> {
  if (!apiKey || Object.keys(characters).length === 0) {
    return assignVoicesToCharactersDeterministic(blocks, heroName, primaryVoiceId, characters);
  }

  // Hero is never sent to Gemini for casting — the child already chose that
  // voice, so exclude the hero (and the narrator, cast for pitch/gravitas
  // rather than character nature) from the pool Gemini reasons over. We still
  // need to know who's excluded for the deterministic pass below.
  const heroPrefix = heroName.toLowerCase().slice(0, 5);
  const isHeroName = (name: string) => {
    const lower = name.toLowerCase();
    return !!heroName && lower.includes(heroPrefix) && !lower.includes("narrat");
  };
  const castableCharacters = Object.fromEntries(
    Object.entries(characters).filter(([name]) => !isHeroName(name)),
  );

  let geminiAssignments: Record<string, string> = {};
  try {
    geminiAssignments = await castVoicesWithGemini(castableCharacters, apiKey, new Set([primaryVoiceId]), storyId, jobId);
  } catch (err) {
    console.warn("[voiceAssignment] Gemini casting call failed, using deterministic fallback:", err);
  }

  // Fill any character Gemini didn't validly cast (including ones missing
  // from `characters` entirely, e.g. minor characters the profiler skipped)
  // with the deterministic scorer — excluding both the character names
  // Gemini already handled AND the voice ids it already used, so the two
  // passes can never collide on the same voice.
  const alreadyCastNames = new Set(Object.keys(geminiAssignments));
  const alreadyUsedVoiceIds = new Set(Object.values(geminiAssignments));
  const fallback = assignVoicesToCharactersDeterministic(
    blocks, heroName, primaryVoiceId, characters, alreadyCastNames, alreadyUsedVoiceIds,
  );

  return { ...fallback, ...geminiAssignments };
}

/**
 * Single-character version of the nature-based matching above, for the
 * per-character "Auto Assign" button in the Direction Sheet. Scores the same
 * way assignVoicesToCharacters does, but for one character at a time so the
 * UI can apply it without touching anyone else's voice. excludeVoiceIds lets
 * the caller keep this pick distinct from voices already assigned to other
 * characters in the same story. Gemini's preset pool now voices every
 * language, so this no longer branches on Hebrew (kept as a param for
 * backward-compatible call sites, but unused here).
 */
export function pickBestVoiceForCharacter(
  profile: CharacterProfile | undefined,
  _language: string | undefined,
  excludeVoiceIds: Set<string> = new Set(),
): string | undefined {
  const need = deriveNeed(profile);

  const unused = PRESET_VOICES.filter((p) => !excludeVoiceIds.has(p.id));
  const candidates = unused.length > 0 ? unused : PRESET_VOICES;
  let best: PresetVoiceConfig | undefined;
  let bestScore = -Infinity;
  candidates.forEach((c, idx) => {
    const s = scoreVoice(c, need) - idx * 0.001;
    if (s > bestScore) { bestScore = s; best = c; }
  });
  return best?.id;
}

// ── Hebrew: cast to real ElevenLabs voices ──────────────────────────────────────
// WaveNet/Chirp can't pronounce Hebrew, so Hebrew stories are voiced entirely by
// ElevenLabs. Here we match each character to an actual EL voice by nature —
// gender (hard) + style + age (soft) — over the curated Hebrew pool, so the
// returned ids are EL voice ids that synthesizeLine can use directly.

function scoreHebrewVoice(v: HebrewVoice, need: VoiceNeed): number {
  let score = 0;

  if (need.gender) {
    if (v.gender === need.gender) score += 10;
    else if (v.gender === "neutral" || need.gender === "neutral") score += 3;
    else score -= 12;
  }

  if (need.style) {
    if (v.style === need.style) score += 5;
    else if (STYLE_NEIGHBORS[need.style]?.includes(v.style)) score += 2;
  }

  if (need.age) {
    const d = Math.abs(AGE_ORDER.indexOf(need.age) - AGE_ORDER.indexOf(v.ageGroup));
    if (d === 0) score += 4;
    else if (d === 1) score += 2;
  }

  return score;
}

export function assignHebrewVoicesToCharacters(
  blocks: NamedBlock[],
  heroName: string,
  primaryVoiceId: string = PRESET_VOICES[0].id,
  characters: Record<string, CharacterProfile> = {},
): Record<string, string> {
  const uniqueNames: string[] = [];
  for (const b of blocks) {
    if (b.characterName === "SFX") continue;
    if (!uniqueNames.includes(b.characterName)) uniqueNames.push(b.characterName);
  }

  const profileByLower = new Map<string, CharacterProfile>();
  for (const [k, v] of Object.entries(characters)) profileByLower.set(k.toLowerCase(), v);

  // The hero's chosen voice is a Gemini preset (meaningless to EL), so cast the
  // hero to the Hebrew voice that best matches that preset's own nature.
  const heroPreset = PRESET_VOICES.find((p) => p.id === primaryVoiceId);
  const heroNeed: VoiceNeed = heroPreset ? { gender: heroPreset.gender, style: heroPreset.style } : {};

  const pool = HEBREW_VOICE_POOL;
  const used = new Set<string>();
  const assignments: Record<string, string> = {};
  const heroPrefix = heroName.toLowerCase().slice(0, 5);

  const pick = (need: VoiceNeed): string => {
    const unused = pool.filter((v) => !used.has(v.id));
    const candidates = unused.length > 0 ? unused : pool;
    let best = candidates[0];
    let bestScore = -Infinity;
    candidates.forEach((c, idx) => {
      const s = scoreHebrewVoice(c, need) - idx * 0.001;
      if (s > bestScore) { bestScore = s; best = c; }
    });
    used.add(best.id);
    return best.id;
  };

  for (const name of uniqueNames) {
    const lower = name.toLowerCase();
    const isHero = !!heroName && lower.includes(heroPrefix) && !lower.includes("narrat");
    assignments[name] = pick(isHero ? heroNeed : deriveNeed(profileByLower.get(lower)));
  }

  return assignments;
}
