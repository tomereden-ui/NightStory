export function stripSoundCues(text: string): string {
  return text.replace(/\[(SFX|MUSIC):[^\]]+\]\s*/g, "");
}

export function extractSoundCues(text: string): string[] {
  const matches = text.match(/\[(SFX|MUSIC):[^\]]+\]/g);
  return matches ?? [];
}
