import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { createJob, updateJob, pruneJobs } from "@/lib/jobs";
import { planDrama } from "@/lib/services/dramaPlanner";
import { synthesizeLine } from "@/lib/services/ttsService";
import { generateSfx, writeSilence } from "@/lib/services/sfxService";
import { mixTracks, concatenateTracks, concatenateWavFilesPureJS } from "@/lib/services/audioMixer";
import { VoiceMap } from "@/lib/services/voiceMap";
import { addEntry } from "@/lib/libraryStore";
import { generateCoverImage } from "@/lib/services/imageService";
import { profileCharacters } from "@/lib/services/characterProfiler";
import type { ScriptBlock } from "@/types";

function generateSummary(blocks: ScriptBlock[]): string {
  const narrator = blocks.find((b) => b.characterName.toLowerCase().includes("narrat"));
  const text = (narrator ?? blocks[0])?.textPayload ?? "";
  const stripped = text.replace(/\[.*?\]/g, "").trim();
  const words = stripped.split(/\s+/).filter(Boolean);
  return words.slice(0, 20).join(" ") + (words.length > 20 ? "…" : "");
}

const TMP_DIR = path.join(process.cwd(), "tmp", "audio");
const OUT_DIR = path.join(process.cwd(), "public", "output");

function ensureDirs() {
  fs.mkdirSync(TMP_DIR, { recursive: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });
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
) {
  const jobTmp = path.join(TMP_DIR, jobId);
  fs.mkdirSync(jobTmp, { recursive: true });

  try {
    // ── Step 1: Drama planning ─────────────────────────────────────────────
    updateJob(jobId, {
      status: "planning",
      step: "🗺️ Planning audio timeline…",
      progress: 5,
    });

    const drama = await planDrama(blocks, geminiKey);
    updateJob(jobId, { scriptJson: drama as unknown as object, title: drama.title, progress: 12 });

    // ── Step 1b: Voice profiling ───────────────────────────────────────────
    updateJob(jobId, {
      step: "🎭 Casting character voices…",
      progress: 15,
    });
    const voiceProfiles = await profileCharacters(blocks, geminiKey);

    const dialogueTracks = drama.tracks.filter((t) => t.type === "dialogue");
    const sfxTracks = drama.tracks.filter((t) => t.type === "sfx");
    const totalDurationMs = drama.duration_estimate_seconds * 1000;

    // ── Step 2: TTS for each dialogue line ────────────────────────────────
    updateJob(jobId, {
      status: "recording",
      step: `🎙️ Recording dialogue (0/${dialogueTracks.length})…`,
      progress: 20,
    });

    const voiceMap = new VoiceMap();
    const skippedLines: string[] = [];
    let dialogueDone = 0;

    // Generate TTS in batches of 2 to stay within rate limits
    for (let i = 0; i < dialogueTracks.length; i += 2) {
      const batch = dialogueTracks.slice(i, i + 2);
      await Promise.all(
        batch.map(async (track) => {
          const outPath = path.join(jobTmp, `${track.id}.wav`);
          const line = track.line?.trim() ?? "";
          if (!line) {
            writeSilence(500, outPath);
            dialogueDone++;
            return;
          }
          const charName = track.character ?? "Narrator";
          const profile = voiceProfiles[charName];
          const voice = profile?.voiceName ?? voiceMap.assign(charName, track.voice_style);
          const persona = profile?.persona;
          try {
            await synthesizeLine(line, voice, geminiKey, outPath, persona);
          } catch (err) {
            console.warn(`[TTS] Skipping ${track.id}:`, err);
            skippedLines.push(track.id);
            writeSilence(2000, outPath);
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
            ? Math.min(22000, totalDurationMs) // request full duration for ambient
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

    // ── Step 4: FFmpeg mix ────────────────────────────────────────────────
    updateJob(jobId, {
      status: "mixing",
      step: "🎚️ Mixing audio tracks…",
      progress: 75,
    });

    const outputFilename = `drama_${jobId}.mp3`;
    const outputPath = path.join(OUT_DIR, outputFilename);
    let audioUrl = `/output/${outputFilename}`;

    const dialoguePaths = dialogueTracks
      .map((t) => path.join(jobTmp, `${t.id}.wav`))
      .filter((p) => fs.existsSync(p));

    // Build the track list for the mixer
    const mixTrackList = drama.tracks
      .filter((t) => {
        if (t.type === "dialogue") {
          return fs.existsSync(path.join(jobTmp, `${t.id}.wav`));
        }
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
      // Level 1: full mix with SFX + timing
      await mixTracks(mixTrackList, outputPath, totalDurationMs);
    } catch (mixErr) {
      console.warn("[Mixer] ffmpeg mix failed:", mixErr);
      try {
        // Level 2: ffmpeg concat (dialogue only, no timing/SFX)
        await concatenateTracks(dialoguePaths, outputPath);
      } catch (concatErr) {
        console.warn("[Mixer] ffmpeg concat failed, using pure-JS WAV fallback:", concatErr);
        // Level 3: pure-JS WAV — works with zero native dependencies
        const wavFilename = `drama_${jobId}.wav`;
        const wavOutputPath = path.join(OUT_DIR, wavFilename);
        concatenateWavFilesPureJS(dialoguePaths, wavOutputPath);
        audioUrl = `/output/${wavFilename}`;
      }
    }

    // ── Step 5: Cover image ───────────────────────────────────────────────
    updateJob(jobId, {
      status: "mixing",
      step: "🎨 Generating cover image…",
      progress: 88,
    });

    const coverFilename = `cover_${jobId}.jpg`;
    const coverPath = path.join(OUT_DIR, coverFilename);
    const coverOk = await generateCoverImage(drama.title, blocks, geminiKey, coverPath);
    const coverUrl = coverOk ? `/output/${coverFilename}` : undefined;

    addEntry({
      id: storyId,
      title: drama.title,
      summary: summaryOverride || generateSummary(blocks),
      audioUrl,
      coverUrl,
      durationSeconds: drama.duration_estimate_seconds,
      createdAt: Date.now(),
      blocks,
    });

    updateJob(jobId, {
      status: "done",
      step: "✅ Drama ready!",
      progress: 100,
      audioUrl,
      voiceAssignments: Object.fromEntries(
        Object.entries(voiceProfiles).map(([k, v]) => [k, v.voiceName])
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
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY not configured." }, { status: 500 });
  }

  let body: { blocks: ScriptBlock[]; editingStoryId?: string; summary?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body.blocks?.length) {
    return NextResponse.json({ error: "No script blocks provided." }, { status: 400 });
  }

  ensureDirs();
  pruneJobs();

  const jobId = crypto.randomUUID();
  const storyId = body.editingStoryId ?? jobId;
  createJob(jobId);

  const elevenKey = process.env.ELEVENLABS_API_KEY ?? null;

  // Fire-and-forget background processing
  runProduction(jobId, storyId, body.blocks, body.summary ?? "", geminiKey, elevenKey);

  return NextResponse.json({ jobId });
}
