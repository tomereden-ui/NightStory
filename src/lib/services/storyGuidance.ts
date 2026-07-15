import fs from "fs";
import path from "path";

// Shared access to config/story-guidance.txt — the single source of truth
// for what makes a proper NightStory script, used by generate-story and
// five-question-story for full generation, and by revise-script (below) for
// a narrower subset relevant to editing an already-written script.

let cached: string | null = null;

export function readStoryGuidance(): string {
  if (cached !== null) return cached;
  try {
    cached = fs.readFileSync(path.join(process.cwd(), "config", "story-guidance.txt"), "utf-8");
  } catch {
    cached = "";
  }
  return cached;
}

// Pulls out just the sections of the guidance that still apply when EDITING
// an existing script rather than writing one from scratch — content safety,
// tone/arc guardrails, character-voice consistency, and the two formatting
// rules (performance tags, SFX descriptions) an edit could otherwise break.
// Deliberately excludes: age-band pacing, language detection, the required
// Narrator/Hero/Companion cast shape, character naming, and the JSON output
// schema (title/summary/coverPrompt/characters map) — none of that applies
// to revising blocks that already exist.
//
// Extracted by section header rather than duplicated by hand, so a future
// edit to story-guidance.txt (e.g. a new content-safety rule) automatically
// reaches revisions too. Falls back to "" per section (never throws) if a
// header ever gets renamed — a revision should still work, just without
// that section's guardrails, rather than fail outright.
function extractSection(text: string, startHeader: string, endHeader: string): string {
  const start = text.indexOf(startHeader);
  if (start === -1) return "";
  const end = text.indexOf(endHeader, start + startHeader.length);
  return (end === -1 ? text.slice(start) : text.slice(start, end)).trim();
}

let revisionCache: string | null = null;

export function readRevisionGuidance(): string {
  if (revisionCache !== null) return revisionCache;
  const full = readStoryGuidance();
  if (!full) return (revisionCache = "");

  const sections = [
    extractSection(full, "TONE AND LANGUAGE", "NARRATIVE RULES"),
    extractSection(full, "NARRATIVE RULES", "CHARACTER GUIDELINES"),
    extractSection(full, "CHARACTER GUIDELINES", "CHARACTER NAMING"),
    extractSection(full, "PERFORMANCE TAGS", "CONTENT BOUNDARIES"),
    extractSection(full, "CONTENT BOUNDARIES", "SOUND EFFECTS (SFX)"),
    extractSection(full, "WRITING GOOD SFX DESCRIPTIONS", "SCRIPT FORMAT"),
  ].filter(Boolean);

  revisionCache = sections.join("\n\n");
  return revisionCache;
}
