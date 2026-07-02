import { PRESET_VOICES, type PresetVoiceConfig } from "@/config/presetVoices";
import { HEBREW_VOICE_POOL, type HebrewVoice, type VoiceAgeGroup } from "@/config/hebrewVoices";
import type { VoiceGender, VoiceStyle } from "@/types";

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
  const gender = profile.gender;

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
 * Assigns a preset voice id to every distinct speaking character. When the LLM
 * supplies a `characters` map, voices are matched to each character's nature —
 * gender (hard preference) and vocal style (soft preference) — while keeping
 * assignments distinct so two characters don't collide on the same voice until
 * the pool is exhausted. Without character profiles it degrades to stable,
 * distinct, order-based assignment (the previous behaviour).
 *
 * The hero always keeps the child's chosen `primaryVoiceId`.
 */
export function assignVoicesToCharacters(
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

  // Case-insensitive lookup into the characters map (keys should match block
  // names exactly, but LLM casing occasionally drifts).
  const profileByLower = new Map<string, CharacterProfile>();
  for (const [k, v] of Object.entries(characters)) profileByLower.set(k.toLowerCase(), v);

  // Hero keeps their chosen voice; every other character draws from the rest.
  const pool = PRESET_VOICES.filter((p) => p.id !== primaryVoiceId);
  const used = new Set<string>();

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
