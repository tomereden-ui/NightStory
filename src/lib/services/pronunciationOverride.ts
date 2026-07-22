import { supabase } from "@/lib/supabase";

// Child name → confirmed TTS pronunciation override (see onboarding's "Does
// this sound right?" flow, src/app/onboarding/page.tsx). Every caller that
// sends spoken text to a TTS engine should route it through
// applyPronunciationOverrides() first — the script/DB/UI must keep showing
// the real name always; this only ever touches the text actually handed to
// the TTS engine.
export async function buildNamePronunciationMap(childIds?: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!childIds || childIds.length === 0) return map;

  const { data: childRows } = await supabase
    .from("child_profiles")
    .select("name, pronunciation_override")
    .in("id", childIds);

  for (const row of childRows ?? []) {
    const name = (row.name as string | null)?.trim();
    const override = (row.pronunciation_override as string | null)?.trim();
    if (name && override) map.set(name.toLowerCase(), override);
  }
  return map;
}

// Whole-word, case-insensitive substitution. Plain \b doesn't work here — it
// only recognizes ASCII word characters, so it silently fails to bound
// Hebrew/Arabic/etc. names — this uses Unicode letter/number classes instead
// so it works for any script the text is written in.
export function applyPronunciationOverrides(text: string, map: Map<string, string>): string {
  if (map.size === 0) return text;
  let result = text;
  map.forEach((override, realName) => {
    const escaped = realName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(^|[^\\p{L}\\p{N}])(${escaped})(?![\\p{L}\\p{N}])`, "giu");
    result = result.replace(re, (_m, before: string) => `${before}${override}`);
  });
  return result;
}
