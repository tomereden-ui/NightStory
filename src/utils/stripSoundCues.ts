export function stripSoundCues(text: string): string {
  return text.replace(/\[(SFX|MUSIC):[^\]]+\]\s*/g, "");
}

export function extractSoundCues(text: string): string[] {
  const matches = text.match(/\[(SFX|MUSIC):[^\]]+\]/g);
  return matches ?? [];
}

// Some generations/revisions bake the speaking character's own name into
// the start of their line (e.g. textPayload "קריין: פעם אחת...") even though
// the separate characterName field already conveys that — redundant, and it
// would get read aloud as if it were spoken content. Deterministic and safe
// to run on every block: a no-op unless the name is genuinely duplicated.
export function stripNamePrefix(characterName: string, textPayload: string): string {
  const name = characterName.trim();
  if (!name || name === "SFX") return textPayload;

  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const namePrefix = new RegExp(`^${escaped}\\s*[:\\-–—]\\s*`, "u");

  if (namePrefix.test(textPayload)) {
    return textPayload.replace(namePrefix, "");
  }

  // Or the name-prefix sits right after a leading [performance tag].
  const tagMatch = textPayload.match(/^(\[[^\]]+\]\s*)/);
  if (tagMatch) {
    const rest = textPayload.slice(tagMatch[0].length);
    if (namePrefix.test(rest)) {
      return tagMatch[0] + rest.replace(namePrefix, "");
    }
  }

  return textPayload;
}
