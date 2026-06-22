const KEY = "nightstory_narrator_voice";
const DEFAULT = "Zephyr";

export function getNarratorVoiceId(): string {
  if (typeof window === "undefined") return DEFAULT;
  return localStorage.getItem(KEY) ?? DEFAULT;
}

export function setNarratorVoiceId(id: string): void {
  localStorage.setItem(KEY, id);
}
