"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { readDraft, writeDraft } from "@/lib/draftStore";
import { useLanguage } from "@/context/LanguageContext";
import { useRouter } from "next/navigation";
import ScriptTab from "@/components/studio/ScriptTab";
import ProductionProgress from "@/components/studio/ProductionProgress";
import DramaPlayer from "@/components/studio/DramaPlayer";
import LessonStep from "@/components/studio/LessonStep";
import LessonEditor from "@/components/studio/LessonEditor";
import { MOCK_USER } from "@/lib/mockData";
import { PRESET_VOICE_POOL, fetchVoicePool } from "@/lib/services/voiceCatalog";
import type { ScriptBlock, Voice } from "@/types";
import type { GenerateStoryRequest } from "@/app/api/generate-story/route";
import type { Job } from "@/lib/jobs";
import type { ScriptSaveMeta, ScriptSaveFull } from "@/lib/scriptSaves";
import { FiveQuestionFlow } from "@/app/create/five-question/FiveQuestionFlow";
import { SCENE_CHARS } from "@/config/sceneCharacters";
import { LANGUAGE_META } from "@/lib/i18n";
import ChildProfilePicker, { type DBChildProfile } from "@/components/studio/ChildProfilePicker";
import LunaChatPanel from "@/components/studio/LunaChatPanel";
import VoicePicker from "@/components/studio/VoicePicker";
import { getNarratorVoiceId } from "@/lib/narratorPreference";

