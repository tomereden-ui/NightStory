import { NextRequest, NextResponse } from "next/server";
import type { ScriptBlock, MoralLesson } from "@/types";
import type { CharacterProfile } from "@/lib/libraryStore";
import type { TtsProvider } from "@/lib/services/ttsService";

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
    const { VoiceMap }          = await import("@/lib/services/voiceMap");
    const { addEntry }          = await import("@/lib/libraryStore");
    const { generateCoverImage } = await import("@/lib/services/imageService");
    const { profileCharacters } = await import("@/lib/services/characterProfiler");
    const { supabase, ensureBuckets } = await import("@/lib/supabase");
    const { getElementsForStory, uploadElementAudio, saveStoryElements,
            hashDialogue, hashSfx, downloadToFile } = await import("@/lib/elementStore");
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

    // ── Step 1: Drama planning + voice profiling (parallel) ─────────────────────
    updateJob(jobId, {
      status: "planning",
      step: "🗺️ Planning audio timeline…",
      progress: 5,
    });

    // Run drama planning, voice profiling, language detection, scene generation,
    // and cast-avatar matching all in parallel
    const [drama, voiceProfiles, scriptLanguage, scenes, characterProfilesWithAvatars] = await Promise.all([
      planDrama(blocks, geminiKey, durationMinutes, existingTitle),
      profileCharacters(blocks, geminiKey, characterDescriptions, characterTypes),
      detectScriptLanguage(blocks, geminiKey),
      generateScenes(blocks, geminiKey),
      matchAvatarsForProfiles(characterProfiles, geminiKey),
    ]);
    console.log(`[${ts()}][TTS] Detected language: ${scriptLanguage}`);
    updateJob(jobId, { scriptJson: drama as unknown as object, title: drama.title, progress: 18 });

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

    // ── Step 2: TTS for each dialogue line (batched parallel) ────────────────────
    updateJob(jobId, {
      status: "recording",
      step: `🎙️ Recording dialogue (0/${dialogueTracks.length})…`,
      progress: 20,
    });

    const voiceMap = new VoiceMap();
    const voiceOverrides = await buildVoiceOverrides(blocks, supabase);

    // The user's default narrator voice always wins for the Narrator
    // character. Nature-based casting at generation time already assigns
    // *something* to every character including "Narrator", so a
    // "only if unset" guard here would (and did) almost never fire --
    // this must be unconditional to actually be the default.
    if (narratorVoiceId) {
      (voiceOverrides as Record<string, { geminiVoiceName?: string }>)["Narrator"] = { geminiVoiceName: narratorVoiceId };
    }

    const skippedLines: string[] = [];
    let dialogueDone = 0;

    // ── Element audio cache ──────────────────────────────────────────────────────
    // Load cached per-element audio for this story. On the first produce this
    // will be empty; on re-produces only changed lines are regenerated.
    const elementCache = await getElementsForStory(storyId);
    type PendingUpload = { hash: string; localPath: string; type: "dialogue" | "sfx"; char?: string; text: string };
    const pendingUploads: PendingUpload[] = [];
    const newElements: Parameters<typeof saveStoryElements>[0] = [];
    let cacheDialogueHits = 0;
    let cacheSfxHits = 0;
    let sfxLibraryHits = 0;
    console.log(`[${ts()}][ElementStore] Loaded ${elementCache.size} cached elements for story ${storyId}`);

    // Once a character's line has needed the TTS fallback provider (Hebrew
    // EL remap / Chirp3-HD) instead of Gemini, every LATER line for that
    // same character in this production is forced onto the same fallback
    // rather than re-attempting Gemini. Without this, each line is an
    // independent coin flip: a transient Gemini hiccup on just one of a
    // character's lines (a burst rate limit, a 500, or 3.1's documented
    // intermittent zero-audio bug) silently swaps to a different-sounding
    // provider for only that line, while the character's other lines stay
    // on Gemini — audible as the same character's voice changing mid-story.
    // Forcing consistency from the first fallback onward turns that into at
    // most one clean switch point instead of an unpredictable back-and-forth.
    // Scoped to this single production run (a fresh Map per runProduction
    // call) — a later regeneration gets a clean shot at Gemini again.
    // Concurrent lines for the same character within one batch can still
    // race past this check before the flag is set; the fix caps how far
    // that can drift rather than eliminating every possible case.
    const characterEngineState = new Map<string, TtsProvider>();

    // Process dialogue in parallel batches. 3 was originally chosen to stay
    // comfortably under Gemini TTS's per-minute rate limit on a lower tier;
    // on the account's current paid tier that ceiling is far higher, so 3
    // concurrent requests was leaving most of the available throughput (and
    // most of a story's production wall-clock time) unused. synthesizeGemini
    // already retries 429s using Google's own Retry-After hint, so a batch
    // that does overshoot the real limit degrades gracefully instead of
    // failing — this is safe to raise further if quota headroom allows.
    const DIALOGUE_BATCH = Number(process.env.TTS_DIALOGUE_BATCH) || 6;
    for (let batchStart = 0; batchStart < dialogueTracks.length; batchStart += DIALOGUE_BATCH) {
      const batch = dialogueTracks.slice(batchStart, batchStart + DIALOGUE_BATCH);
      let batchFromCache = false;

      await Promise.all(
        batch.map(async (track) => {
          const line = track.line?.trim() ?? "";
          const charName = track.character ?? "Narrator";
          const profile = voiceProfiles[charName];
          const override = voiceOverrides[charName];

          // Use EL only when character has a cloned voice (EL IDs contain digits)
          const useELForChar = !!(override?.elevenLabsId && elevenKey);
          const ttsKey = useELForChar ? elevenKey! : geminiKey;
          const voice = useELForChar
            ? override.elevenLabsId!
            : (override?.geminiVoiceName ?? profile?.geminiVoiceName ?? pickGeminiVoiceForChar(charName, track.voice_style));
          // EL synthesizeEL rewrites .wav → .mp3; pass correct extension upfront
          const ext = useELForChar ? "mp3" : "wav";
          const outPath = path.join(jobTmp, `${track.id}.${ext}`);

          if (!line) {
            writeSilence(500, path.join(jobTmp, `${track.id}.wav`));
          } else {
            // ── Cache lookup ─────────────────────────────────────────────────────
            const voiceKey = `${useELForChar ? "el" : "gm"}:${voice}`;
            const contentHash = hashDialogue(charName, line, voiceKey);
            const cached = elementCache.get(contentHash);

            if (cached) {
              const cachedLocalPath = path.join(jobTmp, `${track.id}.mp3`);
              const ok = await downloadToFile(cached.audioUrl, cachedLocalPath);
              if (ok) {
                cacheDialogueHits++;
                batchFromCache = true;
                console.log(`[${ts()}][Cache HIT] ${charName}: "${line.slice(0, 50)}"`);
                dialogueDone++;
                updateJob(jobId, {
                  step: `🎙️ Recording dialogue (${dialogueDone}/${dialogueTracks.length})…`,
                  progress: 20 + Math.round((dialogueDone / dialogueTracks.length) * 35),
                });
                return; // skip TTS — audio already in temp dir
              }
            }

            // ── Cache miss: synthesise and queue for upload ────────────────────────
            const persona = profile?.persona;
            try {
              const vs = useELForChar ? override?.voiceSettings : undefined;
              // Explicit EL-cloned voices are never in question (useELForChar
              // pins the provider by design) — the consistency guard only
              // matters for the Gemini-primary path. The map only ever holds
              // fallback providers (see the .set() below), so presence alone
              // means "this character already needed a fallback."
              const forceFallback = !useELForChar && characterEngineState.has(charName);
              const { provider } = await synthesizeLine(
                line, voice, ttsKey, outPath, persona, useELForChar,
                vs?.stability ?? profile?.stability,
                vs?.style ?? profile?.style,
                scriptLanguage,
                undefined,
                vs?.similarity_boost,
                vs?.use_speaker_boost,
                vs?.speed,
                forceFallback,
              );
              if (!useELForChar && provider !== "gemini" && characterEngineState.get(charName) !== provider) {
                characterEngineState.set(charName, provider);
                console.warn(`[${ts()}][TTS] "${charName}" switched to ${provider} fallback for the rest of this production (Gemini TTS failed on a line)`);
              }
              const resolvedPath = [`${track.id}.mp3`, `${track.id}.wav`]
                .map((n) => path.join(jobTmp, n))
                .find((p) => fs.existsSync(p));
              if (resolvedPath) {
                pendingUploads.push({ hash: contentHash, localPath: resolvedPath, type: "dialogue", char: charName, text: line });
              }
            } catch (err) {
              console.warn(`[${ts()}][TTS] Skipping ${track.id} (${charName}): "${line.slice(0, 80)}${line.length > 80 ? "…" : ""}"`, err instanceof Error ? err.message : err);
              skippedLines.push(track.id);
              writeSilence(2000, path.join(jobTmp, `${track.id}.wav`));
            }
          }
          dialogueDone++;
          updateJob(jobId, {
            step: `🎙️ Recording dialogue (${dialogueDone}/${dialogueTracks.length})…`,
            progress: 20 + Math.round((dialogueDone / dialogueTracks.length) * 35),
          });
        }),
      );
      // Skip quota delay when entire batch was served from cache (no API calls made)
      const hasMore = batchStart + DIALOGUE_BATCH < dialogueTracks.length;
      if (hasMore && !batchFromCache) await sleep(500);
    }

    // ── Step 3: SFX generation ────────────────────────────────────────────
    let sfxDone = 0;
    if (elevenKey && sfxTracks.length > 0) {
      updateJob(jobId, {
        status: "sfx",
        step: `🔊 Generating sound effects (0/${sfxTracks.length})…`,
        progress: 57,
      });

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
              sfxDone++;
              updateJob(jobId, {
                step: `🔊 Generating sound effects (${sfxDone}/${sfxTracks.length})…`,
                progress: 57 + Math.round((sfxDone / sfxTracks.length) * 15),
              });
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
              });
              sfxDone++;
              updateJob(jobId, {
                step: `🔊 Generating sound effects (${sfxDone}/${sfxTracks.length})…`,
                progress: 57 + Math.round((sfxDone / sfxTracks.length) * 15),
              });
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
          updateJob(jobId, {
            step: `🔊 Generating sound effects (${sfxDone}/${sfxTracks.length})…`,
            progress: 57 + Math.round((sfxDone / sfxTracks.length) * 15),
          });
        }));
      }
    }

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

    const mixTrackList = drama.tracks
      .filter((t) => {
        const mp3 = path.join(jobTmp, `${t.id}.mp3`);
        const wav = path.join(jobTmp, `${t.id}.wav`);
        return fs.existsSync(mp3) || fs.existsSync(wav);
      })
      .map((t) => {
        const mp3 = path.join(jobTmp, `${t.id}.mp3`);
        const wav = path.join(jobTmp, `${t.id}.wav`);
        const startMs = t.type === "dialogue"
          ? (adjustedStartMs.get(t.id) ?? t.start_ms)
          : t.start_ms;
        return {
          filePath: fs.existsSync(mp3) ? mp3 : wav,
          startMs,
          isSfx: t.type === "sfx",
          isLooping: !!(t.type === "sfx" && t.loop),
        };
      });

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
    // produced story row is stamped with its owner.
    const familyCtx = await getFamilyContext(req).catch(() => null);

    // Fire-and-forget background processing
    runProduction(jobId, storyId, body.blocks, body.summary ?? "", geminiKey, elevenKey, durationMinutes, body.coverPrompt, existingCover, body.force, body.narratorVoiceId, body.existingCoverUrl, body.characterDescriptions, body.characterTypes, body.childIds, body.isPublic, body.isClassic, body.characterProfiles, body.skipLibrarySave, body.moralLessons, familyCtx?.familyId, body.title);

    return NextResponse.json({ jobId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[${ts()}][produce-drama] POST handler crash:`, msg);
    return NextResponse.json({ error: `Server error: ${msg}` }, { status: 500 });
  }
}
