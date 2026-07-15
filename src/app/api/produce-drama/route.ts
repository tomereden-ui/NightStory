import { NextRequest, NextResponse } from "next/server";
import type { ScriptBlock, MoralLesson } from "@/types";
import type { CharacterProfile } from "@/lib/libraryStore";
import type { TtsProvider } from "@/lib/services/ttsService";
import type { DramaTrack } from "@/lib/services/dramaPlanner";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min — POST returns immediately; production runs in background
import { createJob, updateJob, pruneJobs } from "@/lib/jobs";
import { getFamilyContext } from "@/lib/authContext";
import { pickGeminiVoice as pickGeminiVoiceForChar } from "@/config/ttsDefaults";
import { PRESET_VOICES } from "@/config/presetVoices";
import type { SupabaseClient } from "@supabase/supabase-js";
import { geminiPost, geminiText } from "@/lib/geminiClient";
import { generateScenes } from "@/lib/services/sceneGenerator";
import { findBestAvatarForCharacter } from "@/lib/services/avatarBankService";

// Match every character's persisted profile (type/gender/visualDescription)
// to a real avatar-bank portrait — same profile data already driving
// nature-based voice casting below, applied to images so a newly produced
// story's cast avatars are correct from the start instead of relying on the
// read side's deterministic-but-blind hash fallback. Best-effort per
// character: a failed match just leaves avatarUrl unset. Called from inside
// the existing Promise.all planning block so it overlaps with drama
// planning/scene generation instead of adding to the critical path.
async function matchAvatarsForProfiles(
  characterProfiles: Record<string, CharacterProfile> | undefined,
  geminiKey: string,
): Promise<Record<string, CharacterProfile> | undefined> {
  if (!characterProfiles || Object.keys(characterProfiles).length === 0) return characterProfiles;
  const entries = await Promise.all(
    Object.entries(characterProfiles).map(async ([name, profile]) => {
      // Narrator's displayed avatar comes from the selected narrator voice,
      // not the bank — skip the match call entirely.
      if (profile.type === "narrator") return [name, profile] as const;
      try {
        const avatarUrl = await findBestAvatarForCharacter(profile, geminiKey);
        return [name, avatarUrl ? { ...profile, avatarUrl } : profile] as const;
      } catch (err) {
        console.warn(`[produce-drama] avatar match failed for "${name}":`, err);
        return [name, profile] as const;
      }
    }),
  );
  return Object.fromEntries(entries);
}

/**
 * Builds character → voice overrides from the user's per-block voice assignments
 * (ScriptBlockCard's VoicePicker). The first assigned voice found per character wins.
 * assignedVoiceId is resolved against the built-in Gemini presets first, then
 * against family voices created by the user (stored in Supabase).
 */
async function buildVoiceOverrides(
  blocks: ScriptBlock[],
  supabase: SupabaseClient,
): Promise<Record<string, { elevenLabsId?: string; geminiVoiceName?: string; voiceSettings?: { stability?: number; similarity_boost?: number; style?: number; use_speaker_boost?: boolean; speed?: number } }>> {
  const presetById: Record<string, { geminiVoiceName: string }> = Object.fromEntries(
    PRESET_VOICES.map((p) => [p.id, { geminiVoiceName: p.geminiVoiceName }]),
  );

  const unresolvedIds = Array.from(
    new Set(blocks.map((b) => b.assignedVoiceId).filter((id) => id && !presetById[id])),
  );

  // Real ElevenLabs voice IDs are 20-char alphanumeric strings; reject anything shorter.
  // (UUIDs and "voice-…" DB row ids contain dashes, so they never match this.)
  const isValidElId = (id: string | null | undefined): id is string =>
    typeof id === "string" && id.length >= 15 && /^[a-zA-Z0-9]+$/.test(id);

  // Hebrew stories (and manual EL picks) assign a raw EL voice id directly — use
  // it as the cloned voice without a DB lookup. Keeping these out of the DB query
  // also avoids "invalid input syntax for type uuid" errors that would otherwise
  // fail the whole family-voice resolution when one raw id is present.
  const rawElIds = unresolvedIds.filter(isValidElId);
  const dbIds = unresolvedIds.filter((id) => !isValidElId(id));
  const elById: Record<string, { elevenLabsId: string }> = Object.fromEntries(
    rawElIds.map((id) => [id, { elevenLabsId: id }]),
  );

  const familyById: Record<string, { elevenLabsId?: string; geminiVoiceName?: string; voiceSettings?: { stability?: number; similarity_boost?: number; style?: number; use_speaker_boost?: boolean; speed?: number } }> = {};
  if (dbIds.length > 0) {
    const { data, error } = await supabase.from("voices").select("*").in("id", dbIds);
    if (error) {
      console.warn(`[${ts()}][produce-drama] Failed to resolve family voices:`, error.message);
    } else {
      for (const row of data ?? []) {
        familyById[row.id] = {
          elevenLabsId: isValidElId(row.el_voice_id) ? row.el_voice_id : undefined,
          geminiVoiceName: row.gemini_voice_name ?? undefined,
          voiceSettings: row.voice_settings ?? undefined,
        };
      }
    }
  }

  const overrides: Record<string, { elevenLabsId?: string; geminiVoiceName?: string; voiceSettings?: { stability?: number; similarity_boost?: number; style?: number; use_speaker_boost?: boolean; speed?: number } }> = {};
  for (const block of blocks) {
    if (overrides[block.characterName]) continue;
    const voice = presetById[block.assignedVoiceId] ?? familyById[block.assignedVoiceId] ?? elById[block.assignedVoiceId];
    if (voice) overrides[block.characterName] = voice;
  }
  return overrides;
}

// path/fs via require so no ES-module hoisting issues alongside dynamic imports
const path = require("path") as typeof import("path"); // eslint-disable-line
const fs   = require("fs")   as typeof import("fs");   // eslint-disable-line
const os   = require("os")   as typeof import("os");   // eslint-disable-line

const ts = () => new Date().toTimeString().slice(0, 8);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function generateSummary(blocks: ScriptBlock[]): string {
  const narrator = blocks.find((b) => b.characterName.toLowerCase().includes("narrat"));
  const text = (narrator ?? blocks[0])?.textPayload ?? "";
  const stripped = text.replace(/\[.*?\]/g, "").trim();
  const words = stripped.split(/\s+/).filter(Boolean);
  return words.slice(0, 20).join(" ") + (words.length > 20 ? "…" : "");
}