// ─── Draft key — separate from Studio so drafts don't cross-contaminate ──────
const DRAFT_KEY = "nightstory_studio2_draft_v1";

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
            <span className="text-sm">📂</span>
            <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "rgba(79,195,247,0.7)" }}>
              Saved versions
            </span>
            <span
              className="min-w-[18px] h-4.5 px-1.5 rounded-full text-[9px] font-bold flex items-center justify-center"
              style={{ background: "rgba(79,195,247,0.15)", color: "rgba(79,195,247,0.85)", border: "1px solid rgba(79,195,247,0.3)" }}
            >
              {saves.length}
            </span>
          </div>
          <span className="text-white/25 text-sm">{expanded ? "↑" : "↓"}</span>
        </button>
      )}

      {/* List */}
      {(expanded || forceExpanded) && (
        <>
          <div className="h-px mx-4" style={{ background: "rgba(79,195,247,0.12)" }} />
          <div className="p-3 flex flex-col gap-2 max-h-72 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
            {saves.map((s) => {
              const isLoading = loadingId === s.id;
              const isDeleting = deletingId === s.id;
              return (
                <div
                  key={s.id}
                  onClick={() => handleLoad(s.id)}
                  className="relative flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all active:scale-[0.98]"
                  style={{
                    background: isLoading ? "rgba(79,195,247,0.1)" : "rgba(255,255,255,0.04)",
                    border: isLoading ? "1px solid rgba(79,195,247,0.3)" : "1px solid rgba(255,255,255,0.07)",
                    opacity: isDeleting ? 0.4 : 1,
                  }}
                >
                  <span className="text-base">{s.isAutosave ? "⚡" : "💾"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-white/80 truncate">{s.label}</p>
                    <p className="text-[10px] text-white/30">{s.blockCount} blocks · {timeAgo(s.savedAt)}</p>
                  </div>
                  {isLoading && (
                    <span className="w-3.5 h-3.5 border-2 rounded-full animate-spin flex-shrink-0"
                      style={{ borderColor: "rgba(255,255,255,0.1)", borderTopColor: "#4fc3f7" }} />
                  )}
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

// ─── Avatar types ─────────────────────────────────────────────────────────────

type CharacterType = "child" | "adult" | "animal" | "narrator";

function buildAvatarUrl(characterName: string, type: CharacterType): string {
  const seed = encodeURIComponent(characterName);
  const bg = "0d1b4a";
  switch (type) {
    case "child":    return `https://api.dicebear.com/9.x/adventurer/svg?seed=${seed}&backgroundColor=${bg}`;
    case "animal":   return `https://api.dicebear.com/9.x/croodles/svg?seed=${seed}&backgroundColor=${bg}&scale=90`;
    default:         return `https://api.dicebear.com/9.x/micah/svg?seed=${seed}&backgroundColor=${bg}&scale=85`;
  }
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
  characterTypes,
  onDirectCharacter,
  onAvatarTypeChange,
  onVoiceChange,
}: {
  blocks: ScriptBlock[];
  voicePool: Voice[];
  avatars: Record<string, string>;
  characterTypes: Record<string, CharacterType>;
  onDirectCharacter: (characterName: string, instruction: string) => void;
  onAvatarTypeChange: (characterName: string, type: CharacterType) => void;
  onVoiceChange: (characterName: string, voiceId: string) => void;
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

      {openCharacter && openMember && (
        <DirectionSheet
          characterName={openCharacter}
          voice={openMember.voice}
          voicePool={voicePool}
          avatarUrl={avatars[openCharacter]}
          characterType={characterTypes[openCharacter] ?? "adult"}
          onDirect={(instruction) => onDirectCharacter(openCharacter, instruction)}
          onAvatarTypeChange={(type) => onAvatarTypeChange(openCharacter, type)}
          onVoiceChange={(voiceId) => onVoiceChange(openCharacter, voiceId)}
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

const AVATAR_TYPES: { type: CharacterType; label: string; emoji: string }[] = [
  { type: "child",    label: "Child",    emoji: "🧒" },
  { type: "adult",    label: "Adult",    emoji: "🧑" },
  { type: "animal",   label: "Animal",   emoji: "🐾" },
  { type: "narrator", label: "Narrator", emoji: "📖" },
];

function DirectionSheet({
  characterName,
  voice,
  voicePool,
  avatarUrl,
  characterType,
  onDirect,
  onAvatarTypeChange,
  onVoiceChange,
  onClose,
}: {
  characterName: string;
  voice: Voice | undefined;
  voicePool: Voice[];
  avatarUrl?: string;
  characterType: CharacterType;
  onDirect: (instruction: string) => void;
  onAvatarTypeChange: (type: CharacterType) => void;
  onVoiceChange: (voiceId: string) => void;
  onClose: () => void;
}) {
  const [note, setNote] = useState("");
  const [showVoicePicker, setShowVoicePicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isNarrator = characterName === "Narrator";

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, []);

  const submit = (instruction: string) => {
    const trimmed = instruction.trim();
    if (!trimmed) return;
    onDirect(isNarrator
      ? `For the Narrator: ${trimmed}`
      : `For the character "${characterName}": ${trimmed}`);
    setNote("");
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed bottom-20 left-4 right-4 z-50 rounded-2xl p-4 flex flex-col gap-3 mx-auto"
        style={{
          maxWidth: 480,
          left: "50%",
          transform: "translateX(-50%)",
          background: "linear-gradient(160deg, rgba(14,20,45,0.99) 0%, rgba(8,12,28,1) 100%)",
          border: "1px solid rgba(139,92,246,0.3)",
          boxShadow: "0 8px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(139,92,246,0.1) inset",
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-3">
          {avatarUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={avatarUrl} alt={characterName} className="w-9 h-9 rounded-full object-cover flex-shrink-0"
              style={{ border: "1.5px solid rgba(139,92,246,0.4)" }} />
          ) : voice?.avatarUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={voice.avatarUrl} alt={voice.name} className="w-9 h-9 rounded-full object-cover flex-shrink-0"
              style={{ border: "1.5px solid rgba(139,92,246,0.4)" }} />
          ) : (
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
              style={{ background: "rgba(139,92,246,0.15)", border: "1.5px solid rgba(139,92,246,0.4)", color: "#C4B5FD" }}>
              {characterName.charAt(0)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-white/80 truncate">{characterName}</p>
            {voice && <p className="text-[10px] text-white/30 truncate">{voice.name}</p>}
          </div>
          <button onClick={onClose} className="text-white/25 text-lg leading-none flex-shrink-0">×</button>
        </div>

        {/* Avatar style picker */}
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "rgba(255,255,255,0.25)" }}>
            Avatar style
          </p>
          <div className="flex gap-1.5">
            {AVATAR_TYPES.map(({ type, label, emoji }) => (
              <button
                key={type}
                onClick={() => onAvatarTypeChange(type)}
                className="flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl transition-all active:scale-95"
                style={type === characterType
                  ? { background: "rgba(139,92,246,0.2)", border: "1px solid rgba(139,92,246,0.5)", color: "#C4B5FD" }
                  : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)" }
                }
              >
                <span className="text-base leading-none">{emoji}</span>
                <span className="text-[9px] font-semibold mt-0.5">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Voice selector */}
        <div className="relative">
          <p className="text-[9px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "rgba(255,255,255,0.25)" }}>
            Voice
          </p>
          <button
            onClick={() => setShowVoicePicker((p) => !p)}
            className="flex items-center gap-2.5 w-full rounded-xl px-3 py-2.5 transition-all active:scale-[0.98]"
            style={showVoicePicker
              ? { background: "rgba(79,195,247,0.08)", border: "1px solid rgba(79,195,247,0.4)" }
              : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }
            }
          >
            {voice?.avatarUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={voice.avatarUrl} alt={voice.name} className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                style={{ border: "1px solid rgba(255,255,255,0.12)" }} />
            ) : (
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                style={{ background: "rgba(79,195,247,0.1)", border: "1px solid rgba(79,195,247,0.2)" }}>
                🎙️
              </div>
            )}
            <span className="text-sm font-medium text-white/70 flex-1 text-left truncate">
              {voice?.name ?? "Select voice"}
            </span>
            <span className="text-white/30 text-xs">{showVoicePicker ? "▴" : "▾"}</span>
          </button>
          {showVoicePicker && (
            <VoicePicker
              voices={voicePool}
              selectedVoiceId={voice?.id ?? ""}
              onSelect={(voiceId) => { onVoiceChange(voiceId); setShowVoicePicker(false); }}
              onClose={() => setShowVoicePicker(false)}
            />
          )}
        </div>

        {/* Quick direction chips */}
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
  const [imgError, setImgError] = useState(false);

  useEffect(() => { setImgError(false); }, [avatarUrl]);

  const accentColor = isNarrator ? "rgba(167,139,250,0.7)" : "rgba(79,195,247,0.7)";
  const displayUrl = avatarUrl || buildAvatarUrl(characterName, isNarrator ? "narrator" : "adult");

  return (
    <div className="flex-shrink-0 flex flex-col items-center gap-1.5" style={{ minWidth: 68 }}>
      <button onClick={onOpen} className="flex flex-col items-center gap-1.5 w-full" title={`Direct ${characterName}`}>
        <div
          className="w-14 h-14 rounded-2xl overflow-hidden flex items-center justify-center text-xl font-bold transition-all"
          style={isOpen
            ? { border: "2px solid rgba(139,92,246,0.65)", boxShadow: "0 0 16px rgba(139,92,246,0.3)" }
            : { border: "1px solid rgba(255,255,255,0.1)" }
          }
        >
          {!imgError ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={displayUrl} alt={characterName} className="w-full h-full object-cover" onError={() => setImgError(true)} />
          ) : (
            <div className="w-full h-full flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.07), rgba(255,255,255,0.03))" }}>
              <span className="text-lg font-bold" style={{ color: accentColor }}>{characterName.charAt(0).toUpperCase()}</span>
            </div>
          )}
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-center leading-tight truncate w-full"
          style={{ color: accentColor }}>
          {characterName}
        </span>
        {voice && (
          <span className="text-[10px] font-medium text-center truncate w-full" style={{ color: "rgba(255,255,255,0.45)" }}>{voice.name.split(" ")[0]}</span>
        )}
      </button>
    </div>
  );
}

// ─── Prompt tab components ────────────────────────────────────────────────────

const DURATION_PRESETS = [
  { value: 2, label: "Short",  desc: "~2 min",  icon: "⚡" },
  { value: 5, label: "Medium", desc: "~5 min",  icon: "🌙" },
  { value: 10, label: "Long",  desc: "~10 min", icon: "✨" },
];

const STORY_SEEDS = [
  { icon: "🐉", text: "A dragon who can't breathe fire befriends a glowing firefly" },
  { icon: "🧙", text: "A forgetful wizard must solve a mystery using only kindness" },
  { icon: "🦊", text: "A clever fox discovers the forest hides a secret library" },
];

function SceneHeader() {
  const [cachedUrls, setCachedUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/admin/seed-scene-characters")
      .then((r) => r.json())
      .then((data: { urls?: Record<string, string> }) => { if (data.urls) setCachedUrls(data.urls); })
      .catch(() => {});
  }, []);

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl"
      style={{ height: 196, background: "linear-gradient(160deg, #060b1e 0%, #120626 40%, #081428 100%)" }}
    >
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 196" fill="none" aria-hidden>
        {[
          [18,12],[55,28],[90,8],[130,22],[175,6],[220,18],[265,30],[310,10],[350,24],[385,14],
          [35,55],[72,42],[108,60],[145,48],[188,62],[230,50],[272,58],[315,44],[360,56],[395,40],
          [25,90],[60,80],[95,95],[135,85],[165,100],[200,78],[245,92],[285,82],[325,98],[370,88],
          [42,130],[78,118],[112,135],[150,125],[195,140],[235,120],[270,138],[308,128],[345,142],[388,118],
          [20,165],[58,155],[98,170],[140,160],[178,175],[218,158],[260,168],[300,162],[340,178],[382,152],
        ].map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r={i % 4 === 0 ? 1.1 : 0.7} fill={i % 5 === 0 ? "#a78bfa" : "white"} opacity={0.3 + (i % 5) * 0.1} />
        ))}
        <circle cx="48"  cy="38" r="1.8" fill="#4fc3f7" opacity="0.7" />
        <circle cx="202" cy="15" r="1.5" fill="#a78bfa" opacity="0.8" />
        <circle cx="330" cy="50" r="1.6" fill="#EC4899" opacity="0.6" />
        <circle cx="370" cy="20" r="1.4" fill="#F59E0B" opacity="0.7" />
      </svg>

      {SCENE_CHARS.map((c) => (
        <div key={c.label} className="absolute rounded-full pointer-events-none"
          style={{
            width: c.size * 1.8, height: c.size * 1.8,
            left: c.x, top: c.y + c.size * 0.3,
            transform: "translateX(-50%)",
            background: `radial-gradient(circle, ${c.glow}22 0%, transparent 70%)`,
            filter: "blur(8px)",
          }}
        />
      ))}

      {SCENE_CHARS.map((c) => (
        <div key={c.label} className="absolute flex flex-col items-center" style={{ left: c.x, top: c.y, transform: "translateX(-50%)" }}>
          <div className="rounded-full overflow-hidden flex-shrink-0"
            style={{
              width: c.size, height: c.size,
              boxShadow: `0 0 0 2.5px ${c.glow}55, 0 0 16px ${c.glow}44, 0 4px 12px rgba(0,0,0,0.5)`,
              border: `1.5px solid ${c.glow}66`,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cachedUrls[c.label] ?? c.url} alt={c.label} className="w-full h-full" style={{ imageRendering: "auto" }} />
          </div>
          <span className="mt-1 text-[9px] font-semibold tracking-wide"
            style={{ color: `${c.glow}cc`, textShadow: `0 0 8px ${c.glow}88` }}>
            {c.label}
          </span>
        </div>
      ))}

      <div className="absolute bottom-0 left-0 right-0 px-4 pt-8 pb-3"
        style={{ background: "linear-gradient(to top, rgba(6,11,30,0.97) 0%, rgba(6,11,30,0.7) 60%, transparent 100%)" }}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] mb-0.5" style={{ color: "rgba(139,92,246,0.7)" }}>
          Nightstory Studio
        </p>
        <h2 className="text-base font-bold leading-tight"
          style={{ background: "linear-gradient(90deg,#fff 0%,#4fc3f7 55%,#a78bfa 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
          What happens tonight?
        </h2>
      </div>
    </div>
  );
}

function PromptTabContent({
  promptText, setPromptText,
  durationMinutes, setDurationMinutes,
  generating, onNext, language,
}: {
  promptText: string; setPromptText: (v: string) => void;
  durationMinutes: number; setDurationMinutes: (v: number) => void;
  generating: boolean;
  onNext: () => void;
  language: string;
}) {
  const canGenerate = promptText.trim().length > 0;
  const wordCount = promptText.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="flex flex-col gap-5">
      <SceneHeader />

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(79,195,247,0.5)" }}>
            Your story idea
          </label>
          {wordCount > 0 && (
            <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.2)" }}>{wordCount} words</span>
          )}
        </div>
        <div className="relative">
          <textarea
            placeholder={"A sleepy dragon who can't breathe fire befriends a firefly…"}
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            rows={5}
            className="w-full rounded-2xl px-4 py-3.5 text-sm text-white placeholder-white/20 outline-none resize-none leading-relaxed"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", transition: "border-color 0.2s" }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(79,195,247,0.4)")}
            onBlur={(e)  => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}
          />
          {canGenerate && (
            <div className="absolute inset-0 rounded-2xl pointer-events-none"
              style={{ boxShadow: "0 0 0 1px rgba(79,195,247,0.15), 0 4px 20px rgba(79,195,247,0.06)" }} />
          )}
        </div>
      </div>

      {!promptText && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.2)" }}>
            Or try an idea
          </p>
          <div className="flex flex-col gap-1.5">
            {STORY_SEEDS.map((seed) => (
              <button
                key={seed.text}
                onClick={() => setPromptText(seed.text)}
                className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-left transition-all active:scale-[0.98]"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <span className="text-base flex-shrink-0">{seed.icon}</span>
                <span className="text-xs leading-snug" style={{ color: "rgba(255,255,255,0.5)" }}>{seed.text}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl px-4 py-3.5" style={{ background: "rgba(79,195,247,0.04)", border: "1px solid rgba(79,195,247,0.12)" }}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(79,195,247,0.5)" }}>Story length</span>
          <span className="text-sm font-bold tabular-nums" style={{ color: "#4fc3f7" }}>{durationMinutes} min</span>
        </div>
        <div className="flex gap-2">
          {DURATION_PRESETS.map((p) => (
            <button
              key={p.value}
              onClick={() => setDurationMinutes(p.value)}
              className="flex-1 flex flex-col items-center py-2.5 rounded-xl transition-all active:scale-95"
              style={durationMinutes === p.value
                ? { background: "rgba(79,195,247,0.16)", border: "1.5px solid rgba(79,195,247,0.45)", boxShadow: "0 0 10px rgba(79,195,247,0.15)" }
                : { background: "rgba(255,255,255,0.04)", border: "1.5px solid rgba(255,255,255,0.08)" }
              }
            >
              <span className="text-base mb-0.5">{p.icon}</span>
              <span className="text-[10px] font-bold" style={{ color: durationMinutes === p.value ? "#4fc3f7" : "rgba(255,255,255,0.45)" }}>{p.label}</span>
              <span className="text-[9px]" style={{ color: durationMinutes === p.value ? "rgba(79,195,247,0.6)" : "rgba(255,255,255,0.2)" }}>{p.desc}</span>
            </button>
          ))}
        </div>
        <input
          type="range" min={1} max={10} step={1} value={durationMinutes}
          onChange={(e) => setDurationMinutes(Number(e.target.value))}
          className="w-full cursor-pointer mt-3"
          style={{ accentColor: "#4fc3f7" }}
        />
      </div>

      {/* Language indicator */}
      {(() => {
        const meta = LANGUAGE_META[language as keyof typeof LANGUAGE_META];
        if (!meta) return null;
        return (
          <div className="flex items-center justify-center gap-1.5 py-1.5">
            <span className="text-base">{meta.flag}</span>
            <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>
              Story will be generated in <span style={{ color: "rgba(255,255,255,0.55)" }}>{meta.label}</span>
            </span>
          </div>
        );
      })()}

      {/* Next → lesson step button */}
      <button
        onClick={onNext}
        disabled={!canGenerate || generating}
        className="w-full py-4 rounded-2xl font-semibold text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        style={
          canGenerate && !generating
            ? { background: "linear-gradient(90deg,#4fc3f7,#8B5CF6)", color: "#fff", boxShadow: "0 4px 28px rgba(79,195,247,0.3), 0 2px 8px rgba(139,92,246,0.3)" }
            : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.07)" }
        }
      >
        {generating ? (
          <>
            <span className="animate-spin text-base">✦</span>
            <span>Weaving your story…</span>
          </>
        ) : (
          <>
            <span>✨</span>
            <span>Next: Add a Lesson</span>
            <span style={{ opacity: 0.6 }}>→</span>
          </>
        )}
      </button>
    </div>
  );
}

// ─── Studio 2 page ────────────────────────────────────────────────────────────

type StudioTab = "chat" | "step-by-step" | "lesson" | "script" | "producing" | "drama";

const TABS: { id: "chat" | "step-by-step" | "script"; label: string; emoji: string }[] = [
  { id: "chat",         label: "Chat",         emoji: "💬" },
  { id: "step-by-step", label: "Step-by-step", emoji: "🧚" },
  { id: "script",       label: "Script",       emoji: "📄" },
];

export default function Studio2Page() {
  const { isRTL, language } = useLanguage();
  const router = useRouter();

  // ─── Active child profile ────────────────────────────────────────────────────
  const [activeChild, setActiveChild]       = useState<DBChildProfile | null>(null);
  const [chatLocked, setChatLocked]         = useState(false);

  // ─── Prompt tab state ───────────────────────────────────────────────────────
  const [promptText, setPromptText]         = useState("");
  const [generating, setGenerating]         = useState(false);
  const [generateError, setGenerateError]   = useState<string | null>(null);

  // ─── Script state ───────────────────────────────────────────────────────────
  const [scriptBlocks, setScriptBlocks]     = useState<ScriptBlock[]>([]);
  const [summary, setSummary]               = useState("");
  const [coverUrl, setCoverUrl]             = useState("");
  const [coverPrompt, setCoverPrompt]       = useState("");
  const [editingStoryId, setEditingStoryId] = useState<string | null>(null);
  const [durationMinutes, setDurationMinutes] = useState(3);
  const [voicePool, setVoicePool]           = useState<Voice[]>(PRESET_VOICE_POOL);
  const [loaded, setLoaded]                 = useState(false);

  // ─── Lesson state ───────────────────────────────────────────────────────────
  const [lessons, setLessons]               = useState<string[]>([]);
  const [lessonImplementations, setLessonImplementations] = useState<{ lesson: string; implemented: boolean; how: string }[]>([]);

  // ─── Tab / view state ───────────────────────────────────────────────────────
  const [activeTab, setActiveTab]           = useState<StudioTab>("chat");
  const [productionJobId, setProductionJobId] = useState<string | null>(null);
  const [completedJob, setCompletedJob]     = useState<Job | null>(null);
  const [isProducing, setIsProducing]       = useState(false);
  const [produceError, setProduceError]     = useState<string | null>(null);
  const [isFetchingCover, setIsFetchingCover] = useState(false);

  // ─── Director's Note state ──────────────────────────────────────────────────
  const [directorNote, setDirectorNote]     = useState("");
  const [isRevising, setIsRevising]         = useState(false);
  const [reviseError, setReviseError]       = useState<string | null>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  // ─── Character avatars (AI-generated, optional) ─────────────────────────────
  const [characterAvatars, setCharacterAvatars] = useState<Record<string, string>>({});
  const [characterTypes, setCharacterTypes]     = useState<Record<string, CharacterType>>({});

  // ─── Pending character directions ──────────────────────────────────────────
  const [pendingDirections, setPendingDirections] = useState<string[]>([]);
  const [showToast, setShowToast] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Saves ──────────────────────────────────────────────────────────────────
  const [savesRefreshKey, setSavesRefreshKey] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveLabel, setSaveLabel] = useState<"idle" | "saving" | "saved">("idle");
  // Dirty flag: true when user has changes that haven't been applied/produced yet
  const [hasScriptChanges, setHasScriptChanges] = useState(false);
  const cleanLessonsRef = useRef<string[]>([]);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Story title / versions sheet ───────────────────────────────────────────
  const [storyTitle, setStoryTitle] = useState("");
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [savesCount, setSavesCount] = useState(0);

  useEffect(() => {
    fetch("/api/script-saves", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setSavesCount(d.length); })
      .catch(() => {});
  }, [savesRefreshKey]);

  useEffect(() => { fetchVoicePool().then(setVoicePool); }, []);

  // Mark dirty when lessons change after the clean snapshot
  useEffect(() => {
    if (!loaded || scriptBlocks.length === 0) return;
    const clean = cleanLessonsRef.current;
    const changed = lessons.length !== clean.length || lessons.some((l, i) => l !== clean[i]);
    if (changed) setHasScriptChanges(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessons]);

  // Load draft on mount (Studio2 uses its own localStorage key)
  useEffect(() => {
    const draft = readDraft(DRAFT_KEY);
    if (draft?.scriptBlocks?.length) {
      setScriptBlocks(draft.scriptBlocks);
      setPromptText(draft.promptText ?? "");
      setSummary(draft.summary ?? "");
      setCoverUrl(draft.coverUrl ?? "");
      setCoverPrompt(draft.coverPrompt ?? "");
      setEditingStoryId(draft.editingStoryId ?? null);
      setCharacterAvatars(draft.characterAvatars ?? {});
      setCharacterTypes((draft.characterTypes ?? {}) as Record<string, CharacterType>);
      setStoryTitle(draft.storyTitle ?? "");
      // Migrate: support both old string `lesson` and new array `lessons`
      setLessons(draft.lessons ?? (draft.lesson ? [draft.lesson] : []));
      setLessonImplementations(draft.lessonImplementations ?? []);
      setActiveTab("script");
    } else {
      setActiveTab("chat");
    }
    setLoaded(true);
  }, []);

  // Persist draft on change
  useEffect(() => {
    if (!loaded) return;
    writeDraft({ promptText, scriptBlocks, summary, coverUrl, coverPrompt, editingStoryId: editingStoryId ?? undefined, characterAvatars, characterTypes, storyTitle, lessons, lessonImplementations }, DRAFT_KEY);
  }, [promptText, scriptBlocks, summary, coverUrl, coverPrompt, editingStoryId, characterAvatars, characterTypes, storyTitle, lessons, lessonImplementations, loaded]);

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

  // ─── Generate story ─────────────────────────────────────────────────────────

  const handleGenerate = useCallback(async (selectedLessons: string[]) => {
    if (!promptText.trim()) return;
    setLessons(selectedLessons);
    setGenerating(true);
    setGenerateError(null);
    setEditingStoryId(null);
    setStoryTitle("");

    const body: GenerateStoryRequest = {
      mode: "prompt",
      promptText,
      primaryVoiceId: voicePool[0]?.id ?? PRESET_VOICE_POOL[0].id,
      durationMinutes,
      childAgeGroup: activeChild
        ? (activeChild.age <= 4 ? "2-4" : activeChild.age <= 6 ? "4-6" : activeChild.age <= 8 ? "6-8" : activeChild.age <= 10 ? "8-10" : "10-12")
        : MOCK_USER.preferredAgeGroup,
      language,
      ...(selectedLessons.length > 0 ? { lessons: selectedLessons } : {}),
    };

    try {
      const res  = await fetch("/api/generate-story", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      const blocks = data.blocks as ScriptBlock[];
      const sm = data.summary ?? "";
      const cp = data.coverPrompt ?? "";
      const title = (data.title as string | undefined) ?? "";
      const impls = (data.lessonImplementations ?? []) as { lesson: string; implemented: boolean; how: string }[];
      setScriptBlocks(blocks);
      setSummary(sm);
      setCoverPrompt(cp);
      setCoverUrl("");
      setStoryTitle(title);
      setLessonImplementations(impls);
      setHasScriptChanges(false);
      cleanLessonsRef.current = selectedLessons;
      setCharacterAvatars({});
      setCharacterTypes({});
      writeDraft({ promptText, scriptBlocks: blocks, summary: sm, coverUrl: "", coverPrompt: cp, editingStoryId: undefined, characterAvatars: {}, characterTypes: {}, storyTitle: title, lessons: selectedLessons, lessonImplementations: impls }, DRAFT_KEY);
      if (cp) fetchCover(cp, sm);
      setActiveTab("script");
      // Classify characters and pick avatar styles in background
      const uniqueChars = Array.from(new Set(blocks.filter((b: ScriptBlock) => b.characterName !== "SFX").map((b: ScriptBlock) => b.characterName)));
      if (uniqueChars.length) {
        // Set defaults immediately so avatars appear right away
        const defaultTypes: Record<string, CharacterType> = {};
        const defaultAvatars: Record<string, string> = {};
        for (const name of uniqueChars) {
          const t: CharacterType = name === "Narrator" ? "narrator" : "adult";
          defaultTypes[name] = t;
          defaultAvatars[name] = buildAvatarUrl(name, t);
        }
        setCharacterTypes(defaultTypes);
        setCharacterAvatars(defaultAvatars);
        // Refine with AI classification
        fetch("/api/classify-characters", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ characters: uniqueChars, summary: sm }),
        }).then((r) => r.json()).then((types: Record<string, string>) => {
          const refined: Record<string, CharacterType> = {};
          const refinedAvatars: Record<string, string> = {};
          for (const [name, type] of Object.entries(types)) {
            refined[name] = type as CharacterType;
            refinedAvatars[name] = buildAvatarUrl(name, type as CharacterType);
          }
          setCharacterTypes(refined);
          setCharacterAvatars(refinedAvatars);
        }).catch(() => console.warn("[Avatars] AI classification failed, keeping defaults"));
      }
    } catch (err: unknown) {
      setGenerateError(err instanceof Error ? err.message : "Something went wrong");
      setActiveTab("step-by-step");
    } finally {
      setGenerating(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promptText, durationMinutes, voicePool]);

  // ─── Revise script ──────────────────────────────────────────────────────────

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
      setHasScriptChanges(false);
    } catch (err: unknown) {
      setReviseError(err instanceof Error ? err.message : "Revision failed");
    } finally {
      setIsRevising(false);
    }
  }, [scriptBlocks, isRevising]);

  // ─── Rewrite with lessons (passes lessons so blocks get tagged) ─────────────

  const handleLessonRewrite = useCallback(async (instruction: string) => {
    if (!instruction.trim() || isRevising || scriptBlocks.length === 0) return;
    setIsRevising(true);
    setReviseError(null);
    try {
      const res  = await fetch("/api/revise-script", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ blocks: scriptBlocks, instruction: instruction.trim(), lessons }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Revision failed");
      setScriptBlocks(data.blocks);
      if (data.lessonImplementations) setLessonImplementations(data.lessonImplementations);
      setDirectorNote("");
      setHasScriptChanges(false);
      cleanLessonsRef.current = lessons;
    } catch (err: unknown) {
      setReviseError(err instanceof Error ? err.message : "Revision failed");
    } finally {
      setIsRevising(false);
    }
  }, [scriptBlocks, isRevising, lessons]);

  // ─── Manual save ────────────────────────────────────────────────────────────

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

  // ─── Load a save into the studio ────────────────────────────────────────────

  const handleLoadSave = useCallback((save: ScriptSaveFull) => {
    setScriptBlocks(save.blocks);
    if (save.summary)     setSummary(save.summary);
    if (save.coverUrl)    setCoverUrl(save.coverUrl);
    if (save.coverPrompt) setCoverPrompt(save.coverPrompt);
    setPendingDirections([]);
    setHasScriptChanges(false);
    cleanLessonsRef.current = [];
    // Build default avatars for the loaded cast
    const uniqueChars = Array.from(new Set(save.blocks.filter((b) => b.characterName !== "SFX").map((b) => b.characterName)));
    const defaultTypes: Record<string, CharacterType> = {};
    const defaultAvatars: Record<string, string> = {};
    for (const name of uniqueChars) {
      const t: CharacterType = name === "Narrator" ? "narrator" : "adult";
      defaultTypes[name] = t;
      defaultAvatars[name] = buildAvatarUrl(name, t);
    }
    setCharacterTypes(defaultTypes);
    setCharacterAvatars(defaultAvatars);
  }, []);

  // ─── Avatar type manual override ────────────────────────────────────────────

  const handleAvatarTypeChange = useCallback((characterName: string, type: CharacterType) => {
    setCharacterTypes((prev) => ({ ...prev, [characterName]: type }));
    setCharacterAvatars((prev) => ({ ...prev, [characterName]: buildAvatarUrl(characterName, type) }));
  }, []);

  // User-initiated block edits (text, SFX) — marks script dirty
  const handleBlocksChange = useCallback((blocks: ScriptBlock[]) => {
    setScriptBlocks(blocks);
    setHasScriptChanges(true);
  }, []);

  const handleCharacterVoiceChange = useCallback((characterName: string, voiceId: string) => {
    setScriptBlocks((prev) =>
      prev.map((b) => b.characterName === characterName ? { ...b, assignedVoiceId: voiceId } : b)
    );
    setHasScriptChanges(true);
  }, []);

  // ─── Queue a character direction ─────────────────────────────────────────────

  const handleQueueDirection = useCallback((instruction: string) => {
    setPendingDirections((prev) => [...prev, instruction]);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setShowToast(true);
    toastTimerRef.current = setTimeout(() => setShowToast(false), 4500);
  }, []);

  // ─── Apply all queued directions ─────────────────────────────────────────────

  const handleUpdateScript = useCallback(async () => {
    if (isRevising) return;
    const parts = [
      ...pendingDirections,
      directorNote.trim() ? directorNote.trim() : "",
    ].filter(Boolean);
    if (parts.length > 0) {
      setPendingDirections([]);
      setShowToast(false);
      await handleRevise(parts.join(". Also: "));
    } else {
      // Only manual edits — mark clean without regenerating
      setHasScriptChanges(false);
    }
  }, [pendingDirections, directorNote, isRevising, handleRevise]);

  // ─── Fetch cover ─────────────────────────────────────────────────────────────

  const fetchCover = useCallback(async (prompt: string, storySummary?: string) => {
    if (!prompt) return;
    setIsFetchingCover(true);
    try {
      const res = await fetch("/api/generate-cover", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, summary: storySummary }) });
      const data = await res.json();
      if (res.ok && data.coverUrl) {
        setCoverUrl(data.coverUrl);
      } else {
        console.error("[fetchCover] API error:", data);
      }
    } finally {
      setIsFetchingCover(false);
    }
  }, []);

  // Auto-fetch cover when a draft is loaded that has a coverPrompt but no coverUrl
  useEffect(() => {
    if (loaded && coverPrompt && !coverUrl && !isFetchingCover) {
      fetchCover(coverPrompt, summary);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  // ─── Produce audio ──────────────────────────────────────────────────────────

  const handleProduce = useCallback(async (blocks: ScriptBlock[], duration: number, force = false) => {
    setIsProducing(true);
    setProduceError(null);
    setActiveTab("producing");
    try {
      const body: Record<string, unknown> = { blocks, durationMinutes: duration, narratorVoiceId: getNarratorVoiceId() };
      if (editingStoryId) body.editingStoryId = editingStoryId;
      if (force) body.force = true;
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

  // ─── Early returns ──────────────────────────────────────────────────────────

  if (!loaded) return null;

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
            {lessons.length > 0 && (
              <p className="text-white/50 text-sm mb-1">
                Weaving in <span className="text-teal-300 font-medium">{lessons.join(" · ")}</span>
              </p>
            )}
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

  // ─── Main tab shell ─────────────────────────────────────────────────────────

  const hasScript = scriptBlocks.length > 0;
  const showTabBar = activeTab !== "lesson";

  return (
    <div className="min-h-full" dir={isRTL ? "rtl" : "ltr"}>
      <div className="px-5 pt-12 pb-8">
        {/* Header */}
        <div className="flex items-center mb-7">
          {activeTab === "lesson" ? (
            <div className="w-8" />
          ) : (
            <div className="w-8" />
          )}
          <h1 className="flex-1 text-center text-base font-semibold text-white tracking-wide">🌟 Studio</h1>
          <button
            onClick={() => setVersionsOpen(true)}
            className="relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl transition-all active:scale-95"
            style={savesCount > 0
              ? { background: "rgba(79,195,247,0.12)", border: "1px solid rgba(79,195,247,0.35)", color: "#4fc3f7" }
              : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.3)" }
            }
          >
            <span className="text-base leading-none">📂</span>
            {savesCount > 0 && (
              <span className="text-xs font-bold leading-none">{savesCount}</span>
            )}
          </button>
        </div>

        {/* Child profile picker */}
        {showTabBar && (
          <ChildProfilePicker selected={activeChild} onChange={(p) => { setActiveChild(p); setChatLocked(false); }} disabled={chatLocked} />
        )}

        {/* Tab bar — hidden during lesson step */}
        {showTabBar && (
          <div className="flex mb-7" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            {TABS.map(({ id, label, emoji }) => {
              const isStepByStep = id === "step-by-step";
              const isScript     = id === "script";
              const isDisabled   = isScript && !hasScript;
              const isActive     = activeTab === id;

              return (
                <button
                  key={id}
                  onClick={() => {
                    if (isDisabled) return;
                    if (isStepByStep) { setActiveTab("step-by-step"); return; }
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
        )}

        {/* Error banner */}
        {(generateError || produceError) && (
          <div className="mb-5 px-4 py-3 rounded-2xl text-xs leading-relaxed"
            style={{ background: "rgba(236,72,153,0.1)", border: "1px solid rgba(236,72,153,0.25)", color: "#EC4899" }}>
            ⚠ {generateError ?? produceError}
          </div>
        )}

        {/* Chat tab */}
        {activeTab === "chat" && (
          <LunaChatPanel
            activeChild={activeChild}
            onFirstMessage={() => setChatLocked(true)}
            onDiscard={() => setChatLocked(false)}
            onScriptReady={(draft) => {
              writeDraft({ ...draft, coverUrl: "" }, DRAFT_KEY);
              setScriptBlocks(draft.scriptBlocks);
              setSummary(draft.summary);
              setCoverPrompt(draft.coverPrompt);
              setCoverUrl("");
              setStoryTitle(draft.storyTitle ?? "");
              setLessons([]);
              setLessonImplementations([]);
              setActiveTab("script");
              if (draft.coverPrompt) fetchCover(draft.coverPrompt, draft.summary);
            }}
          />
        )}

        {/* Lesson step — interstitial between step-by-step and generation */}
        {activeTab === "lesson" && (
          <LessonStep
            onSelect={(selectedLessons) => handleGenerate(selectedLessons)}
            onBack={() => setActiveTab("step-by-step")}
          />
        )}

        {/* Step-by-step tab */}
        {activeTab === "step-by-step" && (
          <div className="-mx-5">
            <FiveQuestionFlow
              onComplete={({ blocks, summary: sm, coverPrompt: cp }) => {
                setScriptBlocks(blocks);
                setSummary(sm);
                setCoverPrompt(cp);
                setCoverUrl("");
                setLessons([]);
                setLessonImplementations([]);
                writeDraft({ promptText: "", scriptBlocks: blocks, summary: sm, coverUrl: "", coverPrompt: cp, lessons: [], lessonImplementations: [] }, DRAFT_KEY);
                if (cp) fetchCover(cp, sm);
                setActiveTab("script");
              }}
            />
          </div>
        )}

        {/* Script tab */}
        {activeTab === "script" && hasScript && (
          <>
            <ScriptTab
              blocks={scriptBlocks}
              voices={voicePool}
              onBlocksChange={handleBlocksChange}
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
              characterAvatars={characterAvatars}
              belowCover={
                <>
                  <CharacterCards
                    blocks={scriptBlocks}
                    voicePool={voicePool}
                    avatars={characterAvatars}
                    characterTypes={characterTypes}
                    onDirectCharacter={(_, instruction) => handleQueueDirection(instruction)}
                    onAvatarTypeChange={handleAvatarTypeChange}
                    onVoiceChange={handleCharacterVoiceChange}
                  />
                  <LessonEditor
                    lessons={lessons}
                    onChange={(next) => setLessons(next)}
                    onRewrite={(instruction) => handleLessonRewrite(instruction)}
                    lessonImplementations={lessonImplementations}
                  />
                </>
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

            {/* Update Script */}
            {(() => {
              const hasPending = hasScriptChanges || pendingDirections.length > 0 || directorNote.trim().length > 0;
              const dirCount = pendingDirections.length + (directorNote.trim() ? 1 : 0);
              return (
                <button
                  onClick={handleUpdateScript}
                  disabled={!hasPending || isRevising}
                  className="w-full py-3.5 rounded-2xl font-semibold text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2 mb-2.5"
                  style={hasPending && !isRevising
                    ? { background: "rgba(79,195,247,0.15)", border: "1.5px solid rgba(79,195,247,0.55)", color: "#4fc3f7", boxShadow: "0 0 22px rgba(79,195,247,0.2)" }
                    : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.18)", cursor: "not-allowed" }
                  }
                >
                  {isRevising ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 rounded-full animate-spin" style={{ borderColor: "rgba(255,255,255,0.15)", borderTopColor: "rgba(255,255,255,0.6)" }} />
                      Updating…
                    </>
                  ) : hasPending && dirCount > 0 ? (
                    <>✏️ Update Script · {dirCount} change{dirCount > 1 ? "s" : ""}</>
                  ) : hasPending ? (
                    <>✏️ Update Script</>
                  ) : (
                    <>✏️ Update Script</>
                  )}
                </button>
              );
            })()}

            {/* Produce Audio */}
            {(() => {
              const hasPending = hasScriptChanges || pendingDirections.length > 0 || directorNote.trim().length > 0;
              const blocked = isProducing || hasPending;
              return (
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
              );
            })()}

            {/* Save script version */}
            {(() => {
              const hasPending = hasScriptChanges || pendingDirections.length > 0 || directorNote.trim().length > 0;
              const canSave = !hasPending && !isProducing && scriptBlocks.length > 0;
              return (
                <button
                  onClick={handleManualSave}
                  disabled={!canSave || isSaving || saveLabel === "saved"}
                  className="w-full mt-2.5 py-3 rounded-2xl text-sm font-medium transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                  style={saveLabel === "saved"
                    ? { background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", color: "#34d399" }
                    : canSave
                    ? { background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.35)", color: "#c4b5fd", boxShadow: "0 0 14px rgba(139,92,246,0.12)" }
                    : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.2)", cursor: "not-allowed" }
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
              );
            })()}

            {/* Toast */}
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
