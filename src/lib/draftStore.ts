import type { ScriptBlock } from "@/types";

const KEY = "nightstory_draft_v1";

export interface DraftState {
  promptText: string;
  scriptBlocks: ScriptBlock[];
  summary: string;
  coverPrompt: string;
  coverUrl: string;
  editingStoryId?: string;
  characterAvatars?: Record<string, string>;
  storyTitle?: string;
}

export function readDraft(): DraftState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as DraftState) : null;
  } catch {
    return null;
  }
}

export function writeDraft(state: DraftState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // quota exceeded — silently ignore
  }
}

export function clearDraft(): void {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(KEY); } catch {}
}
