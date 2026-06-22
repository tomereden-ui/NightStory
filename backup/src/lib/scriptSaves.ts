import type { ScriptBlock } from "@/types";

export interface ScriptSaveMeta {
  id: string;
  savedAt: number;
  label: string;
  blockCount: number;
  summary?: string;
  coverUrl?: string;
  isAutosave: boolean;
}

export interface ScriptSaveFull extends ScriptSaveMeta {
  blocks: ScriptBlock[];
  coverUrl?: string;
  coverPrompt?: string;
}
