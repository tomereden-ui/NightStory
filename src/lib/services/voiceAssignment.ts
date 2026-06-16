import { PRESET_VOICES } from "@/config/presetVoices";

interface NamedBlock {
  characterName: string;
}

/**
 * Assigns a voice id to every distinct character in the script. Each
 * character gets its own preset from the pool (cycling only once every
 * preset has been used), so two characters never end up sharing a voice
 * just because the assignment logic picked the same fallback for both.
 */
export function assignVoicesToCharacters(
  blocks: NamedBlock[],
  heroName: string,
  primaryVoiceId: string = PRESET_VOICES[0].id,
): Record<string, string> {
  const uniqueNames: string[] = [];
  for (const b of blocks) {
    if (b.characterName === "SFX") continue;
    if (!uniqueNames.includes(b.characterName)) uniqueNames.push(b.characterName);
  }

  const pool = PRESET_VOICES.map((p) => p.id).filter((id) => id !== primaryVoiceId);
  let poolIdx = 0;
  const nextFromPool = (): string => {
    if (pool.length === 0) return primaryVoiceId;
    const id = pool[poolIdx % pool.length];
    poolIdx++;
    return id;
  };

  const assignments: Record<string, string> = {};
  const heroPrefix = heroName.toLowerCase().slice(0, 5);
  for (const name of uniqueNames) {
    const lower = name.toLowerCase();
    if (lower.includes("narrat")) {
      assignments[name] = nextFromPool();
    } else if (heroName && lower.includes(heroPrefix)) {
      assignments[name] = primaryVoiceId;
    } else {
      assignments[name] = nextFromPool();
    }
  }
  return assignments;
}
