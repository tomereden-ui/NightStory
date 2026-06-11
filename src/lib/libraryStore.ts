import fs from "fs";
import path from "path";
import type { ScriptBlock } from "@/types";

export interface LibraryEntry {
  id: string;
  title: string;
  summary: string;
  audioUrl: string;
  durationSeconds: number;
  createdAt: number;
  blocks: ScriptBlock[];
}

const DATA_DIR = path.join(process.cwd(), "data");
const LIBRARY_FILE = path.join(DATA_DIR, "library.json");

function readAll(): LibraryEntry[] {
  try {
    if (!fs.existsSync(LIBRARY_FILE)) return [];
    return JSON.parse(fs.readFileSync(LIBRARY_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function writeAll(entries: LibraryEntry[]): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(LIBRARY_FILE, JSON.stringify(entries, null, 2));
}

export function addEntry(entry: LibraryEntry): void {
  const entries = readAll();
  // Replace if same id exists, otherwise prepend
  const idx = entries.findIndex((e) => e.id === entry.id);
  if (idx >= 0) entries[idx] = entry;
  else entries.unshift(entry);
  writeAll(entries);
}

export function getEntries(): LibraryEntry[] {
  return readAll();
}

export function getEntry(id: string): LibraryEntry | undefined {
  return readAll().find((e) => e.id === id);
}
