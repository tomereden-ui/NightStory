import fs from "fs";
import path from "path";
import type { ScriptBlock } from "@/types";

export interface LibraryEntry {
  id: string;
  title: string;
  summary: string;
  audioUrl: string;
  coverUrl?: string;
  durationSeconds: number;
  createdAt: number;
  blocks: ScriptBlock[];
}

export interface TrashEntry extends LibraryEntry {
  deletedAt: number;
}

const DATA_DIR = path.join(process.cwd(), "data");
const LIBRARY_FILE = path.join(DATA_DIR, "library.json");
const TRASH_FILE = path.join(DATA_DIR, "trash.json");
const TRASH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// ─── Library ──────────────────────────────────────────────────────────────────

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

// ─── Trash ────────────────────────────────────────────────────────────────────

function readTrash(): TrashEntry[] {
  try {
    if (!fs.existsSync(TRASH_FILE)) return [];
    return JSON.parse(fs.readFileSync(TRASH_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function writeTrash(entries: TrashEntry[]): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(TRASH_FILE, JSON.stringify(entries, null, 2));
}

function purgeExpiredTrash(entries: TrashEntry[]): TrashEntry[] {
  return entries.filter((e) => Date.now() - e.deletedAt < TRASH_TTL_MS);
}

export function getTrash(): TrashEntry[] {
  const entries = readTrash();
  const live = purgeExpiredTrash(entries);
  if (live.length !== entries.length) writeTrash(live);
  return live;
}

export function moveToTrash(id: string): boolean {
  const entries = readAll();
  const idx = entries.findIndex((e) => e.id === id);
  if (idx < 0) return false;

  const [entry] = entries.splice(idx, 1);
  writeAll(entries);

  const trash = purgeExpiredTrash(readTrash());
  trash.unshift({ ...entry, deletedAt: Date.now() });
  writeTrash(trash);
  return true;
}

export function restoreFromTrash(id: string): boolean {
  const trash = purgeExpiredTrash(readTrash());
  const idx = trash.findIndex((e) => e.id === id);
  if (idx < 0) return false;

  const [entry] = trash.splice(idx, 1);
  writeTrash(trash);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { deletedAt: _, ...restored } = entry;
  addEntry(restored as LibraryEntry);
  return true;
}

export function deleteFromTrashForever(id: string): boolean {
  const trash = purgeExpiredTrash(readTrash());
  const idx = trash.findIndex((e) => e.id === id);
  if (idx < 0) return false;
  trash.splice(idx, 1);
  writeTrash(trash);
  return true;
}

export function emptyTrash(): void {
  writeTrash([]);
}
