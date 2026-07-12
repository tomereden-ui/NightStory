import { getNarratorVoiceId } from "@/lib/narratorPreference";
import type { Voice } from "@/types";

export type CharacterType = "child" | "adult" | "animal" | "narrator";

// Bank avatar type (matches avatar-bank-list API response)
export interface BankAvatar { id: string; description: string; image_url: string; type: string; gender: string; }

// Module-level cache so we only fetch once per session
let _bankCache: BankAvatar[] | null = null;
export async function fetchBankAvatars(): Promise<BankAvatar[]> {
  if (_bankCache) return _bankCache;
  try {
    const res = await fetch("/api/avatar-bank-list");
    const data = await res.json() as { avatars: BankAvatar[] };
    _bankCache = data.avatars ?? [];
  } catch {
    _bankCache = [];
  }
  return _bankCache;
}

// Simple deterministic hash so the same character always gets the same avatar
function nameHash(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (Math.imul(31, h) + name.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function buildDiceBearUrl(characterName: string, type: CharacterType): string {
  const seed = encodeURIComponent(characterName);
  const bg = "0d1b4a";
  switch (type) {
    case "child":  return `https://api.dicebear.com/9.x/adventurer/svg?seed=${seed}&backgroundColor=${bg}`;
    case "animal": return `https://api.dicebear.com/9.x/croodles/svg?seed=${seed}&backgroundColor=${bg}&scale=90`;
    default:       return `https://api.dicebear.com/9.x/micah/svg?seed=${seed}&backgroundColor=${bg}&scale=85`;
  }
}

// Pick a bank avatar matching the character type, falling back to DiceBear on empty bank
function pickBankAvatar(characterName: string, type: CharacterType, bank: BankAvatar[]): string {
  const dbType = type === "narrator" ? "adult" : type;
  const pool = bank.filter((a) => a.type === dbType);
  // Fall back to the full bank if no type-matched entries (e.g. type column not yet populated)
  const candidates = pool.length > 0 ? pool : bank;
  if (candidates.length === 0) return buildDiceBearUrl(characterName, type);
  return candidates[nameHash(characterName) % candidates.length].image_url;
}

// For narrator characters, always use the selected narrator voice's avatar —
// more specific and intentional than a generic bank match, so it stays first
// in priority even over a persisted profile match. For every other
// character, prefer the avatar already matched to their profile
// (type/gender/visualDescription) via findBestAvatarForCharacter at
// production time or an admin "Reassign Cast Avatars" retrofit — only
// falling back to the deterministic hash pick when no such match exists yet
// (e.g. an older story that hasn't been retrofitted). Deterministic and
// free either way — no Gemini/Imagen calls — so it's safe to call on every
// render of a read-only view, not just during active story creation.
export function resolveCharacterAvatar(
  name: string,
  type: CharacterType,
  bank: BankAvatar[],
  voicePool: Voice[],
  persistedAvatarUrl?: string,
): string {
  if (type === "narrator") {
    const voiceId = getNarratorVoiceId();
    const avatar = voicePool.find((v) => v.id === voiceId)?.avatarUrl;
    if (avatar) return avatar;
  }
  if (persistedAvatarUrl) return persistedAvatarUrl;
  return pickBankAvatar(name, type, bank);
}
