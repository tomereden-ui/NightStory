import { NextRequest, NextResponse } from "next/server";
import type { ScriptBlock } from "@/types";
import { createJob, updateJob, pruneJobs } from "@/lib/jobs";
import { pickGeminiVoice as pickGeminiVoiceForChar } from "@/config/ttsDefaults";
import { PRESET_VOICES } from "@/config/presetVoices";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Builds character → voice overrides from the user's per-block voice assignments
 * (ScriptBlockCard's VoicePicker). The first assigned voice found per character wins.
 * assignedVoiceId is resolved against the built-in Gemini presets first, then
 * against family voices created by the user (stored in Supabase).
 */
async function buildVoiceOverrides(
  blocks: ScriptBlock[],
  supabase: SupabaseClient,
): Promise<Record<string, { elevenLabsId?: string; geminiVoiceName?: string }>> {
  const presetById: Record<string, { geminiVoiceName: string }> = Object.fromEntries(
    PRESET_VOICES.map((p) => [p.id, { geminiVoiceName: p.geminiVoiceName }]),
  );

  const unresolvedIds = Array.from(
    new Set(blocks.map((b) => b.assignedVoiceId).filter((id) => id && !presetById[id])),
  );

  const familyById: Record<string, { elevenLabsId?: string; geminiVoiceName?: string }> = {};
  if (unresolvedIds.length > 0) {
    const { data, error } = await supabase.from("voices").select("*").in("id", unresolvedIds);
    if (error) {
      console.warn("[produce-drama] Failed to resolve family voices:", error.message);
    } else {
      for (const row of data ?? []) {
        familyById[row.id] = { elevenLabsId: row.el_voice_id ?? undefined, geminiVoiceName: row.gemini_voice_name ?? undefined };
      }
    }
  }

  const overrides: Record<string, { elevenLabsId?: string; geminiVoiceName?: string }> = {};
  for (const block of blocks) {
    if (overrides[block.characterName]) continue;
    const voice = presetById[block.assignedVoiceId] ?? familyById[block.assignedVoiceId];
    if (voice) overrides[block.characterName] = voice;
  }
  return overrides;
}

// path/fs via require so no ES-module hoisting issues alongside dynamic imports
const path = require("path") as typeof import("path"); // eslint-disable-line
const fs   = require("fs")   as typeof import("fs");   // eslint-disable-line

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
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: `What language is this text written in? Reply with ONLY the ISO 639-1 two-letter code (e.g. "en", "he", "ar", "fr", "de", "es"). No explanation.\n\n${sample}` }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 5, thinkingConfig: { thinkingBudget: 0 } },
        }),
      }
    );
    if (res.ok) {
      const data = await res.json();
      const code = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toLowerCase();
      if (code && /^[a-z]{2}$/.test(code)) return code;
    }
  } catch (err) {
    console.warn("[TTS] Language detection failed:", err);
  }
  return "en";
}

