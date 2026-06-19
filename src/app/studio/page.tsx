"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { readDraft, writeDraft } from "@/lib/draftStore";
import { useLanguage } from "@/context/LanguageContext";
import ScriptTab from "@/components/studio/ScriptTab";
import ProductionProgress from "@/components/studio/ProductionProgress";
import DramaPlayer from "@/components/studio/DramaPlayer";
import { PRESET_VOICE_POOL, fetchVoicePool } from "@/lib/services/voiceCatalog";
import VoiceAvatar from "@/components/ui/VoiceAvatar";
import type { ScriptBlock, Voice } from "@/types";
import type { Job } from "@/lib/jobs";
import Link from "next/link";

// ─── Character Cards ──────────────────────────────────────────────────────────

interface CastMember {
  characterName: string;
  assignedVoiceId: string;
  voice: Voice | undefined;
}

function CharacterCards({
  blocks,
  voicePool,
  onVoiceChange,
}: {
  blocks: ScriptBlock[];
  voicePool: Voice[];
  onVoiceChange: (characterName: string, voiceId: string) => void;
}) {
  const cast = Array.from(
    blocks
      .filter((b) => b.characterName !== "SFX")
      .reduce<Map<string, CastMember>>((map, b) => {
        if (!map.has(b.characterName)) {
          map.set(b.characterName, {
            characterName: b.characterName,
            assignedVoiceId: b.assignedVoiceId,
            voice: voicePool.find((v) => v.id === b.assignedVoiceId),
          });
        }
        return map;
      }, new Map())
      .values(),
  );

  if (cast.length === 0) return null;

  return (
    <div className="mb-5">
      <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(79,195,247,0.45)" }}>
        Cast
      </p>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
        {cast.map(({ characterName, assignedVoiceId, voice }) => (
          <CharacterCard
            key={characterName}
            characterName={characterName}
            assignedVoiceId={assignedVoiceId}
            voice={voice}
            voicePool={voicePool}
            onVoiceChange={(voiceId) => onVoiceChange(characterName, voiceId)}
          />
        ))}
      </div>
    </div>
  );
}

