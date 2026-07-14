import type { ScriptBlock, StoryScene, MoralLesson } from "@/types";
import type { CharacterProfile } from "./libraryStore";

const KEY = "nightstory_draft_v1";

export interface DraftState {
  promptText: string;
  scriptBlocks: ScriptBlock[];
  summary: string;
  coverPrompt: string;
  coverUrl: string;
  coverFocusX?: number;
  coverFocusY?: number;
  editingStoryId?: string;
  forkedFromTitle?: string;
  /** The story's actual content language (ISO 639-1) — distinct from the app's UI display language. */
  language?: string;
  characterAvatars?: Record<string, string>;
  characterTypes?: Record<string, string>;
  storyTitle?: string;
  lesson?: string | null;
  lessons?: string[];
  lessonImplementations?: { lesson: string; implemented: boolean; how: string }[];
  moralLessons?: MoralLesson[];
  scenes?: StoryScene[];
  characterProfiles?: Record<string, CharacterProfile>;
  /** Whether this story already has produced audio (entry.audioUrl) — read once at load time. */
  audioUrl?: string;
  /** Paired with audioUrl — lets Studio show a real duration in the sticky player without re-fetching. */
  durationSeconds?: number;
}

export function readDraft(key = KEY): DraftState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as DraftState) : null;
  } catch {
    return null;
  }
}

export function writeDraft(state: DraftState, key = KEY): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch {
    // quota exceeded — silently ignore
  }
}

export function clearDraft(): void {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(KEY); } catch {}
}