async function detectScriptLanguage(blocks: ScriptBlock[], apiKey: string): Promise<string> {
  const sample = blocks
    .filter((b) => b.characterName !== "SFX")
    .slice(0, 6)
    .map((b) => b.textPayload.replace(/\[.*?\]/g, "").trim())
    .join(" ")
    .slice(0, 400);

  try {
    const { data, ok } = await geminiPost(apiKey, "gemini-3.5-flash", {
      contents: [{ role: "user", parts: [{ text: `What language is this text written in? Reply with ONLY the ISO 639-1 two-letter code (e.g. "en", "he", "ar", "fr", "de", "es"). No explanation.\n\n${sample}` }] }],
      generationConfig: { temperature: 0, maxOutputTokens: 5, thinkingConfig: { thinkingBudget: 0 } },
    });
    if (ok) {
      const code = geminiText(data).toLowerCase();
      if (code && /^[a-z]{2}$/.test(code)) return code;
    }
  } catch (err) {
    console.warn(`[${ts()}][TTS] Language detection failed:`, err);
  }
  return "en";
}

const TMP_DIR = path.join(os.tmpdir(), "nightstory-audio");

/** Read actual duration of a WAV file from its header. */
function wavDurationMs(filePath: string): number {
  try {
    const buf = fs.readFileSync(filePath);
    if (buf.length < 44 || buf.toString("ascii", 0, 4) !== "RIFF") return 0;
    const sampleRate  = buf.readUInt32LE(24);
    const numChannels = buf.readUInt16LE(22);
    const bitsPerSample = buf.readUInt16LE(34);
    const bytesPerSec = sampleRate * numChannels * (bitsPerSample / 8);
    if (!bytesPerSec) return 0;
    // Scan for the data chunk (not always at fixed offset)
    let pos = 12;
    while (pos < buf.length - 8) {
      const id = buf.toString("ascii", pos, pos + 4);
      const size = buf.readUInt32LE(pos + 4);
      if (id === "data") return Math.round((size / bytesPerSec) * 1000);
      pos += 8 + size + (size % 2);
    }
  } catch { /* ignore */ }
  return 0;
}

/** Estimate duration of an MP3 from file size at 128 kbps. */
function mp3DurationMs(filePath: string): number {
  try {
    const size = fs.statSync(filePath).size;
    return Math.round((size / (128 * 1024 / 8)) * 1000);
  } catch { return 0; }
}

function audioDurationMs(filePath: string): number {
  if (filePath.endsWith(".wav")) return wavDurationMs(filePath);
  if (filePath.endsWith(".mp3")) return mp3DurationMs(filePath);
  return 0;
}

/**
 * Recalculate dialogue start times so lines never overlap.
 * Preserves gaps from the drama plan but uses actual audio durations.
 */
function fixDialogueTiming(
  dialogueTracks: Array<{ id: string; start_ms: number }>,
  jobTmp: string,
): Map<string, number> {
  const sorted = [...dialogueTracks].sort((a, b) => a.start_ms - b.start_ms);
  const adjusted = new Map<string, number>();

  let prevEnd = 0;

  for (let i = 0; i < sorted.length; i++) {
    const t = sorted[i];
    const filePath = [".wav", ".mp3"]
      .map((e) => path.join(jobTmp, `${t.id}${e}`))
      .find((p) => fs.existsSync(p)) ?? "";

    // Planned start must not overlap previous line; push forward if needed
    const plannedStart = i === 0 ? t.start_ms : Math.max(t.start_ms, prevEnd + 200);
    adjusted.set(t.id, plannedStart);

    const duration = filePath ? audioDurationMs(filePath) : 2000;
    prevEnd = plannedStart + duration;
  }

  return adjusted;
}

// ─── Planned-vs-final production timing log ────────────────────────────────

function formatLogTimestamp(ms: number): string {
  const total = Math.max(0, Math.round(ms));
  const m = Math.floor(total / 60000);
  const s = (total % 60000) / 1000;
  return `${String(m).padStart(2, "0")}:${s.toFixed(1).padStart(4, "0")}`;
}

function formatLogSeconds(ms: number): string {
  return `${(Math.max(0, ms) / 1000).toFixed(1)}s`;
}