function CharacterCard({
  characterName,
  assignedVoiceId,
  voice,
  voicePool,
  onVoiceChange,
}: {
  characterName: string;
  assignedVoiceId: string;
  voice: Voice | undefined;
  voicePool: Voice[];
  onVoiceChange: (voiceId: string) => void;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Close picker on outside click
  useEffect(() => {
    if (!showPicker) return;
    const handleClick = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showPicker]);

  const isNarrator = characterName === "Narrator";

  return (
    <div ref={cardRef} className="relative flex-shrink-0 flex flex-col items-center gap-1.5 cursor-pointer" style={{ minWidth: 72 }}>
      <button
        onClick={() => setShowPicker((p) => !p)}
        className="flex flex-col items-center gap-1.5 w-full"
        title={`Change voice for ${characterName}`}
      >
        <div
          className="relative w-14 h-14 rounded-2xl flex items-center justify-center transition-all"
          style={showPicker
            ? { background: "rgba(79,195,247,0.12)", border: "2px solid rgba(79,195,247,0.55)", boxShadow: "0 0 14px rgba(79,195,247,0.2)" }
            : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }
          }
        >
          <VoiceAvatar
            avatarUrl={voice?.avatarUrl}
            emoji={voice?.avatarEmoji ?? (isNarrator ? "🎙️" : "👤")}
            size={42}
            borderColor="transparent"
          />
          {/* Change voice badge */}
          <span
            className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px]"
            style={{ background: "#0d1120", border: "1px solid rgba(79,195,247,0.3)", color: "rgba(79,195,247,0.7)" }}
          >
            ↕
          </span>
        </div>
        <span
          className="text-[10px] font-bold uppercase tracking-widest text-center leading-tight max-w-[72px] truncate"
          style={{ color: isNarrator ? "rgba(167,139,250,0.7)" : "rgba(79,195,247,0.7)" }}
        >
          {characterName}
        </span>
        {voice && (
          <span className="text-[9px] text-white/30 text-center leading-tight max-w-[72px] truncate">
            {voice.name.split(" ")[0]}
          </span>
        )}
      </button>

      {/* Inline voice picker popover */}
      {showPicker && (
        <div
          className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 rounded-2xl p-2 w-48 flex flex-col gap-1 max-h-52 overflow-y-auto"
          style={{ background: "#0d1120", border: "1px solid rgba(79,195,247,0.2)", boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}
        >
          <p className="text-[9px] font-bold uppercase tracking-widest px-1 mb-0.5" style={{ color: "rgba(79,195,247,0.4)" }}>
            {characterName}
          </p>
          {voicePool.map((v) => (
            <button
              key={v.id}
              onClick={() => { onVoiceChange(v.id); setShowPicker(false); }}
              className="flex items-center gap-2 px-2 py-1.5 rounded-xl transition-all text-left"
              style={v.id === assignedVoiceId
                ? { background: "rgba(79,195,247,0.12)", border: "1px solid rgba(79,195,247,0.3)" }
                : { background: "transparent", border: "1px solid transparent" }
              }
            >
              <VoiceAvatar avatarUrl={v.avatarUrl} emoji={v.avatarEmoji} size={24} borderColor="rgba(79,195,247,0.15)" />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-white/85 truncate">{v.name}</p>
                <p className="text-[9px] text-white/30 truncate">{v.style}</p>
              </div>
              {v.id === assignedVoiceId && (
                <span className="ml-auto text-[9px]" style={{ color: "#4fc3f7" }}>✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyStudio() {
  return (
    <div className="flex flex-col items-center py-20 text-center gap-5">
      <span className="text-6xl opacity-30">🎬</span>
      <div>
        <p className="text-white/40 text-sm font-medium mb-2">No story in the studio yet</p>
        <p className="text-white/20 text-xs leading-relaxed">
          Generate a story in Create first,<br />then come here to direct and refine it.
        </p>
      </div>
      <Link
        href="/create"
        className="mt-2 px-6 py-3 rounded-2xl text-sm font-semibold transition-all active:scale-95"
        style={{ background: "linear-gradient(90deg,#4fc3f7,#2a8cb5)", color: "#05080F" }}
      >
        ✨ Go to Create
      </Link>
    </div>
  );
}

// ─── Studio page ──────────────────────────────────────────────────────────────

type StudioView = "script" | "producing" | "drama";

export default function StudioPage() {
  const { isRTL } = useLanguage();

  const [scriptBlocks, setScriptBlocks]     = useState<ScriptBlock[]>([]);
  const [summary, setSummary]               = useState("");
  const [coverUrl, setCoverUrl]             = useState("");
  const [coverPrompt, setCoverPrompt]       = useState("");
  const [editingStoryId, setEditingStoryId] = useState<string | null>(null);
  const [durationMinutes, setDurationMinutes] = useState(3);
  const [voicePool, setVoicePool]           = useState<Voice[]>(PRESET_VOICE_POOL);
  const [loaded, setLoaded]                 = useState(false);

  const [view, setView]                     = useState<StudioView>("script");
  const [productionJobId, setProductionJobId] = useState<string | null>(null);
  const [completedJob, setCompletedJob]     = useState<Job | null>(null);
  const [isProducing, setIsProducing]       = useState(false);
  const [produceError, setProduceError]     = useState<string | null>(null);
  const [isFetchingCover, setIsFetchingCover] = useState(false);

  // Load voice pool
  useEffect(() => { fetchVoicePool().then(setVoicePool); }, []);

  // Load draft on mount
  useEffect(() => {
    const draft = readDraft();
    if (draft?.scriptBlocks?.length) {
      setScriptBlocks(draft.scriptBlocks);
      setSummary(draft.summary ?? "");
      setCoverUrl(draft.coverUrl ?? "");
      setCoverPrompt(draft.coverPrompt ?? "");
      setEditingStoryId(draft.editingStoryId ?? null);
    }
    setLoaded(true);
  }, []);

  // Persist draft on change
  useEffect(() => {
    if (!loaded) return;
    writeDraft({ promptText: "", scriptBlocks, summary, coverUrl, coverPrompt, editingStoryId: editingStoryId ?? undefined });
  }, [scriptBlocks, summary, coverUrl, coverPrompt, editingStoryId, loaded]);

  // Re-assign all blocks for a given character to a new voice
  const handleCastVoiceChange = useCallback((characterName: string, voiceId: string) => {
    setScriptBlocks((prev) =>
      prev.map((b) => b.characterName === characterName ? { ...b, assignedVoiceId: voiceId } : b)
    );
  }, []);

  const fetchCover = useCallback(async (prompt: string, storySummary?: string) => {
    if (!prompt) return;
    setIsFetchingCover(true);
    try {
      const res  = await fetch("/api/generate-cover", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, summary: storySummary }) });
      const data = await res.json();
      if (res.ok && data.imageData) {
        setCoverUrl(`data:${data.mimeType ?? "image/jpeg"};base64,${data.imageData}`);
      }
    } finally {
      setIsFetchingCover(false);
    }
  }, []);

  const handleProduce = useCallback(async (blocks: ScriptBlock[], duration: number) => {
    setIsProducing(true);
    setProduceError(null);
    setView("producing");
    try {
      const body: Record<string, unknown> = { blocks, durationMinutes: duration };
      if (editingStoryId) body.editingStoryId = editingStoryId;
      if (summary) body.summary = summary;
      if (coverPrompt) body.coverPrompt = coverPrompt;
      const coverMatch = coverUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (coverMatch) { body.coverImageMimeType = coverMatch[1]; body.coverImageData = coverMatch[2]; }
      const res  = await fetch("/api/produce-drama", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const text = await res.text();
      let data: { jobId?: string; error?: string } = {};
      try { data = JSON.parse(text); } catch { throw new Error(`Server error (${res.status})`); }
      if (!res.ok) throw new Error(data.error ?? "Production failed");
      setProductionJobId(data.jobId!);
    } catch (err: unknown) {
      setProduceError(err instanceof Error ? err.message : "Production failed");
      setIsProducing(false);
      setView("script");
    }
  }, [editingStoryId, summary, coverPrompt, coverUrl]);

  const handleProductionDone = useCallback((job: Job) => {
    setCompletedJob(job);
    setIsProducing(false);
    setView("drama");
  }, []);

  const handleProductionError = useCallback((msg: string) => {
    setProduceError(msg);
    setIsProducing(false);
    setProductionJobId(null);
    setView("script");
  }, []);

  // ─── Views ─────────────────────────────────────────────────────────────────

  if (!loaded) return null;

  if (view === "producing" && productionJobId) {
    return (
      <div className="min-h-full" dir={isRTL ? "rtl" : "ltr"}>
        <div className="px-5 pt-12 pb-8">
          <div className="flex items-center mb-7">
            <button onClick={() => { setView("script"); setIsProducing(false); setProductionJobId(null); }}
              className="w-8 h-8 flex items-center justify-center text-white/50 text-base">←</button>
            <h1 className="flex-1 text-center text-base font-semibold text-white tracking-wide">Producing…</h1>
            <div className="w-8" />
          </div>
          <ProductionProgress jobId={productionJobId} onDone={handleProductionDone} onError={handleProductionError} coverUrl={coverUrl || undefined} />
        </div>
      </div>
    );
  }

  if (view === "drama" && completedJob) {
    return (
      <div className="min-h-full" dir={isRTL ? "rtl" : "ltr"}>
        <div className="px-5 pt-12 pb-8">
          <div className="flex items-center mb-7">
            <button onClick={() => setView("script")} className="w-8 h-8 flex items-center justify-center text-white/50 text-base">←</button>
            <h1 className="flex-1 text-center text-base font-semibold text-white tracking-wide">Drama Ready</h1>
            <div className="w-8" />
          </div>
          <DramaPlayer job={completedJob} onGenerateAnother={() => { setView("script"); setCompletedJob(null); }} />
        </div>
      </div>
    );
  }

  // ─── Main script view ───────────────────────────────────────────────────────

  return (
    <div className="min-h-full" dir={isRTL ? "rtl" : "ltr"}>
      <div className="px-5 pt-12 pb-8">
        {/* Header */}
        <div className="flex items-center mb-6">
          <a href="/create" className="w-8 h-8 flex items-center justify-center text-white/50 text-base">←</a>
          <h1 className="flex-1 text-center text-base font-semibold text-white tracking-wide">🎬 Studio</h1>
          <div className="w-8" />
        </div>

        {/* Error */}
        {produceError && (
          <div className="mb-4 px-4 py-3 rounded-2xl text-xs leading-relaxed"
            style={{ background: "rgba(236,72,153,0.1)", border: "1px solid rgba(236,72,153,0.25)", color: "#EC4899" }}>
            ⚠ {produceError}
          </div>
        )}

        {scriptBlocks.length === 0 ? (
          <EmptyStudio />
        ) : (
          <>
            {/* Character Cards */}
            <CharacterCards
              blocks={scriptBlocks}
              voicePool={voicePool}
              onVoiceChange={handleCastVoiceChange}
            />

            {/* Script + Director's Note */}
            <ScriptTab
              blocks={scriptBlocks}
              voices={voicePool}
              onBlocksChange={setScriptBlocks}
              onProduce={handleProduce}
              isProducing={isProducing}
              summary={summary}
              coverUrl={coverUrl}
              isFetchingCover={isFetchingCover}
              onRegenerateCover={coverPrompt ? () => { setCoverUrl(""); fetchCover(coverPrompt, summary); } : undefined}
              durationMinutes={durationMinutes}
              onDurationChange={setDurationMinutes}
            />
          </>
        )}
      </div>
    </div>
  );
}