const TMP_DIR = path.join(process.cwd(), "tmp", "audio");

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
) {
  const jobTmp = path.join(TMP_DIR, jobId);
  fs.mkdirSync(jobTmp, { recursive: true });

  // Wrap EVERYTHING including dynamic imports so job always gets an error state
  try {
    const { planDrama }         = await import("@/lib/services/dramaPlanner");
    const { synthesizeLine }    = await import("@/lib/services/ttsService");
    const { generateSfx, writeSilence } = await import("@/lib/services/sfxService");
    const { mixTracks, concatenateTracks, concatenateWavFilesPureJS } = await import("@/lib/services/audioMixer");
    const { VoiceMap }          = await import("@/lib/services/voiceMap");
    const { addEntry }          = await import("@/lib/libraryStore");
    const { generateCoverImage } = await import("@/lib/services/imageService");
    const { profileCharacters } = await import("@/lib/services/characterProfiler");
    const { supabase, ensureBuckets } = await import("@/lib/supabase");
    await ensureBuckets();

    // ── Step 1: Drama planning + voice profiling (parallel) ───────────────
    updateJob(jobId, {
      status: "planning",
      step: "🗺️ Planning audio timeline…",
      progress: 5,
    });

    // Run drama planning, voice profiling, and language detection all in parallel
    const [drama, voiceProfiles, scriptLanguage] = await Promise.all([
      planDrama(blocks, geminiKey, durationMinutes),
      profileCharacters(blocks, geminiKey),
      detectScriptLanguage(blocks, geminiKey),
    ]);
    console.log(`[TTS] Detected language: ${scriptLanguage}`);
    updateJob(jobId, { scriptJson: drama as unknown as object, title: drama.title, progress: 18 });

    const dialogueTracks = drama.tracks.filter((t) => t.type === "dialogue");
    const sfxTracks = drama.tracks.filter((t) => t.type === "sfx");
    const totalDurationMs = drama.duration_estimate_seconds * 1000;

    // The cover was already generated once right after the script (shown in the
    // create-story UI) — reuse that image instead of generating a brand new one here.
    const coverPromise: Promise<{ buf: Buffer; mimeType: string } | null> = existingCover
      ? Promise.resolve({ buf: Buffer.from(existingCover.data, "base64"), mimeType: existingCover.mimeType })
      : generateCoverImage(drama.title, blocks, geminiKey, coverPrompt);

    // ── Step 2: TTS for each dialogue line (batched parallel) ────────────────
    updateJob(jobId, {
      status: "recording",
      step: `🎙️ Recording dialogue (0/${dialogueTracks.length})…`,
      progress: 20,
    });

    const voiceMap = new VoiceMap();
    const voiceOverrides = await buildVoiceOverrides(blocks, supabase);
    const skippedLines: string[] = [];
    let dialogueDone = 0;

    // Always use Gemini for TTS; ElevenLabs is reserved for SFX only.
    const useEL = false;
    const ttsKey = geminiKey;
    const BATCH_SIZE = 3; // Gemini RPM ceiling
    console.log("[TTS] Provider: Gemini, batch size: 3");

    for (let batchStart = 0; batchStart < dialogueTracks.length; batchStart += BATCH_SIZE) {
      const batch = dialogueTracks.slice(batchStart, batchStart + BATCH_SIZE);

      await Promise.all(
        batch.map(async (track) => {
          const outPath = path.join(jobTmp, `${track.id}.wav`);
          const line = track.line?.trim() ?? "";
          if (!line) {
            writeSilence(500, outPath);
          } else {
            const charName = track.character ?? "Narrator";
            const profile = voiceProfiles[charName];
            const override = voiceOverrides[charName];
            const voice = useEL
              ? (override?.elevenLabsId ?? profile?.voiceName ?? voiceMap.assign(charName, track.voice_style))
              : (override?.geminiVoiceName ?? profile?.geminiVoiceName ?? pickGeminiVoiceForChar(charName, track.voice_style));
            const persona = profile?.persona;
            try {
              await synthesizeLine(line, voice, ttsKey, outPath, persona, useEL, profile?.stability, profile?.style, scriptLanguage);
            } catch (err) {
              console.warn(`[TTS] Skipping ${track.id}:`, err);
              skippedLines.push(track.id);
              writeSilence(2000, outPath);
            }
          }
          dialogueDone++;
          updateJob(jobId, {
            step: `🎙️ Recording dialogue (${dialogueDone}/${dialogueTracks.length})…`,
            progress: 20 + Math.round((dialogueDone / dialogueTracks.length) * 35),
          });
        }),
      );
    }

    // ── Step 3: SFX generation ────────────────────────────────────────────
    let sfxDone = 0;
    if (elevenKey && sfxTracks.length > 0) {
      updateJob(jobId, {
        status: "sfx",
        step: `🔊 Generating sound effects (0/${sfxTracks.length})…`,
        progress: 57,
      });

      await Promise.all(
        sfxTracks.map(async (track) => {
          const outPath = path.join(jobTmp, `${track.id}.mp3`);
          const durationHint = track.loop
            ? Math.min(22000, totalDurationMs)
            : (track.duration_hint_ms ?? 3000);

          const sfxResult = await generateSfx(
            track.description ?? "",
            durationHint,
            elevenKey,
            outPath,
          );
          if (!sfxResult.ok) writeSilence(durationHint, outPath.replace(".mp3", ".wav"));

          sfxDone++;
          updateJob(jobId, {
            step: `🔊 Generating sound effects (${sfxDone}/${sfxTracks.length})…`,
            progress: 57 + Math.round((sfxDone / sfxTracks.length) * 15),
          });
        }),
      );
    }

    // ── Step 4: Audio mixing ──────────────────────────────────────────────
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
      .map((t) => path.join(jobTmp, `${t.id}.wav`))
      .filter((p) => fs.existsSync(p));

    const mixTrackList = drama.tracks
      .filter((t) => {
        if (t.type === "dialogue") return fs.existsSync(path.join(jobTmp, `${t.id}.wav`));
        const mp3 = path.join(jobTmp, `${t.id}.mp3`);
        const wav = path.join(jobTmp, `${t.id}.wav`);
        return fs.existsSync(mp3) || fs.existsSync(wav);
      })
      .map((t) => {
        const mp3 = path.join(jobTmp, `${t.id}.mp3`);
        const wav = path.join(jobTmp, `${t.id}.wav`);
        return {
          filePath: t.type === "dialogue" ? wav : fs.existsSync(mp3) ? mp3 : wav,
          startMs: t.start_ms,
          isSfx: t.type === "sfx",
          isLooping: !!(t.type === "sfx" && t.loop),
        };
      });

    try {
      await mixTracks(mixTrackList, tmpMp3Path, totalDurationMs);
    } catch (mixErr) {
      console.warn("[Mixer] ffmpeg mix failed:", mixErr);
      try {
        await concatenateTracks(dialoguePaths, tmpMp3Path);
      } catch (concatErr) {
        console.warn("[Mixer] ffmpeg concat failed, using pure-JS WAV fallback:", concatErr);
        concatenateWavFilesPureJS(dialoguePaths, tmpWavPath);
        localAudioPath = tmpWavPath;
        audioExt = "wav";
      }
    }

    // Upload audio to Supabase Storage
    let audioUrl = "";
    if (fs.existsSync(localAudioPath)) {
      const audioBuf = fs.readFileSync(localAudioPath);
      const storageKey = `${storyId}.${audioExt}`;
      const contentType = audioExt === "wav" ? "audio/wav" : "audio/mpeg";
      const { error: uploadErr } = await supabase.storage
        .from("audio")
        .upload(storageKey, audioBuf, { contentType, upsert: true });
      if (!uploadErr) {
        audioUrl = supabase.storage.from("audio").getPublicUrl(storageKey).data.publicUrl;
      } else {
        console.warn("[Storage] Audio upload failed:", uploadErr.message);
        // Copy to public/output as fallback
        const OUT_DIR_FALLBACK = path.join(process.cwd(), "public", "output");
        fs.mkdirSync(OUT_DIR_FALLBACK, { recursive: true });
        const fallbackName = `drama_${storyId}.${audioExt}`;
        fs.copyFileSync(localAudioPath, path.join(OUT_DIR_FALLBACK, fallbackName));
        audioUrl = `/output/${fallbackName}`;
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
        console.warn("[Storage] Cover upload failed:", coverErr.message);
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
      durationSeconds: drama.duration_estimate_seconds,
      createdAt: Date.now(),
      blocks,
    };
    try {
      await addEntry(entry);
    } catch (err) {
      console.warn("[produce-drama] addEntry failed, retrying once:", err);
      try {
        await addEntry(entry);
      } catch (retryErr) {
        libraryError = retryErr instanceof Error ? retryErr.message : "Failed to save to library";
        console.error("[produce-drama] addEntry retry failed:", libraryError);
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
    console.error("[produce-drama] Fatal error:", msg);
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
      console.error("[produce-drama] ensureDirs failed:", e);
      return NextResponse.json({ error: `Cannot create temp directory: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 });
    }

    pruneJobs();

    const jobId = crypto.randomUUID();
    const storyId = body.editingStoryId ?? jobId;
    createJob(jobId);

    const elevenKey = process.env.ELEVENLABS_API_KEY ?? null;

    const durationMinutes = Math.min(10, Math.max(1, body.durationMinutes ?? 3));

    const existingCover = body.coverImageData && body.coverImageMimeType
      ? { data: body.coverImageData, mimeType: body.coverImageMimeType }
      : undefined;

    // Fire-and-forget background processing
    runProduction(jobId, storyId, body.blocks, body.summary ?? "", geminiKey, elevenKey, durationMinutes, body.coverPrompt, existingCover);

    return NextResponse.json({ jobId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[produce-drama] POST handler crash:", msg);
    return NextResponse.json({ error: `Server error: ${msg}` }, { status: 500 });
  }
}