function sanitizeLogFilename(name: string): string {
  // Strip characters invalid on Windows/most filesystems; Unicode (Hebrew,
  // etc.) is left intact since that's supported everywhere this runs.
  const cleaned = name.trim().replace(/[<>:"/\\|?*\x00-\x1F]/g, "").replace(/\s+/g, " ").trim();
  return (cleaned || "untitled-story").slice(0, 120);
}

function describeTrack(t: DramaTrack): string {
  if (t.type === "dialogue") {
    const line = (t.line ?? "").replace(/\s+/g, " ").trim();
    return `${t.character ?? "Narrator"}: "${line.length > 90 ? line.slice(0, 90) + "…" : line}"`;
  }
  const desc = (t.description ?? "").replace(/\s+/g, " ").trim();
  return `${t.loop ? "ambient loop" : "event"}: "${desc}"`;
}

interface FinalTrackInfo {
  id: string;
  startMs: number;
  durationMs: number;
}

/**
 * Appends a human-readable planned-vs-final timing report for this
 * production run to production-logs/<story title>.log.txt (creating the
 * file and directory on first use). Answers, from a plain read of the file,
 * exactly what got planned, what actually happened once real audio existed,
 * and by how much (and why) any block's position moved.
 */
function writeProductionTimingLog(
  storyTitle: string,
  storyId: string,
  jobId: string,
  plannedTracks: DramaTrack[],
  plannedDurationEstimateSeconds: number,
  finalTrackInfoById: Map<string, FinalTrackInfo>,
  finalTotalMs: number,
): void {
  try {
    const dir = path.join(process.cwd(), "production-logs");
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, `${sanitizeLogFilename(storyTitle)}.log.txt`);

    const sortedPlanned = [...plannedTracks].sort((a, b) => a.start_ms - b.start_ms);
    const W = 90; // divider width

    const lines: string[] = [];
    lines.push("═".repeat(W));
    lines.push(`PRODUCTION RUN — ${new Date().toISOString()}`);
    lines.push(`Story: "${storyTitle}"  (story id: ${storyId}, job id: ${jobId})`);
    lines.push("═".repeat(W));
    lines.push("");
    lines.push("── PLANNED (drama planner output, before any audio existed) ──");
    lines.push(`Assessed duration: ${formatLogTimestamp(plannedDurationEstimateSeconds * 1000)} (${plannedDurationEstimateSeconds}s)`);
    lines.push("");
    for (const t of sortedPlanned) {
      const tag = t.type === "dialogue" ? "SPEECH" : t.loop ? "SFX(loop)" : "SFX";
      lines.push(`  ${formatLogTimestamp(t.start_ms)}  ${tag.padEnd(9)} ${describeTrack(t)}`);
    }
    lines.push("");
    lines.push("── FINAL (actual measured audio, positions as sent to the mixer) ──");
    lines.push(`Actual duration: ${formatLogTimestamp(finalTotalMs)} (${Math.round(finalTotalMs / 1000)}s)`);
    lines.push("");
    for (const t of sortedPlanned) {
      const final = finalTrackInfoById.get(t.id);
      const tag = t.type === "dialogue" ? "SPEECH" : t.loop ? "SFX(loop)" : "SFX";
      if (!final) {
        lines.push(`  ${"—".padEnd(9)}  ${tag.padEnd(9)} ${describeTrack(t)}   ⚠ SKIPPED (no audio produced)`);
        continue;
      }
      const delta = final.startMs - t.start_ms;
      const deltaStr = delta === 0 ? "±0.0s" : `${delta > 0 ? "+" : "-"}${formatLogSeconds(Math.abs(delta))}`;
      const driftNote = t.type === "sfx" && delta !== 0 ? " (drift-adjusted)" : "";
      const rowPrefix = `  ${formatLogTimestamp(final.startMs)}  ${tag.padEnd(9)} ${describeTrack(t)}${driftNote}`;
      // padEnd only pads a string shorter than the target -- a long line's
      // own text would otherwise run straight into "dur ..." with no space
      // at all, so fall back to a fixed small gap once the row overflows
      // the alignment column instead of relying on padEnd for a separator.
      const gap = rowPrefix.length < W - 20 ? " ".repeat(W - 20 - rowPrefix.length) : "  ";
      lines.push(`${rowPrefix}${gap}dur ${formatLogSeconds(final.durationMs).padStart(6)}   Δ ${deltaStr}`);
    }
    lines.push("");
    lines.push("═".repeat(W));
    lines.push("");
    lines.push("");

    fs.appendFileSync(filePath, lines.join("\n"), "utf-8");
    console.log(`[${ts()}][produce-drama] Wrote production timing log to ${filePath}`);
  } catch (err) {
    // Diagnostic-only — never let logging failure interrupt a real production.
    console.warn(`[${ts()}][produce-drama] writeProductionTimingLog failed:`, err);
  }
}

function ensureDirs() {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

function cleanTempDir(jobId: string) {
  try {
    const dir = path.join(TMP_DIR, jobId);
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // best effort
  }
}

// Sweep any job dirs older than 2 hours left behind by crashed processes
function sweepOrphanedTempDirs() {
  try {
    if (!fs.existsSync(TMP_DIR)) return;
    const cutoff = Date.now() - 2 * 60 * 60 * 1000;
    for (const entry of fs.readdirSync(TMP_DIR)) {
      const dir = path.join(TMP_DIR, entry);
      try {
        const stat = fs.statSync(dir);
        if (stat.isDirectory() && stat.mtimeMs < cutoff) {
          fs.rmSync(dir, { recursive: true, force: true });
          console.log(`[TempSweep] Removed orphaned dir: ${entry}`);
        }
      } catch { /* skip */ }
    }
  } catch { /* best effort */ }
}

async function runProduction(
  jobId: string,
  storyId: string,
  blocks: ScriptBlock[],
  summaryOverride: string,
  geminiKey: string,
  elevenKey: string | null,
  durationMinutes: number,
  coverPrompt?: string,
  existingCover?: { data: string; mimeType: string },
  force?: boolean,
  narratorVoiceId?: string,
  existingCoverUrl?: string,
  characterDescriptions?: Record<string, string>,
  characterTypes?: Record<string, string>,
  childIds?: string[],
  isPublic?: boolean,
  isClassic?: boolean,
  characterProfiles?: Record<string, CharacterProfile>,
  skipLibrarySave?: boolean,
  moralLessons?: MoralLesson[],
  familyId?: string,
  existingTitle?: string,
) {
  const jobTmp = path.join(TMP_DIR, jobId);
  fs.mkdirSync(jobTmp, { recursive: true });

  // Wrap EVERYTHING including dynamic imports so job always gets an error state
  try {
    const { planDrama, MAX_TRAILING_SFX_SECONDS } = await import("@/lib/services/dramaPlanner");
    const { synthesizeLine }    = await import("@/lib/services/ttsService");
    const { generateSfx, writeSilence } = await import("@/lib/services/sfxService");
    const { mixTracks, concatenateTracks, concatenateWavFilesPureJS } = await import("@/lib/services/audioMixer");
    const { addEntry }          = await import("@/lib/libraryStore");
    const { generateCoverImage } = await import("@/lib/services/imageService");
    const { profileCharacters } = await import("@/lib/services/characterProfiler");
    const { supabase, ensureBuckets } = await import("@/lib/supabase");
    const { getElementsForStory, uploadElementAudio, saveStoryElements,
            hashDialogue, hashSfx, downloadToFile, bumpElementHitCount } = await import("@/lib/elementStore");
    const { findSimilarSfx, saveSfxLibraryEntry, fitAudioDuration } = await import("@/lib/sfxLibrary");
    await ensureBuckets();

    // ── Guard: return cached audio if this story is already produced ─────────────────────
    // storyId === jobId only for brand-new stories (no editingStoryId); for
    // edits the IDs differ — so this check only fires for existing library stories.
    if (!force && storyId !== jobId) {
      const { data: cached } = await supabase
        .from("stories")
        .select("audio_url, cover_url")
        .eq("id", storyId)
        .maybeSingle();
      if (cached?.audio_url) {
        console.log(`[${ts()}][produce-drama] Story ${storyId} already produced — returning cached audio`);
        updateJob(jobId, {
          status: "done",
          step: "✅ Loaded from library",
          progress: 100,
          audioUrl: cached.audio_url,
          coverUrl: cached.cover_url ?? undefined,
          skippedLines: [],
        });
        return;
      }
    }

    // Store storyId in job so callers can retrieve it (e.g. admin save-story)
    updateJob(jobId, { storyId });

    // ── Step 1: kick off planning; synthesize dialogue in parallel with it ──
    updateJob(jobId, {
      status: "planning",
      step: "🗺️ Planning audio timeline…",
      progress: 5,
    });

    // planDrama is the slowest single LLM call in the pipeline, but dialogue
    // TTS doesn't actually need its output: the lines come from the original
    // blocks and the voices from the (fast) profiling calls below. Only SFX
    // descriptions and mix timing need the plan. So start it WITHOUT awaiting
    // and begin synthesizing dialogue immediately — planning latency
    // disappears from the critical path instead of gating everything.
    // (.then wrappers so a rejection settling before its await is reached
    // can't fire Node's unhandled-rejection handler.)
    const planPromise = planDrama(blocks, geminiKey, durationMinutes, existingTitle)
      .then((d) => ({ ok: true as const, d }), (e) => ({ ok: false as const, e }));
    // Consumed only at library-save time — failures degrade to "no scenes" /
    // unmatched avatars rather than failing the production.
    const scenesPromise = generateScenes(blocks, geminiKey).catch((err) => {
      console.warn(`[${ts()}][produce-drama] generateScenes failed:`, err);
      return [] as Awaited<ReturnType<typeof generateScenes>>;
    });
    const avatarsPromise = matchAvatarsForProfiles(characterProfiles, geminiKey).catch((err) => {
      console.warn(`[${ts()}][produce-drama] avatar matching failed:`, err);
      return characterProfiles;
    });

    const [voiceProfiles, scriptLanguage, voiceOverrides, elementCache] = await Promise.all([
      profileCharacters(blocks, geminiKey, characterDescriptions, characterTypes),
      detectScriptLanguage(blocks, geminiKey),
      buildVoiceOverrides(blocks, supabase),
      getElementsForStory(storyId),
    ]);
    console.log(`[${ts()}][TTS] Detected language: ${scriptLanguage}`);

    // The user's default narrator voice always wins for the Narrator
    // character. Nature-based casting at generation time already assigns
    // *something* to every character including "Narrator", so a
    // "only if unset" guard here would (and did) almost never fire --
    // this must be unconditional to actually be the default. Story guidance
    // has Gemini translate "Narrator" into the story's own language (e.g.
    // "קריין"/"המספר" in Hebrew), so the literal key "Narrator" alone won't
    // match for non-English scripts (admin-pasted Hebrew scripts hit this
    // every time) — also look up the real key via characterTypes' type field,
    // which survives translation, same fix generate-story already applies.
    if (narratorVoiceId) {
      const overridesByName = voiceOverrides as Record<string, { geminiVoiceName?: string }>;
      overridesByName["Narrator"] = { geminiVoiceName: narratorVoiceId };
      const narratorKey = Object.entries(characterTypes ?? {}).find(([, type]) => type === "narrator")?.[0];
      if (narratorKey) overridesByName[narratorKey] = { geminiVoiceName: narratorVoiceId };
    }

    // ── Step 2: TTS for each dialogue line, straight from the blocks ────────
    // Audio files are named dlg-<blockIndex>.*; once the plan arrives they're
    // linked to their planned track ids for the timing/mixing code below.
    const originalDialogueBlocks = blocks.filter((b) => b.characterName !== "SFX");
    updateJob(jobId, {
      status: "recording",
      step: `🎙️ Recording dialogue (0/${originalDialogueBlocks.length})…`,
      progress: 8,
    });

    type PendingUpload = { hash: string; localPath: string; type: "dialogue" | "sfx"; char?: string; text: string };
    const pendingUploads: PendingUpload[] = [];
    const newElements: Parameters<typeof saveStoryElements>[0] = [];
    let cacheDialogueHits = 0;
    let cacheSfxHits = 0;
    let sfxLibraryHits = 0;
    console.log(`[${ts()}][ElementStore] Loaded ${elementCache.size} cached elements for story ${storyId}`);

    // Progress can now arrive from two concurrent streams (dialogue + SFX) —
    // clamp to monotonic so the bar never visibly moves backwards.
    let lastProgress = 8;
    const setProgress = (progress: number, step: string) => {
      lastProgress = Math.max(lastProgress, Math.min(99, Math.round(progress)));
      updateJob(jobId, { step, progress: lastProgress });
    };

    // Once a character's line has needed the TTS fallback provider (Hebrew
    // EL remap / Chirp3-HD) instead of Gemini, every LATER line for that
    // same character in this production is forced onto the same fallback
    // rather than re-attempting Gemini. Without this, each line is an
    // independent coin flip: a transient Gemini hiccup on just one of a
    // character's lines silently swaps to a different-sounding provider for
    // only that line — audible as the same character's voice changing
    // mid-story. Concurrent lines for the same character can still race past
    // this check; the flag caps how far that drifts rather than eliminating
    // every case.
    const characterEngineState = new Map<string, TtsProvider>();

    // Batch-production TTS gets a tighter retry budget than the default
    // (5 attempts × 25s): the fallback chain (2.5 same-voice → Hebrew EL /
    // Chirp3-HD) already guarantees a usable result, so grinding through
    // long retry waits on one bad (voice, text) pair only stalls the pool.
    const FAST_TTS_OPTS = { maxAttempts: 3, perAttemptTimeoutMs: 15_000 };

    const skippedBlockIdxs = new Set<number>();
    let dialogueDone = 0;

    // Worker pool: keeps N lines in flight continuously. The old fixed
    // batch-of-N + Promise.all + 500ms sleep meant every batch waited for
    // its slowest line while the other slots sat idle — one flaky line
    // stalled five idle workers for its whole retry budget.
    const DIALOGUE_CONCURRENCY =
      Number(process.env.TTS_DIALOGUE_CONCURRENCY) || Number(process.env.TTS_DIALOGUE_BATCH) || 8;

    const synthesizeBlock = async (block: ScriptBlock, i: number): Promise<void> => {
      const line = block.textPayload.trim();
      const charName = block.characterName;
      const profile = voiceProfiles[charName];
      const override = voiceOverrides[charName];

      // Use EL only when character has a cloned voice (EL IDs contain digits)
      const useELForChar = !!(override?.elevenLabsId && elevenKey);
      const ttsKey = useELForChar ? elevenKey! : geminiKey;
      const voice = useELForChar
        ? override.elevenLabsId!
        : (override?.geminiVoiceName ?? profile?.geminiVoiceName ?? pickGeminiVoiceForChar(charName, undefined));
      // EL synthesizeEL rewrites .wav → .mp3; pass correct extension upfront
      const ext = useELForChar ? "mp3" : "wav";
      const outPath = path.join(jobTmp, `dlg-${i}.${ext}`);

      if (!line) {
        writeSilence(500, path.join(jobTmp, `dlg-${i}.wav`));
      } else {
        // ── Cache lookup — hashed on the block's own text/name, which is
        // exact by construction now that synthesis reads from blocks.
        const voiceKey = `${useELForChar ? "el" : "gm"}:${voice}`;
        const contentHash = hashDialogue(charName, line, voiceKey);
        const cached = elementCache.get(contentHash);

        if (cached) {
          const cachedLocalPath = path.join(jobTmp, `dlg-${i}.mp3`);
          const ok = await downloadToFile(cached.audioUrl, cachedLocalPath);
          if (ok) {
            cacheDialogueHits++;
            bumpElementHitCount(cached.id).catch(() => {});
            console.log(`[${ts()}][Cache HIT] ${charName}: "${line.slice(0, 50)}"`);
            dialogueDone++;
            setProgress(8 + (dialogueDone / originalDialogueBlocks.length) * 47,
              `🎙️ Recording dialogue (${dialogueDone}/${originalDialogueBlocks.length})…`);
            return; // skip TTS — audio already in temp dir
          }
        }

        // ── Cache miss: synthesise and queue for upload ────────────────────
        const persona = profile?.persona;
        try {
          const vs = useELForChar ? override?.voiceSettings : undefined;
          const forceFallback = !useELForChar && characterEngineState.has(charName);
          const { provider } = await synthesizeLine(
            line, voice, ttsKey, outPath, persona, useELForChar,
            vs?.stability ?? profile?.stability,
            vs?.style ?? profile?.style,
            scriptLanguage,
            FAST_TTS_OPTS,
            vs?.similarity_boost,
            vs?.use_speaker_boost,
            vs?.speed,
            forceFallback,
          );
          if (!useELForChar && provider !== "gemini" && characterEngineState.get(charName) !== provider) {
            characterEngineState.set(charName, provider);
            console.warn(`[${ts()}][TTS] "${charName}" switched to ${provider} fallback for the rest of this production (Gemini TTS failed on a line)`);
          }
          const resolvedPath = [`dlg-${i}.mp3`, `dlg-${i}.wav`]
            .map((n) => path.join(jobTmp, n))
            .find((p) => fs.existsSync(p));
          if (resolvedPath) {
            pendingUploads.push({ hash: contentHash, localPath: resolvedPath, type: "dialogue", char: charName, text: line });
          }
        } catch (err) {
          console.warn(`[${ts()}][TTS] Skipping block ${i} (${charName}): "${line.slice(0, 80)}${line.length > 80 ? "…" : ""}"`, err instanceof Error ? err.message : err);
          skippedBlockIdxs.add(i);
          writeSilence(2000, path.join(jobTmp, `dlg-${i}.wav`));
        }
      }
      dialogueDone++;
      setProgress(8 + (dialogueDone / originalDialogueBlocks.length) * 47,
        `🎙️ Recording dialogue (${dialogueDone}/${originalDialogueBlocks.length})…`);
    };

    // Never rejects — every line failure is caught above (worst case: the
    // line is recorded as skipped silence), so awaiting this later can't
    // blow up the whole production.
    const dialoguePromise = (async () => {
      let next = 0;
      await Promise.all(
        Array.from({ length: Math.min(DIALOGUE_CONCURRENCY, originalDialogueBlocks.length) }, async () => {
          for (;;) {
            const i = next++;
            if (i >= originalDialogueBlocks.length) return;
            try {
              await synthesizeBlock(originalDialogueBlocks[i], i);
            } catch (err) {
              console.warn(`[${ts()}][TTS] Unexpected worker error on block ${i}:`, err);
              skippedBlockIdxs.add(i);
            }
          }
        }),
      );
    })();

    // ── Await the plan (dialogue keeps synthesizing meanwhile) ──────────────
    const planResult = await planPromise;
    if (!planResult.ok) throw planResult.e;
    const drama = planResult.d;
    updateJob(jobId, { scriptJson: drama as unknown as object, title: drama.title });

    // Snapshot the plan exactly as planDrama returned it, before anything
    // below mutates start_ms/end_ms in place once real audio exists — this
    // is the "planned" half of the production log written just before mixing.
    const plannedTracksSnapshot = drama.tracks.map((t) => ({ ...t }));

    const dialogueTracks = drama.tracks.filter((t) => t.type === "dialogue");
    const sfxTracks = drama.tracks.filter((t) => t.type === "sfx");
    const totalDurationMs = drama.duration_estimate_seconds * 1000;

    // The cover was already generated once right after the script (shown in the
    // create-story UI) — reuse that image instead of generating a brand new one here.
    //
    // SSRF guard: only fetch existingCoverUrl if it points to our own Supabase
    // storage bucket. Any other hostname is rejected to prevent server-side
    // requests to internal network endpoints or cloud metadata services.
    const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
      : null;
    const isSafeStorageUrl = (url: string) => {
      try {
        const { hostname, protocol } = new URL(url);
        return (protocol === "https:" || protocol === "http:") &&
          supabaseHost !== null &&
          hostname === supabaseHost;
      } catch {
        return false;
      }
    };

    const coverPromise: Promise<{ buf: Buffer; mimeType: string } | null> = existingCover
      ? Promise.resolve({ buf: Buffer.from(existingCover.data, "base64"), mimeType: existingCover.mimeType })
      : existingCoverUrl && isSafeStorageUrl(existingCoverUrl)
        ? fetch(existingCoverUrl).then(async (r) => {
            if (!r.ok) return generateCoverImage(drama.title, blocks, geminiKey, coverPrompt);
            const buf = Buffer.from(await r.arrayBuffer());
            const mimeType = r.headers.get("content-type") ?? "image/jpeg";
            return { buf, mimeType };
          }).catch(() => generateCoverImage(drama.title, blocks, geminiKey, coverPrompt))
        : generateCoverImage(drama.title, blocks, geminiKey, coverPrompt);

    // ── Step 3: SFX generation, concurrent with the dialogue still in flight ──
    // SFX uses ElevenLabs while dialogue uses Gemini — different providers,
    // different rate limits — so there's no reason for SFX to wait for all
    // dialogue to finish the way it used to.
    let sfxDone = 0;
    const sfxPromise = (async () => {
      if (!(elevenKey && sfxTracks.length > 0)) return;

      // EL concurrent limit is 5 — batch SFX at 4 to stay safe
      const SFX_BATCH = 4;
      for (let i = 0; i < sfxTracks.length; i += SFX_BATCH) {
        await Promise.all(sfxTracks.slice(i, i + SFX_BATCH).map(async (track) => {
          const outPath = path.join(jobTmp, `${track.id}.mp3`);
          const durationHint = track.loop
            ? Math.min(22000, totalDurationMs)
            : (track.duration_hint_ms ?? 3000);
          const desc = track.description ?? "";

          // ── SFX cache lookup ─────────────────────────────────────────────
          const sfxHash = hashSfx(desc);
          const cachedSfx = elementCache.get(sfxHash);
          if (cachedSfx) {
            const ok = await downloadToFile(cachedSfx.audioUrl, outPath);
            if (ok) {
              cacheSfxHits++;
              bumpElementHitCount(cachedSfx.id).catch(() => {});
              sfxDone++;
              setProgress(57 + (sfxDone / sfxTracks.length) * 15,
                `🔊 Generating sound effects (${sfxDone}/${sfxTracks.length})…`);
              return; // skip generation
            }
          }

          // ── Global SFX library lookup (semantic similarity) ──────────────────
          const libraryHit = await findSimilarSfx(desc);
          if (libraryHit) {
            const rawPath = outPath.replace(/\.mp3$/, "-raw.mp3");
            const ok = await downloadToFile(libraryHit.audioUrl, rawPath);
            if (ok) {
              // Fit the cached clip to the script's requested duration:
              // loop it if too short, trim + fade-out if too long.
              if (!track.loop) {
                try {
                  await fitAudioDuration(rawPath, outPath, durationHint);
                } catch {
                  // Fitting failed — use raw clip as-is
                  fs.renameSync(rawPath, outPath);
                }
              } else {
                fs.renameSync(rawPath, outPath);
              }
              try { fs.unlinkSync(rawPath); } catch { /* already renamed */ }
              sfxLibraryHits++;
              // Register in story element cache so re-produces skip the library lookup
              newElements.push({
                id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
                storyId,
                elementType: "sfx",
                contentHash: sfxHash,
                audioUrl: libraryHit.audioUrl,
                durationMs: libraryHit.durationMs,
                textPayload: desc,
                createdAt: Date.now(),
                source: "sfx_library",
              });
              sfxDone++;
              setProgress(57 + (sfxDone / sfxTracks.length) * 15,
                `🔊 Generating sound effects (${sfxDone}/${sfxTracks.length})…`);
              return;
            }
          }

          // ── Cache miss: generate via ElevenLabs and queue for upload ─────────
          const sfxResult = await generateSfx(desc, durationHint, elevenKey, outPath);
          if (!sfxResult.ok) {
            writeSilence(durationHint, outPath.replace(".mp3", ".wav"));
          } else {
            pendingUploads.push({ hash: sfxHash, localPath: outPath, type: "sfx", text: desc });
          }

          sfxDone++;
          setProgress(57 + (sfxDone / sfxTracks.length) * 15,
            `🔊 Generating sound effects (${sfxDone}/${sfxTracks.length})…`);
        }));
      }
    })().catch((err) => {
      // SFX failures already degrade to silence per-track above; this only
      // catches unexpected errors so the concurrent await below can't reject.
      console.warn(`[${ts()}][produce-drama] SFX stream failed:`, err);
    });

    // Both streams (Gemini dialogue + ElevenLabs SFX) run concurrently.
    await Promise.all([dialoguePromise, sfxPromise]);

    // ── Link block audio files to their planned track ids ───────────────────
    // Dialogue was synthesized as dlg-<blockIndex>.* before the plan existed;
    // everything downstream (timing fix, mixer, production log) looks files
    // up by track id, so copy each block's audio to its track's name. Tracks
    // carry an explicit block reference from the planner; if that's missing
    // (old-style output), fall back to positional pairing when counts match.
    const skippedLines: string[] = [];
    const positionalOk = dialogueTracks.length === originalDialogueBlocks.length;
    if (!positionalOk) {
      console.warn(`[${ts()}][produce-drama] Dialogue track count (${dialogueTracks.length}) doesn't match source block count (${originalDialogueBlocks.length}) — tracks without a block reference will be skipped.`);
    }
    dialogueTracks.forEach((t, pos) => {
      const bi = typeof t.block === "number" && t.block >= 0 && t.block < originalDialogueBlocks.length
        ? t.block
        : positionalOk ? pos : undefined;
      if (bi === undefined) {
        skippedLines.push(t.id);
        return;
      }
      for (const ext of ["wav", "mp3"]) {
        const src = path.join(jobTmp, `dlg-${bi}.${ext}`);
        if (fs.existsSync(src)) fs.copyFileSync(src, path.join(jobTmp, `${t.id}.${ext}`));
      }
      if (skippedBlockIdxs.has(bi)) skippedLines.push(t.id);
    });

    // ── Step 3b: Upload newly generated elements to element-audio bucket ─────
    // This uploads to the *cache* bucket for future re-produces/cross-story
    // reuse — mixing below only reads the local files already written to
    // jobTmp, so it doesn't need to wait on this. Kick it off here but don't
    // await it until right before it's actually needed (newElements is only
    // read once, at the DB-persist step after mixing/upload/library-save),
    // letting the cache upload run concurrently with the rest of production
    // instead of serializing in front of it.
    const elementUploadPromise = pendingUploads.length === 0 ? Promise.resolve() : Promise.all(pendingUploads.map(async (pu) => {
      try {
        const audioUrl = await uploadElementAudio(storyId, pu.hash, pu.localPath);
        const durationMs = audioDurationMs(pu.localPath);
        newElements.push({
          id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
          storyId,
          elementType: pu.type,
          contentHash: pu.hash,
          audioUrl,
          durationMs,
          characterName: pu.char,
          textPayload: pu.text,
          createdAt: Date.now(),
        });
        // Save SFX clips to global library for cross-story reuse
        if (pu.type === "sfx") {
          saveSfxLibraryEntry(pu.text, durationMs, audioUrl).catch(() => {});
        }
      } catch (uploadErr) {
        console.warn(`[${ts()}][ElementStore] Upload failed for ${pu.hash.slice(0, 8)}:`, uploadErr);
      }
    })).then(() => {
      console.log(`[${ts()}][ElementStore] Uploaded ${newElements.length}/${pendingUploads.length} new elements`);
    });

    // ── Step 4: Audio mixing ────────────────────────────────────────────
    updateJob(jobId, {
      status: "mixing",
      step: "🎚️ Mixing audio tracks…",
      progress: 75,
    });

    const tmpMp3Path = path.join(jobTmp, `output.mp3`);
    const tmpWavPath = path.join(jobTmp, `output.wav`);
    let localAudioPath = tmpMp3Path;
    let audioExt = "mp3";

    const dialoguePaths = dialogueTracks
      .map((t) => {
        const wav = path.join(jobTmp, `${t.id}.wav`);
        const mp3 = path.join(jobTmp, `${t.id}.mp3`);
        return fs.existsSync(wav) ? wav : fs.existsSync(mp3) ? mp3 : null;
      })
      .filter((p): p is string => p !== null);

    // Fix dialogue timing: drama planner uses estimated durations; actual audio
    // may be longer, causing overlaps. Recalculate start_ms from real file durations.
    const adjustedStartMs = fixDialogueTiming(dialogueTracks, jobTmp);
    // Compute true end time by pairing each adjusted start with its own file's duration
    // (not dialogueTracks[i] which is unsorted and mismatches adjustedStartMs order).
    const lastDialogueEnd = Math.max(
      0,
      ...Array.from(adjustedStartMs.entries()).map(([id, s]) => {
        const fp = [".wav", ".mp3"].map((e) => path.join(jobTmp, `${id}${e}`)).find((p) => fs.existsSync(p)) ?? "";
        return s + (fp ? audioDurationMs(fp) : 2000);
      }),
    );
    // Add 2 s grace buffer so the last line isn't clipped. The planner's
    // duration_estimate_seconds is only ever allowed to extend the mix past
    // real content by a short, capped ambient wind-down (MAX_TRAILING_SFX_SECONDS)
    // -- otherwise a script that came out short of the requested length would
    // get silently masked by looping the ambient SFX track to fake a match,
    // instead of surfacing that the script itself needs to be longer.
    const naturalEnd = lastDialogueEnd + 2000;
    const requestedTail = Math.max(0, totalDurationMs - naturalEnd);
    const cappedTail = Math.min(requestedTail, MAX_TRAILING_SFX_SECONDS * 1000);
    if (requestedTail > cappedTail) {
      console.warn(
        `[${ts()}][produce-drama] Script ran ${Math.round((requestedTail - cappedTail) / 1000)}s short of the ` +
        `requested duration after capping trailing SFX at ${MAX_TRAILING_SFX_SECONDS}s -- the underlying script is too short.`,
      );
    }
    const adjustedTotal = naturalEnd + cappedTail;

    // Stamp actual start/end times onto each dialogue track so DramaPlayer
    // can display accurate subtitles and timeline positions.
    for (const t of dialogueTracks) {
      const actualStart = adjustedStartMs.get(t.id) ?? t.start_ms;
      const fp = [".wav", ".mp3"].map((e) => path.join(jobTmp, `${t.id}${e}`)).find((p) => fs.existsSync(p)) ?? "";
      const actualDur = fp ? audioDurationMs(fp) : 2000;
      t.start_ms = actualStart;
      t.end_ms   = actualStart + actualDur;
    }
    // Re-save scriptJson with corrected timings before audio is uploaded
    updateJob(jobId, { scriptJson: drama as unknown as object });

    // SFX tracks aren't touched by fixDialogueTiming above, so without this
    // they'd stay pinned to the plan's guessed position even as dialogue
    // keeps drifting later -- audible as an "event" SFX landing before/after
    // the line it was timed to accompany. Shift each SFX by however much the
    // timeline had already drifted (actual vs. planned) at that SFX's own
    // planned position, using the drift of the most recently completed
    // dialogue line up to that point (0 before any dialogue has played yet).
    const plannedDialogueStartById = new Map(
      plannedTracksSnapshot.filter((t) => t.type === "dialogue").map((t) => [t.id, t.start_ms])
    );
    const driftPoints = dialogueTracks
      .map((t) => {
        const planned = plannedDialogueStartById.get(t.id) ?? t.start_ms;
        const actual = adjustedStartMs.get(t.id) ?? planned;
        return { planned, drift: actual - planned };
      })
      .sort((a, b) => a.planned - b.planned);
    const driftAt = (plannedMs: number): number => {
      let drift = 0;
      for (const p of driftPoints) {
        if (p.planned > plannedMs) break;
        drift = p.drift;
      }
      return drift;
    };

    const finalTrackInfoById = new Map<string, FinalTrackInfo>();
    const mixTrackList = drama.tracks
      .filter((t) => {
        const mp3 = path.join(jobTmp, `${t.id}.mp3`);
        const wav = path.join(jobTmp, `${t.id}.wav`);
        return fs.existsSync(mp3) || fs.existsSync(wav);
      })
      .map((t) => {
        const mp3 = path.join(jobTmp, `${t.id}.mp3`);
        const wav = path.join(jobTmp, `${t.id}.wav`);
        const filePath = fs.existsSync(mp3) ? mp3 : wav;
        const startMs = t.type === "dialogue"
          ? (adjustedStartMs.get(t.id) ?? t.start_ms)
          : t.start_ms + driftAt(t.start_ms);
        finalTrackInfoById.set(t.id, { id: t.id, startMs, durationMs: audioDurationMs(filePath) });
        return {
          filePath,
          startMs,
          isSfx: t.type === "sfx",
          isLooping: !!(t.type === "sfx" && t.loop),
        };
      });

    writeProductionTimingLog(
      drama.title || "untitled-story",
      storyId,
      jobId,
      plannedTracksSnapshot,
      drama.duration_estimate_seconds,
      finalTrackInfoById,
      adjustedTotal,
    );

    try {
      await mixTracks(mixTrackList, tmpMp3Path, adjustedTotal);
    } catch (mixErr) {
      console.warn(`[${ts()}][Mixer] ffmpeg mix failed:`, mixErr);
      try {
        await concatenateTracks(dialoguePaths, tmpMp3Path);
      } catch (concatErr) {
        console.warn(`[${ts()}][Mixer] ffmpeg concat failed, using pure-JS WAV fallback:`, concatErr);
        concatenateWavFilesPureJS(dialoguePaths.filter((p) => p.endsWith(".wav")), tmpWavPath);
        localAudioPath = tmpWavPath;
        audioExt = "wav";
      }
    }

    // Upload audio to Supabase Storage (retry up to 3 times — upload errors used to
    // silently fall back to a local /output/ path that has no serving route, causing
    // the story to be saved with a dead audio URL).
    let audioUrl = "";
    if (fs.existsSync(localAudioPath)) {
      const audioBuf = fs.readFileSync(localAudioPath);
      const storageKey = `${storyId}.${audioExt}`;
      const contentType = audioExt === "wav" ? "audio/wav" : "audio/mpeg";
      let uploadErr: { message: string } | null = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        const { error } = await supabase.storage
          .from("audio")
          .upload(storageKey, audioBuf, { contentType, upsert: true });
        if (!error) {
          audioUrl = supabase.storage.from("audio").getPublicUrl(storageKey).data.publicUrl;
          uploadErr = null;
          break;
        }
        uploadErr = error;
        console.warn(`[${ts()}][Storage] Audio upload attempt ${attempt}/3 failed:`, error.message);
        if (attempt < 3) await new Promise((r) => setTimeout(r, attempt * 2000));
      }
      if (uploadErr) {
        // All retries exhausted — fail loudly so the user sees the real problem
        throw new Error(`Audio upload to Supabase storage failed after 3 attempts: ${uploadErr.message}`);
      }
    }

    if (!audioUrl) throw new Error("No audio produced");

    // ── Step 5: Cover image (was started earlier, just await it now) ──────
    updateJob(jobId, {
      status: "mixing",
      step: "🎨 Finishing cover image…",
      progress: 88,
    });

    let coverUrl: string | undefined;
    const coverResult = await coverPromise;
    if (coverResult) {
      const ext = coverResult.mimeType.includes("png") ? "png" : "jpg";
      const storageKey = `${storyId}.${ext}`;
      const { error: coverErr } = await supabase.storage
        .from("covers")
        .upload(storageKey, coverResult.buf, { contentType: coverResult.mimeType, upsert: true });
      if (!coverErr) {
        coverUrl = supabase.storage.from("covers").getPublicUrl(storageKey).data.publicUrl;
      } else {
        console.warn(`[${ts()}][Storage] Cover upload failed:`, coverErr.message);
      }
    }

    // Audio + cover are already uploaded to Storage at this point — don't let a
    // transient library-save failure throw away a finished production. Retry once,
    // and if it still fails, surface the job as done (with the audio/cover URLs)
    // rather than as a fatal error, so the user can still reach the file.
    let libraryError: string | undefined;
    // Kicked off back in Step 1 alongside planning — normally long settled by
    // now, so these awaits are instant.
    const scenes = await scenesPromise;
    const characterProfilesWithAvatars = await avatarsPromise;
    const entry = {
      id: storyId,
      title: drama.title,
      summary: summaryOverride || generateSummary(blocks),
      audioUrl,
      coverUrl,
      durationSeconds: Math.round(adjustedTotal / 1000),
      createdAt: Date.now(),
      blocks,
      language: scriptLanguage,
      scenes: scenes.length ? scenes : undefined,
      childIds: childIds?.length ? childIds : undefined,
      isPublic: isPublic ?? false,
      isClassic: isClassic ?? false,
      characterProfiles: characterProfilesWithAvatars && Object.keys(characterProfilesWithAvatars).length ? characterProfilesWithAvatars : undefined,
      moralLessons: moralLessons?.length ? moralLessons : undefined,
    };

    if (skipLibrarySave) {
      // Admin "preview before save" flow: store entry in job so /api/admin/save-story can persist it later
      updateJob(jobId, { pendingEntry: entry, durationSeconds: Math.round(adjustedTotal / 1000) });
    } else {
      try {
        await addEntry(entry, familyId);
      } catch (err) {
        console.warn(`[${ts()}][produce-drama] addEntry failed, retrying once:`, err);
        try {
          await addEntry(entry, familyId);
        } catch (retryErr) {
          libraryError = retryErr instanceof Error ? retryErr.message : "Failed to save to library";
          console.error(`[${ts()}][produce-drama] addEntry retry failed:`, libraryError);
        }
      }
    }

    // Wait for the element-audio cache upload kicked off before mixing —
    // it's had the entire mixing/cover/library-save duration to finish in
    // the background, so this is normally an instant no-op by now.
    await elementUploadPromise;

    // ── Persist new element records to DB (non-fatal if it fails) ────────────
    if (newElements.length > 0) {
      try {
        await saveStoryElements(newElements);
        console.log(`[${ts()}][ElementStore] Saved ${newElements.length} new elements (dialogue hits: ${cacheDialogueHits}, SFX hits: ${cacheSfxHits}, library hits: ${sfxLibraryHits})`);
      } catch (elErr) {
        console.warn(`[${ts()}][ElementStore] saveStoryElements failed:`, elErr);
      }
    }

    updateJob(jobId, {
      status: "done",
      step: libraryError ? "⚠️ Drama ready, but library save failed" : "✅ Drama ready!",
      progress: 100,
      audioUrl,
      coverUrl,
      libraryError,
      voiceAssignments: Object.fromEntries(
        Object.entries(voiceProfiles).map(([k, v]) => [k, voiceOverrides[k]?.elevenLabsId ?? v.voiceName])
      ),
      skippedLines,
      scenes: scenes.length ? scenes : undefined,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown production error";
    console.error(`[${ts()}][produce-drama] Fatal error:`, msg);
    updateJob(jobId, { status: "error", step: "❌ Production failed", error: msg, progress: 0 });
  } finally {
    cleanTempDir(jobId);
  }
}

export async function POST(req: NextRequest) {
  try {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY not configured." }, { status: 500 });
    }

    let body: {
      blocks: ScriptBlock[];
      editingStoryId?: string;
      summary?: string;
      durationMinutes?: number;
      coverPrompt?: string;
      coverImageData?: string;
      coverImageMimeType?: string;
      existingCoverUrl?: string;
      force?: boolean;
      narratorVoiceId?: string;
      characterDescriptions?: Record<string, string>;
      characterTypes?: Record<string, string>;
      characterProfiles?: Record<string, CharacterProfile>;
      childIds?: string[];
      isPublic?: boolean;
      isClassic?: boolean;
      skipLibrarySave?: boolean;
      moralLessons?: MoralLesson[];
      title?: string;
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    if (!body.blocks?.length) {
      return NextResponse.json({ error: "No script blocks provided." }, { status: 400 });
    }

    try { ensureDirs(); } catch (e) {
      console.error(`[${ts()}][produce-drama] ensureDirs failed:`, e);
      return NextResponse.json({ error: `Cannot create temp directory: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 });
    }

    sweepOrphanedTempDirs();
    pruneJobs();

    const jobId = crypto.randomUUID();
    const storyId = body.editingStoryId ?? jobId;
    createJob(jobId);

    const elevenKey = process.env.ELEVENLABS_API_KEY ?? null;

    const durationMinutes = Math.min(10, Math.max(1, body.durationMinutes ?? 3));

    const existingCover = body.coverImageData && body.coverImageMimeType
      ? { data: body.coverImageData, mimeType: body.coverImageMimeType }
      : undefined;

    // Resolve the caller's family before the request context is gone, so the
    // produced story row is stamped with its owner. Unlike every other write
    // route (child-profiles, library POST), this used to fall through to
    // `familyCtx?.familyId` being undefined on failure/no-session instead of
    // rejecting — which silently produced a real, playable story with
    // family_id NULL: invisible to any per-family query, unrecoverably
    // unattributable to whoever made it (stories have no per-user owner
    // column, only family_id). Reject instead, matching every other route.
    const familyCtx = await getFamilyContext(req).catch(() => null);
    if (!familyCtx) {
      return NextResponse.json({ error: "No family — sign in again and retry." }, { status: 403 });
    }

    // Fire-and-forget background processing
    runProduction(jobId, storyId, body.blocks, body.summary ?? "", geminiKey, elevenKey, durationMinutes, body.coverPrompt, existingCover, body.force, body.narratorVoiceId, body.existingCoverUrl, body.characterDescriptions, body.characterTypes, body.childIds, body.isPublic, body.isClassic, body.characterProfiles, body.skipLibrarySave, body.moralLessons, familyCtx.familyId, body.title);

    return NextResponse.json({ jobId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[${ts()}][produce-drama] POST handler crash:`, msg);
    return NextResponse.json({ error: `Server error: ${msg}` }, { status: 500 });
  }
}
