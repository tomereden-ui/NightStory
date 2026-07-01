import type { ScriptBlock, StoryScene } from "@/types";
import type { CharacterProfile } from "./libraryStore";

const KEY = "nightstory_draft_v1";

export interface DraftState {
  promptText: string;
  scriptBlocks: ScriptBlock[];
  summary: string;
  coverPrompt: string;
  coverUrl: string;
  editingStoryId?: string;
  forkedFromTitle?: string;
  characterAvatars?: Record<string, string>;
  characterTypes?: Record<string, string>;
  storyTitle?: string;
  lesson?: string | null;
  lessons?: string[];
  lessonImplementations?: { lesson: string; implemented: boolean; how: string }[];
  scenes?: StoryScene[];
  characterProfiles?: Record<string, CharacterProfile>;
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
