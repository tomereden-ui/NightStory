"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { readDraft, writeDraft } from "@/lib/draftStore";
import { useLanguage } from "@/context/LanguageContext";
import { useRouter } from "next/navigation";
import ScriptTab from "@/components/studio/ScriptTab";
import ProductionProgress from "@/components/studio/ProductionProgress";
import DramaPlayer from "@/components/studio/DramaPlayer";
import { MOCK_USER } from "@/lib/mockData";
import { PRESET_VOICE_POOL, fetchVoicePool } from "@/lib/services/voiceCatalog";
import type { ScriptBlock, Voice } from "@/types";
import type { GenerateStoryRequest } from "@/app/api/generate-story/route";
import type { Job } from "@/lib/jobs";
import type { ScriptSaveMeta, ScriptSaveFull } from "@/lib/scriptSaves";
import { FiveQuestionFlow } from "@/app/create/five-question/FiveQuestionFlow";

// ─── Script saves browser ─────────────────────────────────────────────────────

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function ScriptBrowser({
  onLoad,
  refreshKey,
  forceExpanded = false,
  onCount,
}: {
  onLoad: (save: ScriptSaveFull) => void;
  refreshKey: number;
  forceExpanded?: boolean;
  onCount?: (n: number) => void;
}) {
  const [saves, setSaves] = useState<ScriptSaveMeta[]>([]);
  const [expanded, setExpanded] = useState(forceExpanded);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/script-saves", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) { setSaves(d); onCount?.(d.length); } })
      .catch(() => {});
  }, [refreshKey]);

  if (saves.length === 0) return null;

  const handleLoad = async (id: string) => {
    setLoadingId(id);
    try {
      const res = await fetch(`/api/script-saves/${id}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Not found");
      const save = await res.json() as ScriptSaveFull;
      onLoad(save);
      setExpanded(false);
    } catch {
      // keep expanded
    } finally {
      setLoadingId(null);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingId(id);
    try {
      await fetch(`/api/script-saves/${id}`, { method: "DELETE" });
      setSaves((prev) => prev.filter((s) => s.id !== id));
    } catch {
      // ignore
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div
      className="mb-5 rounded-2xl overflow-hidden"
      style={{
        background: "linear-gradient(145deg, rgba(10,18,40,0.95) 0%, rgba(5,8,20,0.98) 100%)",
        border: "1px solid rgba(79,195,247,0.18)",
        boxShadow: "0 4px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(79,195,247,0.06) inset",
      }}
    >
      {/* Header */}
      {!forceExpanded && (
        <button
          onClick={() => setExpanded((p) => !p)}
          className="w-full flex items-center justify-between px-4 py-3 text-left"
        >
          <div className="flex items-center gap-2.5">
            <span
              className="flex items-center justify-center w-6 h-6 rounded-lg text-sm"
              style={{ background: "rgba(79,195,247,0.12)", border: "1px solid rgba(79,195,247,0.2)" }}
            >
              📂
            </span>
            <span className="text-xs font-bold tracking-widest uppercase" style={{ color: "rgba(79,195,247,0.75)", letterSpacing: "0.08em" }}>
              Saved Versions
            </span>
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-bold tabular-nums"
              style={{
                background: "linear-gradient(135deg, rgba(79,195,247,0.2), rgba(79,195,247,0.08))",
                color: "#4fc3f7",
                border: "1px solid rgba(79,195,247,0.25)",
              }}
            >
              {saves.length}
            </span>
          </div>
          <span
            className="text-white/40 text-xs transition-transform duration-200"
            style={{ display: "inline-block", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
          >
            ▾
          </span>
        </button>
      )}

      {/* Filmstrip */}
      {expanded && (
        <>
          <div
            className="h-px mx-4"
            style={{ background: "linear-gradient(90deg, transparent, rgba(79,195,247,0.15), transparent)" }}
          />
          <div
            className="flex gap-3 px-4 py-4"
            style={{ overflowX: "auto", overflowY: "hidden", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" } as React.CSSProperties}
          >
            {saves.map((s) => {
              const isLoading  = loadingId === s.id;
              const isDeleting = deletingId === s.id;
              return (
                <div key={s.id} className="relative flex-shrink-0" style={{ width: 120 }}>
                  <button
                    onClick={() => handleLoad(s.id)}
                    disabled={isLoading}
                    className="w-full flex flex-col rounded-xl overflow-hidden text-left transition-all active:scale-[0.96]"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: s.isAutosave
                        ? "1px solid rgba(79,195,247,0.35)"
                        : "1px solid rgba(255,255,255,0.1)",
                      boxShadow: s.isAutosave
                        ? "0 0 16px rgba(79,195,247,0.1)"
                        : "0 2px 12px rgba(0,0,0,0.3)",
                    }}
                  >
                    {/* Cover art */}
                    <div
                      className="relative w-full flex items-center justify-center overflow-hidden"
                      style={{ height: 90, background: "linear-gradient(135deg, rgba(20,30,60,1) 0%, rgba(10,15,35,1) 100%)" }}
                    >
                      {s.coverUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={s.coverUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-3xl opacity-30">🌙</span>
                      )}
                      {/* Gradient overlay at bottom */}
                      <div
                        className="absolute inset-x-0 bottom-0 h-8"
                        style={{ background: "linear-gradient(to top, rgba(5,8,20,0.8), transparent)" }}
                      />
                      {/* Autosave badge */}
                      {s.isAutosave && (
                        <span
                          className="absolute top-1.5 left-1.5 text-[8px] font-bold px-1.5 py-0.5 rounded-md"
                          style={{ background: "rgba(79,195,247,0.25)", color: "#4fc3f7", border: "1px solid rgba(79,195,247,0.4)" }}
                        >
                          AUTO
                        </span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex flex-col gap-0.5 px-2.5 py-2">
                      <span
                        className="text-[10px] font-bold truncate"
                        style={{ color: s.isAutosave ? "#4fc3f7" : "rgba(255,255,255,0.75)" }}
                      >
                        {isLoading ? "Loading…" : s.label}
                      </span>
                      <span className="text-[8px]" style={{ color: "rgba(255,255,255,0.28)" }}>
                        {s.blockCount} lines · {timeAgo(s.savedAt)}
                      </span>
                    </div>
                  </button>

                  {/* Delete button — floats top-right */}
                  {!s.isAutosave && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(s.id, e); }}
                      disabled={isDeleting}
                      className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] transition-all"
                      style={{ background: "rgba(0,0,0,0.55)", color: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.12)" }}
                    >
                      {isDeleting ? "…" : "×"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Character Cards ──────────────────────────────────────────────────────────

interface CastMember {
  characterName: string;
  voice: Voice | undefined;
}

function CharacterCards({
  blocks,
  voicePool,
  avatars,
  onDirectCharacter,
}: {
  blocks: ScriptBlock[];
  voicePool: Voice[];
  avatars: Record<string, string>;
  onDirectCharacter: (characterName: string, instruction: string) => void;
}) {
  const [openCharacter, setOpenCharacter] = useState<string | null>(null);

  const cast = Array.from(
    blocks
      .filter((b) => b.characterName !== "SFX")
      .reduce<Map<string, CastMember>>((map, b) => {
        if (!map.has(b.characterName)) {
          map.set(b.characterName, {
            characterName: b.characterName,
            voice: voicePool.find((v) => v.id === b.assignedVoiceId),
          });
        }
        return map;
      }, new Map())
      .values(),
  );

  if (cast.length === 0) return null;

  const openMember = openCharacter ? cast.find((c) => c.characterName === openCharacter) : null;

  return (
    <div className="mb-5">
      <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(79,195,247,0.45)" }}>
        Cast — tap to direct a character
      </p>
      <div className="flex gap-3 pb-2 -mx-5 px-5" style={{ overflowX: "scroll", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
        {cast.map(({ characterName, voice }) => (
          <CharacterCard
            key={characterName}
            characterName={characterName}
            voice={voice}
            avatarUrl={avatars[characterName]}
            isOpen={openCharacter === characterName}
            onOpen={() => setOpenCharacter(characterName)}
          />
        ))}
      </div>

      {/* Bottom sheet — rendered outside scroll container so it covers the full screen */}
      {openCharacter && openMember && (
        <DirectionSheet
          characterName={openCharacter}
          voice={openMember.voice}
          avatarUrl={avatars[openCharacter]}
          onDirect={(instruction) => onDirectCharacter(openCharacter, instruction)}
          onClose={() => setOpenCharacter(null)}
        />
      )}
    </div>
  );
}

const CHAR_CHIPS = [
  "More gentle",
  "More dramatic",
  "More playful",
  "Shorter lines",
  "More expressive",
];

// ─── Direction bottom sheet ────────────────────────────────────────────────────

function DirectionSheet({
  characterName,
  voice,
  avatarUrl,
  onDirect,
  onClose,
}: {
  characterName: string;
  voice: Voice | undefined;
  avatarUrl?: string;
  onDirect: (instruction: string) => void;
  onClose: () => void;
}) {
  const [note, setNote] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const isNarrator = characterName === "Narrator";

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 120);
  }, []);

  const submit = (instruction: string) => {
    if (!instruction.trim()) return;
    onDirect(`For the character "${characterName}": ${instruction.trim()}`);
    setNote("");
    onClose();
  };

  const initial = characterName.charAt(0).toUpperCase();
  const accentColor = isNarrator ? "rgba(167,139,250,0.8)" : "rgba(139,92,246,0.9)";
  const accentBorder = isNarrator ? "rgba(167,139,250,0.35)" : "rgba(139,92,246,0.35)";

  return (
    <>
      {/* Scrim */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl px-5 pt-5 pb-8 flex flex-col gap-4"
        style={{
          background: "linear-gradient(180deg, rgba(14,20,45,0.98) 0%, rgba(8,12,28,1) 100%)",
          border: "1px solid rgba(139,92,246,0.2)",
          borderBottom: "none",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.6), 0 -1px 0 rgba(139,92,246,0.15)",
          maxWidth: 480,
          margin: "0 auto",
        }}
      >
        {/* Handle */}
        <div className="w-10 h-1 rounded-full mx-auto -mt-1 mb-1" style={{ background: "rgba(255,255,255,0.15)" }} />

        {/* Character header */}
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-2xl overflow-hidden flex items-center justify-center flex-shrink-0"
            style={{ border: `1.5px solid ${accentBorder}`, boxShadow: `0 0 14px ${accentBorder}` }}
          >
            {(avatarUrl || voice?.avatarUrl) ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={avatarUrl || voice?.avatarUrl}
                alt={characterName}
                className="w-full h-full object-cover"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-lg font-bold"
                style={{ background: "rgba(255,255,255,0.05)", color: accentColor }}>
                {initial}
              </div>
            )}
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(139,92,246,0.6)" }}>Direct</p>
            <p className="text-sm font-bold text-white">{characterName}</p>
            {voice && <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>{voice.name}</p>}
          </div>
        </div>

        {/* Quick chips */}
        <div className="flex flex-wrap gap-2">
          {CHAR_CHIPS.map((chip) => (
            <button
              key={chip}
              onClick={() => submit(chip)}
              className="text-[11px] px-3 py-1.5 rounded-full font-medium transition-all active:scale-95"
              style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.3)", color: "#C4B5FD" }}
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Freetext */}
        <div className="flex gap-2 items-center">
          <input
            ref={inputRef}
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(note); if (e.key === "Escape") onClose(); }}
            placeholder={`Custom direction, e.g. "speak slower"`}
            className="flex-1 rounded-xl px-3.5 py-2.5 text-sm outline-none text-white/80 placeholder-white/20"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(139,92,246,0.22)" }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(139,92,246,0.55)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(139,92,246,0.22)")}
          />
          <button
            onClick={() => submit(note)}
            disabled={!note.trim()}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold transition-all active:scale-95 flex-shrink-0"
            style={note.trim()
              ? { background: "rgba(139,92,246,0.25)", border: "1px solid rgba(139,92,246,0.55)", color: "#A78BFA" }
              : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.2)" }
            }
          >↵</button>
        </div>
      </div>
    </>
  );
}

function CharacterCard({
  characterName,
  voice,
  avatarUrl,
  isOpen,
  onOpen,
}: {
  characterName: string;
  voice: Voice | undefined;
  avatarUrl?: string;
  isOpen: boolean;
  onOpen: () => void;
}) {
  const isNarrator = characterName === "Narrator";
  const initial = characterName.charAt(0).toUpperCase();

  // Cascading image fallback: generated portrait → voice avatar → styled initial
  // Each stage is tried in order; onError advances to the next.
  type ImgStage = "generated" | "voice" | "initial";
  const firstStage: ImgStage = avatarUrl ? "generated" : voice?.avatarUrl ? "voice" : "initial";
  const [imgStage, setImgStage] = useState<ImgStage>(firstStage);

  // Reset cascade when avatarUrl arrives (generated portrait loaded)
  useEffect(() => {
    if (avatarUrl) setImgStage("generated");
  }, [avatarUrl]);

  const advanceStage = () => {
    setImgStage((s) => {
      if (s === "generated") return voice?.avatarUrl ? "voice" : "initial";
      return "initial";
    });
  };

  const accentColor = isNarrator ? "rgba(167,139,250,0.7)" : "rgba(79,195,247,0.7)";

  return (
    <div className="flex-shrink-0 flex flex-col items-center gap-1.5" style={{ minWidth: 68 }}>
      <button
        onClick={onOpen}
        className="flex flex-col items-center gap-1.5 w-full"
        title={`Direct ${characterName}`}
      >
        <div
          className="w-14 h-14 rounded-2xl overflow-hidden flex items-center justify-center text-xl font-bold transition-all"
          style={isOpen
            ? { border: "2px solid rgba(139,92,246,0.65)", boxShadow: "0 0 16px rgba(139,92,246,0.3)" }
            : { border: "1px solid rgba(255,255,255,0.1)" }
          }
        >
          {imgStage === "generated" && avatarUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={avatarUrl} alt={characterName} className="w-full h-full object-cover" onError={advanceStage} />
          )}
          {imgStage === "voice" && voice?.avatarUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={voice.avatarUrl} alt={voice.name} className="w-full h-full object-cover" onError={advanceStage} />
          )}
          {imgStage === "initial" && (
            <div
              className="w-full h-full flex flex-col items-center justify-center gap-0.5"
              style={{ background: `linear-gradient(135deg, rgba(255,255,255,0.07), rgba(255,255,255,0.03))` }}
            >
              <span className="text-lg font-bold" style={{ color: accentColor }}>{initial}</span>
            </div>
          )}
        </div>
        <span
          className="text-[10px] font-bold uppercase tracking-widest text-center leading-tight truncate w-full"
          style={{ color: accentColor }}
        >
          {characterName}
        </span>
        {voice && (
          <span className="text-[9px] text-white/25 text-center truncate w-full">{voice.name.split(" ")[0]}</span>
        )}
      </button>
    </div>
  );
}

// ─── Prompt tab components ────────────────────────────────────────────────────

function DurationSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="rounded-2xl px-4 py-3 flex flex-col gap-2"
      style={{ background: "rgba(79,195,247,0.04)", border: "1px solid rgba(79,195,247,0.12)" }}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(79,195,247,0.5)" }}>
          Story length
        </span>
        <span className="text-sm font-bold" style={{ color: "#4fc3f7" }}>{value} min</span>
      </div>
      <input
        type="range" min={1} max={10} step={1} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full cursor-pointer"
        style={{ accentColor: "#4fc3f7" }}
      />
      <div className="flex justify-between text-[9px]" style={{ color: "rgba(255,255,255,0.2)" }}>
        <span>1 min</span><span>5 min</span><span>10 min</span>
      </div>
    </div>
  );
}

function PromptTabContent({
  promptText, setPromptText,
  durationMinutes, setDurationMinutes,
  generating, onGenerate,
}: {
  promptText: string; setPromptText: (v: string) => void;
  durationMinutes: number; setDurationMinutes: (v: number) => void;
  generating: boolean; onGenerate: () => void;
}) {
  const canGenerate = promptText.trim().length > 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <label className="block text-white/40 text-[10px] font-bold uppercase tracking-widest mb-2">
          Describe your story
        </label>
        <textarea
          placeholder="A sleepy dragon who can't breathe fire befriends a firefly…"
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          rows={8}
          className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 outline-none resize-none leading-relaxed"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(79,195,247,0.4)")}
          onBlur={(e)  => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}
        />
        <p className="text-white/15 text-[10px] mt-1 text-right">
          {promptText.trim().split(/\s+/).filter(Boolean).length} words
        </p>
      </div>

      <DurationSlider value={durationMinutes} onChange={setDurationMinutes} />

      <button
        onClick={onGenerate}
        disabled={!canGenerate || generating}
        className="w-full py-4 rounded-2xl font-semibold text-sm transition-all active:scale-[0.98]"
        style={
          canGenerate && !generating
            ? { background: "linear-gradient(90deg,#4fc3f7,#2a8cb5)", color: "#05080F", boxShadow: "0 4px 24px rgba(79,195,247,0.35)" }
            : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.07)" }
        }
      >
        {generating
          ? <span className="flex items-center justify-center gap-2"><span className="animate-pulse">✨</span>Generating…</span>
          : "✨ Generate Story"}
      </button>
    </div>
  );
}

// ─── Studio page ──────────────────────────────────────────────────────────────

type StudioTab = "prompt" | "five-question" | "script" | "producing" | "drama";

const TABS: { id: "prompt" | "five-question" | "script"; label: string; emoji: string }[] = [
  { id: "prompt",        label: "Prompt",       emoji: "💬" },
  { id: "five-question", label: "5 Questions",  emoji: "🧚" },
  { id: "script",        label: "Script",       emoji: "📄" },
];

export default function StudioPage() {
  const { isRTL } = useLanguage();
  const router = useRouter();

  // ─── Prompt tab state ─────────────────────────────────────────────────────
  const [promptText, setPromptText]         = useState("");
  const [generating, setGenerating]         = useState(false);
  const [generateError, setGenerateError]   = useState<string | null>(null);

  // ─── Script state ─────────────────────────────────────────────────────────
  const [scriptBlocks, setScriptBlocks]     = useState<ScriptBlock[]>([]);
  const [summary, setSummary]               = useState("");
  const [coverUrl, setCoverUrl]             = useState("");
  const [coverPrompt, setCoverPrompt]       = useState("");
  const [editingStoryId, setEditingStoryId] = useState<string | null>(null);
  const [durationMinutes, setDurationMinutes] = useState(3);
  const [voicePool, setVoicePool]           = useState<Voice[]>(PRESET_VOICE_POOL);
  const [loaded, setLoaded]                 = useState(false);

  // ─── Tab / view state ─────────────────────────────────────────────────────
  const [activeTab, setActiveTab]           = useState<StudioTab>("prompt");
  const [productionJobId, setProductionJobId] = useState<string | null>(null);
  const [completedJob, setCompletedJob]     = useState<Job | null>(null);
  const [isProducing, setIsProducing]       = useState(false);
  const [produceError, setProduceError]     = useState<string | null>(null);
  const [isFetchingCover, setIsFetchingCover] = useState(false);

  // ─── Director's Note state ────────────────────────────────────────────────
  const [directorNote, setDirectorNote]     = useState("");
  const [isRevising, setIsRevising]         = useState(false);
  const [reviseError, setReviseError]       = useState<string | null>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  // ─── Character avatars ────────────────────────────────────────────────────
  const [characterAvatars, setCharacterAvatars] = useState<Record<string, string>>({});
  const avatarSeedingRef = useRef(false);

  // ─── Pending character directions ─────────────────────────────────────────
  const [pendingDirections, setPendingDirections] = useState<string[]>([]);
  const [showToast, setShowToast] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Saves ────────────────────────────────────────────────────────────────
  const [savesRefreshKey, setSavesRefreshKey] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveLabel, setSaveLabel] = useState<"idle" | "saving" | "saved">("idle");
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Story title / versions sheet ────────────────────────────────────────
  const [storyTitle, setStoryTitle] = useState("");
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [savesCount, setSavesCount] = useState(0);

  // Load voice pool
  useEffect(() => { fetchVoicePool().then(setVoicePool); }, []);

  // Load draft on mount; switch to script tab if draft has blocks
  useEffect(() => {
    const draft = readDraft();
    if (draft?.scriptBlocks?.length) {
      setScriptBlocks(draft.scriptBlocks);
      setPromptText(draft.promptText ?? "");
      setSummary(draft.summary ?? "");
      setCoverUrl(draft.coverUrl ?? "");
      setCoverPrompt(draft.coverPrompt ?? "");
      setEditingStoryId(draft.editingStoryId ?? null);
      setCharacterAvatars(draft.characterAvatars ?? {});
      setStoryTitle(draft.storyTitle ?? "");
      setActiveTab("script");
    } else {
      setActiveTab("prompt");
    }
    setLoaded(true);
  }, []);

  // Persist draft on change
  useEffect(() => {
    if (!loaded) return;
    writeDraft({ promptText, scriptBlocks, summary, coverUrl, coverPrompt, editingStoryId: editingStoryId ?? undefined, characterAvatars, storyTitle });
  }, [promptText, scriptBlocks, summary, coverUrl, coverPrompt, editingStoryId, characterAvatars, storyTitle, loaded]);

  // Auto-save to Supabase — debounced 3s after any script change
  useEffect(() => {
    if (!loaded || scriptBlocks.length === 0) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      fetch("/api/script-saves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks: scriptBlocks, summary, coverUrl, coverPrompt, isAutosave: true }),
      })
        .then(() => setSavesRefreshKey((k) => k + 1))
        .catch(() => {});
    }, 3000);
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptBlocks, loaded]);

  // Background-seed missing character avatars one by one
  useEffect(() => {
    if (!loaded || scriptBlocks.length === 0 || avatarSeedingRef.current) return;
    const characters = Array.from(
      new Set(scriptBlocks.filter((b) => b.characterName !== "SFX").map((b) => b.characterName))
    );
    const missing = characters.filter((name) => !characterAvatars[name]);
    if (missing.length === 0) return;

    let cancelled = false;
    avatarSeedingRef.current = true;

    (async () => {
      for (let i = 0; i < missing.length; i++) {
        if (cancelled) break;
        // Space requests 4s apart so Pollinations doesn't rate-limit back-to-back calls
        if (i > 0) await new Promise((r) => setTimeout(r, 4000));
        if (cancelled) break;
        const name = missing[i];
        try {
          const res = await fetch("/api/generate-avatar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ characterName: name, summary }),
          });
          if (res.ok) {
            const { imageData, mimeType } = await res.json() as { imageData: string; mimeType: string };
            if (imageData && !cancelled) {
              const dataUrl = `data:${mimeType};base64,${imageData}`;
              setCharacterAvatars((prev) => ({ ...prev, [name]: dataUrl }));
            }
          }
        } catch {
          // ignore individual failures — voice avatar or styled initial stays shown
        }
      }
      avatarSeedingRef.current = false;
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, scriptBlocks.length > 0]);

  // ─── Generate story (Prompt tab) ──────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    if (!promptText.trim()) return;
    setGenerating(true);
    setGenerateError(null);
    setEditingStoryId(null);

    const body: GenerateStoryRequest = {
      mode: "prompt",
      promptText,
      primaryVoiceId: voicePool[0]?.id ?? PRESET_VOICE_POOL[0].id,
      durationMinutes,
      childAgeGroup: MOCK_USER.preferredAgeGroup,
    };

    try {
      const res  = await fetch("/api/generate-story", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      const blocks = data.blocks as ScriptBlock[];
      const sm = data.summary ?? "";
      const cp = data.coverPrompt ?? "";
      setScriptBlocks(blocks);
      setSummary(sm);
      setCoverPrompt(cp);
      setCoverUrl("");
      // Write draft explicitly before switching tabs
      writeDraft({ promptText, scriptBlocks: blocks, summary: sm, coverUrl: "", coverPrompt: cp, editingStoryId: undefined, characterAvatars: {} });
      if (cp) fetchCover(cp, sm);
      setActiveTab("script");
    } catch (err: unknown) {
      setGenerateError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setGenerating(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promptText, durationMinutes, voicePool]);

  // ─── Revise script ────────────────────────────────────────────────────────

  const handleRevise = useCallback(async (instruction: string) => {
    if (!instruction.trim() || isRevising || scriptBlocks.length === 0) return;
    setIsRevising(true);
    setReviseError(null);
    try {
      const res  = await fetch("/api/revise-script", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ blocks: scriptBlocks, instruction: instruction.trim() }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Revision failed");
      setScriptBlocks(data.blocks);
      setDirectorNote("");
    } catch (err: unknown) {
      setReviseError(err instanceof Error ? err.message : "Revision failed");
    } finally {
      setIsRevising(false);
    }
  }, [scriptBlocks, isRevising]);

  // ─── Manual save ──────────────────────────────────────────────────────────

  const handleManualSave = useCallback(async () => {
    if (scriptBlocks.length === 0 || isSaving) return;
    setIsSaving(true);
    setSaveLabel("saving");
    try {
      await fetch("/api/script-saves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks: scriptBlocks, summary, coverUrl, coverPrompt, isAutosave: false }),
      });
      setSavesRefreshKey((k) => k + 1);
      setSaveLabel("saved");
      setTimeout(() => setSaveLabel("idle"), 2500);
    } catch {
      setSaveLabel("idle");
    } finally {
      setIsSaving(false);
    }
  }, [scriptBlocks, summary, coverUrl, coverPrompt, isSaving]);

  // ─── Load a save into the studio ──────────────────────────────────────────

  const handleLoadSave = useCallback((save: ScriptSaveFull) => {
    setScriptBlocks(save.blocks);
    if (save.summary)     setSummary(save.summary);
    if (save.coverUrl)    setCoverUrl(save.coverUrl);
    if (save.coverPrompt) setCoverPrompt(save.coverPrompt);
    setCharacterAvatars({});
    setPendingDirections([]);
  }, []);

  // ─── Queue a character direction ──────────────────────────────────────────

  const handleQueueDirection = useCallback((instruction: string) => {
    setPendingDirections((prev) => [...prev, instruction]);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setShowToast(true);
    toastTimerRef.current = setTimeout(() => setShowToast(false), 4500);
  }, []);

  // ─── Apply all queued directions ──────────────────────────────────────────

  const handleUpdateScript = useCallback(async () => {
    if (pendingDirections.length === 0 || isRevising) return;
    const combined = pendingDirections.join(". Also: ");
    setPendingDirections([]);
    setShowToast(false);
    await handleRevise(combined);
  }, [pendingDirections, isRevising, handleRevise]);

  // ─── Fetch cover ──────────────────────────────────────────────────────────

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

  // ─── Produce audio ────────────────────────────────────────────────────────

  const handleProduce = useCallback(async (blocks: ScriptBlock[], duration: number) => {
    setIsProducing(true);
    setProduceError(null);
    setActiveTab("producing");
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
      setActiveTab("script");
    }
  }, [editingStoryId, summary, coverPrompt, coverUrl]);

  const handleProductionDone = useCallback((job: Job) => {
    setCompletedJob(job);
    setIsProducing(false);
    setActiveTab("drama");
  }, []);

  const handleProductionError = useCallback((msg: string) => {
    setProduceError(msg);
    setIsProducing(false);
    setProductionJobId(null);
    setActiveTab("script");
  }, []);

  // ─── Early returns ────────────────────────────────────────────────────────

  if (!loaded) return null;

  // Full-screen generating spinner
  if (generating) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center px-8 text-center">
        <div className="flex flex-col items-center gap-6">
          <div className="relative w-24 h-24 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full animate-ping opacity-20"
              style={{ background: "radial-gradient(circle,#4fc3f7,#0088AA)" }} />
            <div className="absolute inset-2 rounded-full opacity-40 animate-pulse"
              style={{ background: "radial-gradient(circle,#4fc3f7,#0088AA)" }} />
            <span className="relative text-5xl animate-pulse">✨</span>
          </div>
          <div>
            <h2 className="text-white text-xl font-bold mb-2">Crafting your story…</h2>
            <p className="text-white/35 text-sm">Weaving magic into every word</p>
          </div>
          <div className="flex gap-2">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="w-2 h-2 rounded-full"
                style={{ background: "linear-gradient(135deg,#4fc3f7,#0088AA)", animation: `bounce 1s ease-in-out ${i * 0.15}s infinite` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Producing full-screen view
  if (activeTab === "producing" && productionJobId) {
    return (
      <div className="min-h-full" dir={isRTL ? "rtl" : "ltr"}>
        <div className="px-5 pt-12 pb-8">
          <div className="flex items-center mb-7">
            <button onClick={() => { setActiveTab("script"); setIsProducing(false); setProductionJobId(null); }}
              className="w-8 h-8 flex items-center justify-center text-white/50 text-base">←</button>
            <h1 className="flex-1 text-center text-base font-semibold text-white tracking-wide">Producing…</h1>
            <div className="w-8" />
          </div>
          <ProductionProgress jobId={productionJobId} onDone={handleProductionDone} onError={handleProductionError} coverUrl={coverUrl || undefined} />
        </div>
      </div>
    );
  }

  // Drama player full-screen view
  if (activeTab === "drama" && completedJob) {
    return (
      <div className="min-h-full" dir={isRTL ? "rtl" : "ltr"}>
        <div className="px-5 pt-12 pb-8">
          <div className="flex items-center mb-7">
            <button onClick={() => setActiveTab("script")} className="w-8 h-8 flex items-center justify-center text-white/50 text-base">←</button>
            <h1 className="flex-1 text-center text-base font-semibold text-white tracking-wide">Drama Ready</h1>
            <div className="w-8" />
          </div>
          <DramaPlayer job={completedJob} onGenerateAnother={() => { setActiveTab("script"); setCompletedJob(null); }} />
        </div>
      </div>
    );
  }

  // ─── Main tab shell ───────────────────────────────────────────────────────

  const hasScript = scriptBlocks.length > 0;

  return (
    <div className="min-h-full" dir={isRTL ? "rtl" : "ltr"}>
      <div className="px-5 pt-12 pb-8">
        {/* Header — no back button */}
        <div className="flex items-center mb-7">
          <div className="w-8" />
          <h1 className="flex-1 text-center text-base font-semibold text-white tracking-wide">🎬 Studio</h1>
          <button
            onClick={() => setVersionsOpen(true)}
            className="relative w-8 h-8 flex items-center justify-center rounded-xl transition-all"
            style={{ color: savesCount > 0 ? "rgba(79,195,247,0.7)" : "rgba(255,255,255,0.2)" }}
          >
            <span className="text-sm">📂</span>
            {savesCount > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 px-1 rounded-full text-[8px] font-bold flex items-center justify-center"
                style={{ background: "rgba(79,195,247,0.85)", color: "#05080F" }}
              >
                {savesCount}
              </span>
            )}
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex mb-7" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          {TABS.map(({ id, label, emoji }) => {
            const isFiveQ    = id === "five-question";
            const isScript   = id === "script";
            const isDisabled = isScript && !hasScript;
            const isActive   = activeTab === id;

            return (
              <button
                key={id}
                onClick={() => {
                  if (isDisabled) return;
                  if (isFiveQ) { setActiveTab("five-question"); return; }
                  setActiveTab(id);
                }}
                disabled={isDisabled}
                className={`relative flex-1 pb-3 text-[11px] font-bold tracking-wider uppercase transition-colors ${
                  isActive ? "text-white" : isDisabled ? "text-white/15 cursor-not-allowed" : "text-white/30"
                }`}
              >
                <span className="flex items-center justify-center gap-1.5">
                  <span>{emoji}</span>
                  <span>{label}</span>
                  {isScript && hasScript && (
                    <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#4fc3f7" }} />
                  )}
                </span>
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: "#4fc3f7" }} />
                )}
              </button>
            );
          })}
        </div>

        {/* Error banner */}
        {(generateError || produceError) && (
          <div className="mb-5 px-4 py-3 rounded-2xl text-xs leading-relaxed"
            style={{ background: "rgba(236,72,153,0.1)", border: "1px solid rgba(236,72,153,0.25)", color: "#EC4899" }}>
            ⚠ {generateError ?? produceError}
          </div>
        )}

        {/* Prompt tab */}
        {activeTab === "prompt" && (
          <PromptTabContent
            promptText={promptText} setPromptText={setPromptText}
            durationMinutes={durationMinutes} setDurationMinutes={setDurationMinutes}
            generating={generating} onGenerate={handleGenerate}
          />
        )}

        {/* 5 Questions tab */}
        {activeTab === "five-question" && (
          <div className="-mx-5">
            <FiveQuestionFlow
              onComplete={({ blocks, summary: sm, coverPrompt: cp }) => {
                setScriptBlocks(blocks);
                setSummary(sm);
                setCoverPrompt(cp);
                setCoverUrl("");
                writeDraft({ promptText: "", scriptBlocks: blocks, summary: sm, coverUrl: "", coverPrompt: cp });
                if (cp) fetchCover(cp, sm);
                setActiveTab("script");
              }}
            />
          </div>
        )}

        {/* Script tab */}
        {activeTab === "script" && hasScript && (
          <>
            {/* Script blocks */}
            <ScriptTab
              blocks={scriptBlocks}
              voices={voicePool}
              onBlocksChange={setScriptBlocks}
              onProduce={handleProduce}
              isProducing={isProducing}
              summary={summary}
              title={storyTitle}
              coverUrl={coverUrl}
              isFetchingCover={isFetchingCover}
              onRegenerateCover={coverPrompt ? () => { setCoverUrl(""); fetchCover(coverPrompt, summary); } : undefined}
              durationMinutes={durationMinutes}
              onDurationChange={setDurationMinutes}
              hideDirectorsNote
              hideDurationPicker
              hideProduceButton
              studioMode
              belowCover={
                <CharacterCards
                  blocks={scriptBlocks}
                  voicePool={voicePool}
                  avatars={characterAvatars}
                  onDirectCharacter={(_, instruction) => handleQueueDirection(instruction)}
                />
              }
            />

            {/* Director's Note */}
            {(() => {
              const hasPending = pendingDirections.length > 0 || directorNote.trim().length > 0;
              return (
              <div
                className="mt-2 mb-3 rounded-2xl p-4 flex flex-col gap-3"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                {/* Header */}
                <div className="flex items-center gap-2">
                  <span className="text-sm opacity-60">🎬</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>
                    Director&apos;s Note
                  </span>
                  {isRevising && (
                    <span className="ml-auto flex items-center gap-1.5 text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                      <span className="w-3 h-3 border-2 rounded-full animate-spin" style={{ borderColor: "rgba(255,255,255,0.1)", borderTopColor: "rgba(255,255,255,0.5)" }} />
                      Revising…
                    </span>
                  )}
                  {hasPending && !isRevising && (
                    <button
                      onClick={() => { setDirectorNote(""); setPendingDirections([]); setShowToast(false); }}
                      className="ml-auto text-[10px] font-medium transition-colors"
                      style={{ color: "rgba(255,255,255,0.25)" }}
                    >
                      ↩ Discard
                    </button>
                  )}
                </div>

                {/* Quick chips — neutral style */}
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: "😴 More sleepy",   instruction: "Make the whole story more sleepy and calming — softer language, slower pace, perfect for drifting off" },
                    { label: "✨ More magical",   instruction: "Add more magic, wonder and enchantment throughout" },
                    { label: "😂 Funnier",        instruction: "Add playful humor and lightness throughout — make it fun and giggly for young children" },
                    { label: "✂️ Shorter",        instruction: "Shorten the story — condense each scene to its essential moment while keeping the emotional arc" },
                    { label: "💫 More dramatic",  instruction: "Add more dramatic tension and emotional peaks" },
                    { label: "🌙 Cozier",         instruction: "Make the story feel warmer, cozier and more comforting — like being tucked in on a cold night" },
                  ].map(({ label, instruction }) => (
                    <button
                      key={label}
                      disabled={isRevising}
                      onClick={() => handleRevise(instruction)}
                      className="text-[11px] px-3 py-1.5 rounded-full font-medium transition-all active:scale-95"
                      style={{
                        background: isRevising ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        color: isRevising ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.55)",
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Freetext */}
                <div className="flex gap-2 items-end">
                  <textarea
                    ref={noteRef}
                    value={directorNote}
                    onChange={(e) => setDirectorNote(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && directorNote.trim()) {
                        e.preventDefault();
                        handleRevise(directorNote);
                      }
                    }}
                    rows={2}
                    disabled={isRevising}
                    placeholder={'e.g. "make the ending happier", "add more tension in the middle"'}
                    className="flex-1 rounded-xl px-3 py-2.5 text-sm leading-relaxed outline-none resize-none text-white/70 placeholder-white/15 transition-colors"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}
                  />
                  <button
                    disabled={!directorNote.trim() || isRevising}
                    onClick={() => handleRevise(directorNote)}
                    className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold transition-all active:scale-95"
                    style={directorNote.trim() && !isRevising
                      ? { background: "rgba(79,195,247,0.15)", border: "1px solid rgba(79,195,247,0.35)", color: "#4fc3f7" }
                      : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.15)" }
                    }
                  >↵</button>
                </div>

                {reviseError && (
                  <p className="text-[10px]" style={{ color: "rgba(239,68,68,0.75)" }}>⚠ {reviseError}</p>
                )}
              </div>
              );
            })()}

            {/* Update Script — active when character directions are queued */}
            {(() => {
              const hasPending = pendingDirections.length > 0;
              return (
              <button
                onClick={handleUpdateScript}
                disabled={!hasPending || isRevising}
                className="w-full py-3.5 rounded-2xl font-semibold text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2 mb-2.5"
                style={hasPending && !isRevising
                  ? { background: "rgba(79,195,247,0.1)", border: "1.5px solid rgba(79,195,247,0.35)", color: "#4fc3f7", boxShadow: "0 0 16px rgba(79,195,247,0.08)" }
                  : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.2)" }
                }
              >
                {isRevising ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 rounded-full animate-spin" style={{ borderColor: "rgba(255,255,255,0.15)", borderTopColor: "rgba(255,255,255,0.6)" }} />
                    Updating…
                  </>
                ) : hasPending ? (
                  <>✏️ Update Script · {pendingDirections.length} direction{pendingDirections.length > 1 ? "s" : ""}</>
                ) : (
                  <>✏️ Update Script</>
                )}
              </button>
              );
            })()}

            {/* Produce Audio — disabled when unsaved direction changes exist */}
            {(() => {
              const hasUnapplied = directorNote.trim().length > 0 || pendingDirections.length > 0;
              const blocked = isProducing || hasUnapplied;
              return (
              <div>
                <button
                  onClick={() => !blocked && handleProduce(scriptBlocks, durationMinutes)}
                  disabled={blocked}
                  className={`w-full py-4 rounded-2xl font-semibold text-sm transition-all ${
                    !blocked ? "btn-vivid" : "cursor-not-allowed"
                  }`}
                  style={blocked && !isProducing ? {
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "rgba(255,255,255,0.2)",
                  } : undefined}
                >
                  {isProducing ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-pulse-slow">🎙️</span>Mixing audio tracks…
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">🎙️ Produce Audio</span>
                  )}
                </button>
                {hasUnapplied && !isProducing && (
                  <p className="text-center text-[10px] mt-1.5" style={{ color: "rgba(255,255,255,0.25)" }}>
                    Apply or discard your director&apos;s note first
                  </p>
                )}
              </div>
              );
            })()}

            {/* Save script version */}
            <button
              onClick={handleManualSave}
              disabled={isSaving || saveLabel === "saved"}
              className="w-full mt-2.5 py-3 rounded-2xl text-sm font-medium transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              style={saveLabel === "saved"
                ? { background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", color: "#34d399" }
                : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.45)" }
              }
            >
              {saveLabel === "saving" ? (
                <><span className="w-3.5 h-3.5 border-2 rounded-full animate-spin" style={{ borderColor: "rgba(255,255,255,0.15)", borderTopColor: "rgba(255,255,255,0.5)" }} />Saving…</>
              ) : saveLabel === "saved" ? (
                <>✓ Script saved</>
              ) : (
                <>💾 Save script version</>
              )}
            </button>

            {/* Toast — appears after queuing a character direction */}
            <div
              className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 pointer-events-none"
              style={{
                opacity: showToast ? 1 : 0,
                transform: showToast ? "translateX(-50%) translateY(0)" : "translateX(-50%) translateY(8px)",
              }}
            >
              <div
                className="px-4 py-2.5 rounded-2xl text-xs font-semibold whitespace-nowrap"
                style={{ background: "rgba(139,92,246,0.92)", color: "#fff", boxShadow: "0 4px 20px rgba(139,92,246,0.45)", backdropFilter: "blur(8px)" }}
              >
                ✏️ Tap &quot;Update Script&quot; to apply your direction
              </div>
            </div>
          </>
        )}
      </div>

      {/* Versions bottom sheet */}
      {versionsOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end"
          style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
          onClick={() => setVersionsOpen(false)}
        >
          <div
            className="rounded-t-3xl pb-8 pt-4 px-4 mx-auto w-full"
            style={{
              background: "linear-gradient(180deg, rgba(14,20,45,0.99) 0%, rgba(8,12,28,1) 100%)",
              border: "1px solid rgba(79,195,247,0.15)",
              borderBottom: "none",
              maxWidth: 560,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: "rgba(255,255,255,0.15)" }} />
            <div className="flex items-center justify-between mb-4 px-1">
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(79,195,247,0.7)" }}>Saved Versions</span>
              <button onClick={() => setVersionsOpen(false)} className="text-white/30 text-lg leading-none">×</button>
            </div>
            <ScriptBrowser
              onLoad={(save) => { handleLoadSave(save); setVersionsOpen(false); }}
              refreshKey={savesRefreshKey}
              forceExpanded
              onCount={setSavesCount}
            />
          </div>
        </div>
      )}
    </div>
  );
}
