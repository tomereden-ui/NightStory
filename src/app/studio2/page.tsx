"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { readDraft, writeDraft } from "@/lib/draftStore";
import { useLanguage } from "@/context/LanguageContext";
import { useRouter, useSearchParams } from "next/navigation";
import ScriptTab from "@/components/studio/ScriptTab";
import ProductionProgress from "@/components/studio/ProductionProgress";
import DramaPlayer from "@/components/studio/DramaPlayer";
import LessonStep from "@/components/studio/LessonStep";
import LessonEditor from "@/components/studio/LessonEditor";
import { MOCK_USER } from "@/lib/mockData";
import { PRESET_VOICE_POOL, fetchVoicePool } from "@/lib/services/voiceCatalog";
import type { ScriptBlock, Voice, StoryScene } from "@/types";
import type { CharacterProfile } from "@/lib/libraryStore";
import type { GenerateStoryRequest } from "@/app/api/generate-story/route";
import type { Job } from "@/lib/jobs";
import type { ScriptSaveMeta, ScriptSaveFull } from "@/lib/scriptSaves";
import { FiveQuestionFlow } from "@/app/create/five-question/FiveQuestionFlow";
import { SCENE_CHARS } from "@/config/sceneCharacters";
import { LANGUAGE_META, t as i18nT } from "@/lib/i18n";
import ChildProfilePicker, { type DBChildProfile } from "@/components/studio/ChildProfilePicker";
import LunaChatPanel from "@/components/studio/LunaChatPanel";
import VoicePicker from "@/components/studio/VoicePicker";
import { getNarratorVoiceId } from "@/lib/narratorPreference";
import Icon from "@/components/ui/Icon";
import { useAuth } from "@/context/AuthContext";
import { useUnsavedChanges } from "@/context/UnsavedChangesContext";
import { assignVoicesToCharacters, assignHebrewVoicesToCharacters } from "@/lib/services/voiceAssignment";

// ─── Draft key — separate from Studio so drafts don't cross-contaminate ──────
const DRAFT_KEY = "nightstory_studio2_draft_v1";

// Same admin gate used by /admin — see src/app/admin/page.tsx
const ADMIN_EMAIL = "tomereden@gmail.com";

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
  onClose,
}: {
  onLoad: (save: ScriptSaveFull) => void;
  refreshKey: number;
  forceExpanded?: boolean;
  onCount?: (n: number) => void;
  onClose?: () => void;
}) {
  const { language } = useLanguage();
  const [saves, setSaves] = useState<ScriptSaveMeta[]>([]);
  const [expanded, setExpanded] = useState(forceExpanded);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

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
      if (!res.ok) {
        console.error("[ScriptBrowser] load failed:", res.status, id);
        // Server cleaned up the index entry; on next open it won't appear.
        // For now just silently do nothing — don't remove from local list (would look like a delete).
        return;
      }
      const save = await res.json() as ScriptSaveFull;
      onLoad(save);
      setExpanded(false);
      onClose?.();
    } catch (err) {
      console.error("[ScriptBrowser] load error:", err);
    } finally {
      setLoadingId(null);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingId(id);
    try {
      const res = await fetch(`/api/script-saves/${id}`, { method: "DELETE" });
      if (!res.ok) {
        console.error("[ScriptBrowser] delete failed:", res.status, await res.text().catch(() => ""));
      }
      // Always remove from local state — if API failed the item will reappear on next refresh
      setSaves((prev) => { const next = prev.filter((s) => s.id !== id); onCount?.(next.length); return next; });
    } catch (err) {
      console.error("[ScriptBrowser] delete error:", err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearAll = async () => {
    if (!confirm(i18nT(language, "deleteAllVersionsConfirm" as Parameters<typeof i18nT>[1]))) return;
    setClearing(true);
    await Promise.allSettled(saves.map((s) => fetch(`/api/script-saves/${s.id}`, { method: "DELETE" })));
    setSaves([]);
    onCount?.(0);
    setClearing(false);
  };

  const manualSaves = saves.filter((s) => !s.isAutosave);

  if (!forceExpanded) {
    return (
      <div className="mb-5 rounded-2xl overflow-hidden"
        style={{ background: "linear-gradient(145deg,rgba(10,18,40,0.95) 0%,rgba(5,8,20,0.98) 100%)", border: "1px solid rgba(79,195,247,0.18)", boxShadow: "0 4px 32px rgba(0,0,0,0.4)" }}>
        <button onClick={() => setExpanded((p) => !p)} className="w-full flex items-center justify-between px-4 py-3 text-left">
          <div className="flex items-center gap-2.5">
            <Icon name="folder" size={14} />
            <span className="text-fs-body font-bold uppercase tracking-widest" style={{ color: "rgba(79,195,247,0.7)" }}>{i18nT(language, "savedVersions" as Parameters<typeof i18nT>[1])}</span>
            <span className="min-w-[18px] h-4 px-1.5 rounded-full text-fs-body font-bold flex items-center justify-center"
              style={{ background: "rgba(79,195,247,0.15)", color: "rgba(79,195,247,0.85)", border: "1px solid rgba(79,195,247,0.3)" }}>{saves.length}</span>
          </div>
          <span className="text-white/25 text-fs-body">{expanded ? "↑" : "↓"}</span>
        </button>
        {expanded && <VersionList saves={saves} loadingId={loadingId} deletingId={deletingId} onLoad={handleLoad} onDelete={handleDelete} />}
      </div>
    );
  }

  return (
    <VersionList
      saves={saves}
      loadingId={loadingId}
      deletingId={deletingId}
      onLoad={handleLoad}
      onDelete={handleDelete}
      onClearAll={saves.length > 0 ? handleClearAll : undefined}
      clearing={clearing}
    />
  );
}

function VersionList({
  saves, loadingId, deletingId, onLoad, onDelete, onClearAll, clearing,
}: {
  saves: ScriptSaveMeta[];
  loadingId: string | null;
  deletingId: string | null;
  onLoad: (id: string) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  onClearAll?: () => void;
  clearing?: boolean;
}) {
  const { language } = useLanguage();
  return (
    <div className="flex flex-col gap-2 pb-2">
      {saves.map((s) => {
        const isLoading  = loadingId === s.id;
        const isDeleting = deletingId === s.id;
        const summarySnip = s.summary
          ? s.summary.replace(/\n/g, " ").trim().slice(0, 72) + (s.summary.length > 72 ? "…" : "")
          : null;

        return (
          /* Row wrapper — card + delete are siblings, not nested */
          <div key={s.id} className="flex items-center gap-2" style={{ opacity: isDeleting ? 0.35 : 1 }}>

            {/* Clickable story card */}
            <div
              onClick={() => !isDeleting && !isLoading && onLoad(s.id)}
              className="flex items-center gap-3 rounded-2xl cursor-pointer transition-all active:scale-[0.985] flex-1 min-w-0"
              style={{
                background: s.isAutosave
                  ? "linear-gradient(135deg,rgba(245,158,11,0.08) 0%,rgba(10,18,40,0.5) 100%)"
                  : isLoading
                    ? "rgba(79,195,247,0.07)"
                    : "rgba(255,255,255,0.03)",
                border: s.isAutosave
                  ? "1px solid rgba(245,158,11,0.22)"
                  : isLoading
                    ? "1px solid rgba(79,195,247,0.22)"
                    : "1px solid rgba(255,255,255,0.07)",
                padding: "10px 12px",
              }}
            >
              {/* Cover thumbnail */}
              <div className="flex-shrink-0 rounded-xl overflow-hidden flex items-center justify-center"
                style={{ width: 44, height: 44, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                {s.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.coverUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-fs-subtitle">📖</span>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                <div className="flex items-center gap-1.5">
                  {s.isAutosave && <span className="text-fs-body leading-none">⚡</span>}
                  <span className="text-fs-body font-semibold leading-snug truncate"
                    style={{ color: s.isAutosave ? "rgba(245,158,11,0.95)" : "rgba(255,255,255,0.9)" }}>
                    {s.label}
                  </span>
                </div>
                {summarySnip && (
                  <p className="text-fs-body leading-snug truncate" style={{ color: "rgba(255,255,255,0.4)" }}>
                    {summarySnip}
                  </p>
                )}
                <p className="text-fs-body" style={{ color: "rgba(255,255,255,0.22)" }}>
                  {timeAgo(s.savedAt)}
                </p>
              </div>

              {/* Loading spinner inside card */}
              {isLoading && (
                <span className="w-4 h-4 border-2 rounded-full animate-spin flex-shrink-0"
                  style={{ borderColor: "rgba(79,195,247,0.2)", borderTopColor: "#4fc3f7" }} />
              )}
            </div>

            {/* Delete button — sits OUTSIDE the card, clearly separate */}
            {!isLoading && (
              <button
                onClick={(e) => onDelete(s.id, e)}
                disabled={isDeleting}
                className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.3)" }}
                title="Delete this version"
              >
                <Icon name="close" size={10} />
              </button>
            )}
          </div>
        );
      })}

      {/* Delete all — bottom of list */}
      {onClearAll && (
        <div className="flex items-center justify-center pt-3 pb-1">
          <button onClick={onClearAll} disabled={clearing}
            className="text-fs-body font-medium px-4 py-1.5 rounded-xl transition-all active:scale-95"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.3)" }}>
            {clearing ? i18nT(language, "deleting" as Parameters<typeof i18nT>[1]) : i18nT(language, "deleteAllVersions" as Parameters<typeof i18nT>[1])}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Avatar types ─────────────────────────────────────────────────────────────

type CharacterType = "child" | "adult" | "animal" | "narrator";

// Bank avatar type (matches avatar-bank-list API response)
interface BankAvatar { id: string; description: string; image_url: string; type: string; gender: string; }

// Module-level cache so we only fetch once per session
let _bankCache: BankAvatar[] | null = null;
async function fetchBankAvatars(): Promise<BankAvatar[]> {
  if (_bankCache) return _bankCache;
  try {
    const res = await fetch("/api/avatar-bank-list");
    const data = await res.json() as { avatars: BankAvatar[] };
    _bankCache = data.avatars ?? [];
  } catch {
    _bankCache = [];
  }
  return _bankCache;
}

// Simple deterministic hash so the same character always gets the same avatar
function nameHash(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (Math.imul(31, h) + name.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// Pick a bank avatar matching the character type, falling back to DiceBear on empty bank
function pickBankAvatar(characterName: string, type: CharacterType, bank: BankAvatar[]): string {
  const dbType = type === "narrator" ? "adult" : type;
  const pool = bank.filter((a) => a.type === dbType);
  // Fall back to the full bank if no type-matched entries (e.g. type column not yet populated)
  const candidates = pool.length > 0 ? pool : bank;
  if (candidates.length === 0) return buildDiceBearUrl(characterName, type);
  return candidates[nameHash(characterName) % candidates.length].image_url;
}

// For narrator characters, always use the selected narrator voice's avatar
function resolveCharacterAvatar(
  name: string,
  type: CharacterType,
  bank: BankAvatar[],
  voicePool: Voice[],
): string {
  if (type === "narrator") {
    const voiceId = getNarratorVoiceId();
    const avatar = voicePool.find((v) => v.id === voiceId)?.avatarUrl;
    if (avatar) return avatar;
  }
  return pickBankAvatar(name, type, bank);
}

function buildDiceBearUrl(characterName: string, type: CharacterType): string {
  const seed = encodeURIComponent(characterName);
  const bg = "0d1b4a";
  switch (type) {
    case "child":  return `https://api.dicebear.com/9.x/adventurer/svg?seed=${seed}&backgroundColor=${bg}`;
    case "animal": return `https://api.dicebear.com/9.x/croodles/svg?seed=${seed}&backgroundColor=${bg}&scale=90`;
    default:       return `https://api.dicebear.com/9.x/micah/svg?seed=${seed}&backgroundColor=${bg}&scale=85`;
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
  onAvatarChange,
  onVoiceChange,
  storyLanguage,
  isAdmin,
  onReassignCast,
}: {
  blocks: ScriptBlock[];
  voicePool: Voice[];
  avatars: Record<string, string>;
  characterTypes: Record<string, CharacterType>;
  onDirectCharacter: (characterName: string, instruction: string) => void;
  onAvatarChange: (characterName: string, url: string, type: CharacterType) => void;
  onVoiceChange: (characterName: string, voiceId: string) => void;
  /** The story's actual content language — falls back to UI language if not provided. */
  storyLanguage?: string;
  isAdmin?: boolean;
  onReassignCast?: () => void;
}) {
  const [openCharacter, setOpenCharacter] = useState<string | null>(null);
  const { language } = useLanguage();

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
      <div className="flex items-center justify-between mb-3">
        <p className="text-fs-body font-bold uppercase tracking-widest" style={{ color: "rgba(79,195,247,0.45)" }}>
          {i18nT(language, "castSection")}
        </p>
        {isAdmin && onReassignCast && (
          <button
            onClick={onReassignCast}
            className="text-fs-body font-semibold px-2.5 py-1 rounded-full transition-all active:scale-95"
            style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(167,139,250,0.35)", color: "#c4b5fd" }}
            title="Re-run nature-based voice matching for every character"
          >
            🎭 Assign Cast
          </button>
        )}
      </div>
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
          onAvatarChange={(url, type) => onAvatarChange(openCharacter, url, type)}
          onVoiceChange={(voiceId) => onVoiceChange(openCharacter, voiceId)}
          onClose={() => setOpenCharacter(null)}
          storyLanguage={storyLanguage}
        />
      )}
    </div>
  );
}

const CHAR_CHIPS = [
  "More gentle", "More dramatic", "More playful", "Shorter lines", "More expressive",
];

// ─── Avatar picker gallery ────────────────────────────────────────────────────

const AVATAR_TABS = [
  { key: "child",  labelKey: "kidsTab" as const,    emoji: "🧒" },
  { key: "adult",  labelKey: "adultsTab" as const,  emoji: "🧑" },
  { key: "animal", labelKey: "animalsTab" as const, emoji: "🐾" },
];

function AvatarGallery({
  currentUrl,
  characterType,
  onSelect,
}: {
  currentUrl?: string;
  characterType: CharacterType;
  onSelect: (url: string, type: CharacterType) => void;
}) {
  const { language } = useLanguage();
  const [bank, setBank] = useState<BankAvatar[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>(
    characterType === "narrator" ? "adult" : characterType
  );

  useEffect(() => {
    fetchBankAvatars().then((b) => { setBank(b); setLoading(false); });
  }, []);

  const filtered = bank.filter((a) => a.type === activeTab);

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: "rgba(5,7,18,0.97)", border: "1px solid rgba(139,92,246,0.2)" }}>
      {/* Tabs */}
      <div className="flex p-1.5 gap-1" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        {AVATAR_TABS.map(({ key, labelKey, emoji }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-fs-body font-bold transition-all active:scale-95"
            style={activeTab === key
              ? { background: "linear-gradient(135deg,rgba(139,92,246,0.3),rgba(79,195,247,0.15))", color: "#C4B5FD", border: "1px solid rgba(139,92,246,0.45)" }
              : { color: "rgba(255,255,255,0.25)", border: "1px solid transparent" }
            }
          >
            <span style={{ fontSize: "var(--fs-label)" }}>{emoji}</span>
            <span>{i18nT(language, labelKey)}</span>
          </button>
        ))}
      </div>
      {/* Grid */}
      <div className="p-2.5 overflow-y-auto" style={{ maxHeight: 210 }}>
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <span className="w-6 h-6 border-2 rounded-full animate-spin"
              style={{ borderColor: "rgba(167,139,250,0.15)", borderTopColor: "#A78BFA" }} />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center py-6 text-fs-body" style={{ color: "rgba(255,255,255,0.2)" }}>{i18nT(language, "noAvatarsYet")}</p>
        ) : (
          <div className="grid grid-cols-5 gap-2">
            {filtered.map((avatar) => {
              const selected = currentUrl === avatar.image_url;
              return (
                <button key={avatar.id}
                  onClick={() => onSelect(avatar.image_url, activeTab as CharacterType)}
                  className="aspect-square rounded-xl overflow-hidden transition-all active:scale-90 relative"
                  style={selected
                    ? { background: "#07091a", boxShadow: "0 0 0 3px #A78BFA, 0 0 18px rgba(167,139,250,0.45)", transform: "scale(1.04)" }
                    : { background: "#07091a", boxShadow: "0 0 0 1px rgba(255,255,255,0.06)" }
                  }
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={avatar.image_url} alt="" className="w-full h-full object-cover" />
                  {selected && (
                    <div className="absolute inset-0 flex items-center justify-center"
                      style={{ background: "rgba(139,92,246,0.25)" }}>
                      <span style={{ fontSize: "var(--fs-heading)" }}>✓</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Character direction sheet — full redesign ────────────────────────────────

function DirectionSheet({
  characterName,
  voice,
  voicePool,
  avatarUrl,
  characterType,
  onDirect,
  onAvatarChange,
  onVoiceChange,
  onClose,
  storyLanguage,
}: {
  characterName: string;
  voice: Voice | undefined;
  voicePool: Voice[];
  avatarUrl?: string;
  characterType: CharacterType;
  onDirect: (instruction: string) => void;
  onAvatarChange: (url: string, type: CharacterType) => void;
  onVoiceChange: (voiceId: string) => void;
  onClose: () => void;
  /** The story's actual content language — falls back to UI language if not provided. */
  storyLanguage?: string;
}) {
  const { language } = useLanguage();
  const [note, setNote] = useState("");
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showVoicePicker, setShowVoicePicker]   = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isNarrator = characterName === "Narrator" || characterName === "קריין";

  const submit = (instruction: string) => {
    const trimmed = instruction.trim();
    if (!trimmed) return;
    onDirect(isNarrator
      ? `For the Narrator: ${trimmed}`
      : `For the character "${characterName}": ${trimmed}`);
    setNote("");
    onClose();
  };

  // Accent colours per section
  const avatarAccent = "#A78BFA"; // violet
  const voiceAccent  = "#4FC3F7"; // cyan
  const directAccent = "#FCD34D"; // amber

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)" }}
        onClick={onClose} />

      {/* Sheet — centered, max-width, constrained to viewport */}
      <div
        className="fixed z-50 flex flex-col overflow-hidden"
        style={{
          left: "50%", transform: "translateX(-50%)",
          bottom: 80,
          width: "calc(100vw - 24px)",
          maxWidth: 460,
          maxHeight: "calc(100dvh - 160px)",
          borderRadius: 24,
          background: "linear-gradient(170deg, #0d1530 0%, #080d1e 55%, #0a0618 100%)",
          border: "1px solid rgba(139,92,246,0.35)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(139,92,246,0.08) inset, 0 1px 0 rgba(255,255,255,0.06) inset",
        }}
      >
        {/* ── HERO HEADER ── */}
        <div className="relative flex-shrink-0 px-5 pt-5 pb-4"
          style={{
            background: "linear-gradient(160deg, rgba(88,28,220,0.22) 0%, rgba(30,58,120,0.18) 100%)",
            borderBottom: "1px solid rgba(139,92,246,0.18)",
          }}>
          {/* Glow blob behind avatar */}
          <div className="absolute left-4 top-3 w-20 h-20 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(139,92,246,0.35) 0%, transparent 70%)", filter: "blur(12px)" }} />

          <div className="flex items-center gap-4 relative">
            {/* Large avatar */}
            <div className="flex-shrink-0 relative">
              <div className="w-16 h-16 rounded-2xl overflow-hidden"
                style={{ background: "#07091a", boxShadow: "0 0 0 2.5px rgba(167,139,250,0.6), 0 0 20px rgba(139,92,246,0.4), 0 4px 16px rgba(0,0,0,0.5)" }}>
                {avatarUrl
                  ? /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={avatarUrl} alt={characterName} className="w-full h-full object-cover rounded-full" />
                  : <div className="w-full h-full flex items-center justify-center text-fs-subtitle font-black"
                      style={{ background: "linear-gradient(135deg,rgba(88,28,220,0.5),rgba(30,58,120,0.5))", color: "#C4B5FD" }}>
                      {characterName.charAt(0)}
                    </div>
                }
              </div>
              {/* Character type badge */}
              <div className="absolute -bottom-1.5 -right-1.5 px-1.5 py-0.5 rounded-full text-fs-body font-black uppercase tracking-wider"
                style={{ background: "linear-gradient(135deg,#7C3AED,#4338CA)", color: "#E9D5FF", boxShadow: "0 2px 8px rgba(0,0,0,0.5)" }}>
                {isNarrator ? "🎙" : characterType === "animal" ? "🐾" : characterType === "child" ? "🧒" : "🧑"}
              </div>
            </div>

            {/* Name + voice */}
            <div className="flex-1 min-w-0">
              <p className="font-black leading-tight truncate"
                style={{ fontSize: "var(--fs-subtitle)", color: "#fff", textShadow: "0 2px 12px rgba(139,92,246,0.5)" }}>
                {characterName}
              </p>
              {voice && (
                <div className="flex items-center gap-1.5 mt-1">
                  <span style={{ fontSize: "var(--fs-caption)", color: "rgba(255,255,255,0.35)" }}>🎙</span>
                  <span className="text-fs-body truncate" style={{ color: "rgba(255,255,255,0.45)" }}>{voice.name}</span>
                </div>
              )}
            </div>

            {/* Close */}
            <button onClick={onClose}
              className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full transition-all active:scale-90"
              style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }}>
              <Icon name="close" size={14} />
            </button>
          </div>
        </div>

        {/* ── SCROLLABLE BODY ── */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-3 p-4">

          {/* ── SECTION 1: AVATAR ── */}
          <div className="rounded-2xl overflow-hidden"
            style={{ background: "rgba(88,28,220,0.08)", border: "1px solid rgba(139,92,246,0.2)" }}>
            {/* Section header row (always visible) */}
            <button
              onClick={() => { setShowAvatarPicker((p) => !p); setShowVoicePicker(false); }}
              className="flex items-center gap-3 w-full px-4 py-3 transition-all active:scale-[0.99]"
            >
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `rgba(167,139,250,0.15)`, border: `1px solid rgba(167,139,250,0.3)` }}>
                <span style={{ fontSize: "var(--fs-body)" }}>🎭</span>
              </div>
              <div className="flex-1 text-left">
                <p className="text-fs-body font-black uppercase tracking-widest" style={{ color: avatarAccent }}>{i18nT(language, "avatarLabel")}</p>
                <p className="text-fs-body mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                  {showAvatarPicker ? i18nT(language, "tapImageToSelect") : i18nT(language, "chooseCharacterLook")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {avatarUrl && (
                  <div className="w-7 h-7 rounded-lg overflow-hidden flex-shrink-0"
                    style={{ border: `1.5px solid rgba(167,139,250,0.4)` }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={avatarUrl} alt="" className="w-full h-full object-cover rounded-full" />
                  </div>
                )}
                <Icon name={showAvatarPicker ? "collapse" : "expand"} size={12}
                  style={{ color: "rgba(167,139,250,0.5)" }} />
              </div>
            </button>
            {/* Expandable gallery */}
            {showAvatarPicker && (
              <div className="px-3 pb-3">
                <AvatarGallery
                  currentUrl={avatarUrl}
                  characterType={characterType}
                  onSelect={(url, type) => { onAvatarChange(url, type); setShowAvatarPicker(false); }}
                />
              </div>
            )}
          </div>

          {/* ── SECTION 2: VOICE ── */}
          <div className="rounded-2xl overflow-hidden"
            style={{ background: "rgba(14,78,107,0.15)", border: "1px solid rgba(79,195,247,0.18)" }}>
            <button
              onClick={() => { setShowVoicePicker((p) => !p); setShowAvatarPicker(false); }}
              className="flex items-center gap-3 w-full px-4 py-3 transition-all active:scale-[0.99]"
            >
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(79,195,247,0.12)", border: "1px solid rgba(79,195,247,0.28)" }}>
                <span style={{ fontSize: "var(--fs-body)" }}>🎙️</span>
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-fs-body font-black uppercase tracking-widest" style={{ color: voiceAccent }}>{i18nT(language, "voiceLabel")}</p>
                <p className="text-fs-body mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.55)" }}>
                  {voice?.name ?? i18nT(language, "noVoiceSelected")}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {voice?.avatarUrl && (
                  <div className="w-7 h-7 rounded-full overflow-hidden"
                    style={{ border: "1.5px solid rgba(79,195,247,0.4)" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={voice.avatarUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
                <Icon name={showVoicePicker ? "collapse" : "expand"} size={12}
                  style={{ color: "rgba(79,195,247,0.45)" }} />
              </div>
            </button>
            {showVoicePicker && (
              <div className="px-3 pb-3">
                <VoicePicker
                  inline
                  voices={voicePool}
                  selectedVoiceId={voice?.id ?? ""}
                  onSelect={(voiceId) => { onVoiceChange(voiceId); setShowVoicePicker(false); }}
                  onClose={() => setShowVoicePicker(false)}
                  storyLanguage={storyLanguage ?? language}
                />
              </div>
            )}
          </div>

          {/* ── SECTION 3: DIRECTION ── */}
          <div className="rounded-2xl overflow-hidden"
            style={{ background: "rgba(120,80,0,0.1)", border: "1px solid rgba(252,211,77,0.15)" }}>
            <div className="px-4 pt-3 pb-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(252,211,77,0.1)", border: "1px solid rgba(252,211,77,0.25)" }}>
                  <span style={{ fontSize: "var(--fs-body)" }}>✏️</span>
                </div>
                <div>
                  <p className="text-fs-body font-black uppercase tracking-widest" style={{ color: directAccent }}>
                    {i18nT(language, "directThisCharacter")}
                  </p>
                  <p className="text-fs-body mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
                    Shape how they perform in this story
                  </p>
                </div>
              </div>

              {/* Quick chips */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {CHAR_CHIPS.map((chip) => (
                  <button key={chip} onClick={() => submit(chip)}
                    className="text-fs-body px-3 py-1.5 rounded-full font-semibold transition-all active:scale-95"
                    style={{ background: "rgba(252,211,77,0.08)", border: "1px solid rgba(252,211,77,0.22)", color: "#FCD34D" }}>
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom text input */}
            <div className="px-3 pb-3">
              <div className="flex gap-2 items-center rounded-xl px-3 py-2"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(252,211,77,0.15)" }}>
                <input
                  ref={inputRef}
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") submit(note); if (e.key === "Escape") onClose(); }}
                  placeholder={i18nT(language, "customDirection")}
                  className="flex-1 bg-transparent outline-none text-fs-body text-white/80 placeholder-white/20"
                />
                <button onClick={() => submit(note)} disabled={!note.trim()}
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all active:scale-90"
                  style={note.trim()
                    ? { background: "rgba(252,211,77,0.2)", border: "1px solid rgba(252,211,77,0.45)", color: "#FCD34D" }
                    : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.15)" }
                  }>
                  <Icon name="submit" size={13} />
                </button>
              </div>
            </div>
          </div>

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

  const size = isNarrator ? 72 : 64;
  // Narrator: gold/amber. Cast: cyan-to-purple gradient.
  const ringActive = isNarrator
    ? "linear-gradient(135deg,#f59e0b,#fbbf24,#f59e0b)"
    : "linear-gradient(135deg,#4fc3f7,#a78bfa)";
  const ringIdle = "linear-gradient(135deg,rgba(255,255,255,0.1),rgba(255,255,255,0.04))";
  const glowActive = isNarrator
    ? "0 0 22px rgba(245,158,11,0.5), 0 0 40px rgba(251,191,36,0.2)"
    : "0 0 20px rgba(79,195,247,0.35), 0 0 36px rgba(167,139,250,0.2)";
  const accentColor = isNarrator ? "#fbbf24" : "rgba(79,195,247,0.8)";
  const displayUrl = avatarUrl || buildDiceBearUrl(characterName, isNarrator ? "narrator" : "adult");

  return (
    <div className="flex-shrink-0 flex flex-col items-center gap-1.5" style={{ minWidth: isNarrator ? 80 : 72 }}>
      <button onClick={onOpen} className="flex flex-col items-center gap-1.5 w-full" title={`Direct ${characterName}`}>
        {/* gradient ring wrapper */}
        <div style={{
          padding: isOpen ? 2.5 : 1.5,
          borderRadius: "50%",
          background: isOpen ? ringActive : ringIdle,
          boxShadow: isOpen ? glowActive : "0 4px 14px rgba(0,0,0,0.4)",
          transition: "all 0.2s ease",
          position: "relative",
        }}>
          <div style={{
            width: size, height: size, borderRadius: "50%",
            overflow: "hidden", background: "#07091a",
          }}>
            {!imgError ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={displayUrl} alt={characterName} style={{ width:"100%", height:"100%", objectFit:"cover" }} onError={() => setImgError(true)} />
            ) : (
              <div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center",
                background: isNarrator ? "linear-gradient(135deg,rgba(120,80,10,0.5),rgba(80,50,5,0.5))" : "linear-gradient(135deg,rgba(30,80,120,0.5),rgba(60,20,120,0.5))" }}>
                <span style={{ fontSize: "var(--fs-title)", fontWeight: 900, color: accentColor }}>{characterName.charAt(0).toUpperCase()}</span>
              </div>
            )}
          </div>
          {/* Narrator crown badge */}
          {isNarrator && (
            <span style={{
              position:"absolute", top:-6, left:"50%", transform:"translateX(-50%)",
              fontSize:14, filter:"drop-shadow(0 0 6px rgba(245,158,11,0.8))",
            }}>👑</span>
          )}
        </div>
        <span className="text-fs-body font-bold uppercase tracking-widest text-center leading-tight truncate w-full"
          style={{ color: accentColor }}>
          {characterName}
        </span>
        {voice && (
          <span className="text-fs-body font-medium text-center truncate w-full" style={{ color: "rgba(255,255,255,0.4)" }}>{voice.name.split(" ")[0]}</span>
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
              background: "#07091a",
              boxShadow: `0 0 0 2.5px ${c.glow}55, 0 0 16px ${c.glow}44, 0 4px 12px rgba(0,0,0,0.5)`,
              border: `1.5px solid ${c.glow}66`,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cachedUrls[c.label] ?? c.url} alt={c.label} className="w-full h-full" style={{ imageRendering: "auto" }} />
          </div>
          <span className="mt-1 text-fs-body font-semibold tracking-wide"
            style={{ color: `${c.glow}cc`, textShadow: `0 0 8px ${c.glow}88` }}>
            {c.label}
          </span>
        </div>
      ))}

      <div className="absolute bottom-0 left-0 right-0 px-4 pt-8 pb-3"
        style={{ background: "linear-gradient(to top, rgba(6,11,30,0.97) 0%, rgba(6,11,30,0.7) 60%, transparent 100%)" }}>
        <p className="text-fs-body font-semibold uppercase tracking-[0.18em] mb-0.5" style={{ color: "rgba(139,92,246,0.7)" }}>
          Studio
        </p>
        <h2 className="text-fs-heading font-bold leading-tight"
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
          <label className="text-fs-body font-bold uppercase tracking-widest" style={{ color: "rgba(79,195,247,0.5)" }}>
            {i18nT(language as Parameters<typeof i18nT>[0], "yourStoryIdea" as Parameters<typeof i18nT>[1])}
          </label>
          {wordCount > 0 && (
            <span className="text-fs-body" style={{ color: "rgba(255,255,255,0.2)" }}>{wordCount} words</span>
          )}
        </div>
        <div className="relative">
          <textarea
            placeholder={"A sleepy dragon who can't breathe fire befriends a firefly…"}
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            rows={5}
            className="w-full rounded-2xl px-4 py-3.5 text-fs-body text-white placeholder-white/20 outline-none resize-none leading-relaxed"
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
          <p className="text-fs-body font-semibold uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.2)" }}>
            {i18nT(language as Parameters<typeof i18nT>[0], "orTryIdea" as Parameters<typeof i18nT>[1])}
          </p>
          <div className="flex flex-col gap-1.5">
            {STORY_SEEDS.map((seed) => (
              <button
                key={seed.text}
                onClick={() => setPromptText(seed.text)}
                className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-left transition-all active:scale-[0.98]"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <span className="text-fs-heading flex-shrink-0">{seed.icon}</span>
                <span className="text-fs-body leading-snug" style={{ color: "rgba(255,255,255,0.5)" }}>{seed.text}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl px-4 py-3.5" style={{ background: "rgba(79,195,247,0.04)", border: "1px solid rgba(79,195,247,0.12)" }}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-fs-body font-bold uppercase tracking-widest" style={{ color: "rgba(79,195,247,0.5)" }}>{i18nT(language as Parameters<typeof i18nT>[0], "storyLength" as Parameters<typeof i18nT>[1])}</span>
          <span className="text-fs-body font-bold tabular-nums" style={{ color: "#4fc3f7" }}>{durationMinutes} min</span>
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
              <span className="text-fs-heading mb-0.5">{p.icon}</span>
              <span className="text-fs-body font-bold" style={{ color: durationMinutes === p.value ? "#4fc3f7" : "rgba(255,255,255,0.45)" }}>{p.label}</span>
              <span className="text-fs-body" style={{ color: durationMinutes === p.value ? "rgba(79,195,247,0.6)" : "rgba(255,255,255,0.2)" }}>{p.desc}</span>
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
            <span className="text-fs-heading">{meta.flag}</span>
            <span className="text-fs-body" style={{ color: "rgba(255,255,255,0.3)" }}>
              Story will be generated in <span style={{ color: "rgba(255,255,255,0.55)" }}>{meta.label}</span>
            </span>
          </div>
        );
      })()}

      {/* Next → lesson step button */}
      <button
        onClick={onNext}
        disabled={!canGenerate || generating}
        className="w-full py-4 rounded-2xl font-semibold text-fs-body transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        style={
          canGenerate && !generating
            ? { background: "linear-gradient(90deg,#4fc3f7,#8B5CF6)", color: "#fff", boxShadow: "0 4px 28px rgba(79,195,247,0.3), 0 2px 8px rgba(139,92,246,0.3)" }
            : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.07)" }
        }
      >
        {generating ? (
          <>
            <span className="animate-spin text-fs-heading">✦</span>
            <span>Weaving your story…</span>
          </>
        ) : (
          <>
            <span>✨</span>
            <span>Next: Add a Lesson</span>
            <Icon name="forward" size={14} style={{ opacity: 0.6 }} />
          </>
        )}
      </button>
    </div>
  );
}

// ─── Studio 2 page ────────────────────────────────────────────────────────────

type StudioTab = "chat" | "step-by-step" | "lesson" | "script" | "producing" | "drama";

export default function Studio2Page() {
  const { isRTL, language } = useLanguage();
  const { user } = useAuth();
  const isAdmin = user?.email === ADMIN_EMAIL;
  const unsavedGuard = useUnsavedChanges();
  const router = useRouter();

  // ─── Active child profile ────────────────────────────────────────────────────
  const [activeChild, setActiveChild]       = useState<DBChildProfile | null>(null);
  const [chatLocked, setChatLocked]         = useState(false);

  // ─── Prompt tab state ───────────────────────────────────────────────────────
  const [promptText, setPromptText]         = useState("");
  const [generating, setGenerating]         = useState(false);
  const [generateError, setGenerateError]   = useState<string | null>(null);
  const [genStep, setGenStep]               = useState(0);
  const genStepTimer                        = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Script state ───────────────────────────────────────────────────────────
  const [scriptBlocks, setScriptBlocks]     = useState<ScriptBlock[]>([]);
  const [scenes, setScenes]                 = useState<StoryScene[]>([]);
  const [summary, setSummary]               = useState("");
  const [coverUrl, setCoverUrl]             = useState("");
  const [coverPrompt, setCoverPrompt]       = useState("");
  const [editingStoryId, setEditingStoryId] = useState<string | null>(null);
  const [forkedFromTitle, setForkedFromTitle] = useState<string | null>(null);
  const [durationMinutes, setDurationMinutes] = useState(3);
  const [voicePool, setVoicePool]           = useState<Voice[]>(PRESET_VOICE_POOL);
  const [loaded, setLoaded]                 = useState(false);
  // The story's actual content language — distinct from `language` (UI display
  // language above). They coincide right after generating a NEW story (it's
  // generated in whatever language the UI was set to at that moment), but can
  // diverge when editing an EXISTING story while the UI is set to something
  // else. Used to decide whether to show Hebrew EL voices, so it must reflect
  // the real story, not just whatever language the UI happens to show now.
  const [storyLang, setStoryLang]           = useState<string>(language);

  // ─── Lesson state ───────────────────────────────────────────────────────────
  const [lessons, setLessons]               = useState<string[]>([]);
  const [lessonImplementations, setLessonImplementations] = useState<{ lesson: string; implemented: boolean; how: string }[]>([]);

  // ─── Tab / view state ───────────────────────────────────────────────────────
  const searchParams = useSearchParams();
  const startOnPrompt = searchParams.get("start") === "prompt";
  const [activeTab, setActiveTab]           = useState<StudioTab>(startOnPrompt ? "step-by-step" : "chat");
  const [createMode, setCreateMode]         = useState<"chat" | "step-by-step">(startOnPrompt ? "step-by-step" : "chat");
  const [productionJobId, setProductionJobId] = useState<string | null>(null);
  const [completedJob, setCompletedJob]     = useState<Job | null>(null);
  const [isProducing, setIsProducing]       = useState(false);
  const [produceError, setProduceError]     = useState<string | null>(null);
  const [isFetchingCover, setIsFetchingCover] = useState(false);

  // ─── Content validation state ───────────────────────────────────────────────
  const [isValidating, setIsValidating]     = useState(false);
  const [totalExpectedBlocks, setTotalExpectedBlocks] = useState<number | undefined>(undefined);
  // Issues found by re-running the policy check (validate-script) after a
  // manual save — cleared at the start of every Save Version click so a
  // stale list never lingers from a previous check.
  const [saveValidationIssues, setSaveValidationIssues] = useState<string[]>([]);

  // ─── Director's Note state ──────────────────────────────────────────────────
  const [directorNote, setDirectorNote]     = useState("");
  const [isRevising, setIsRevising]         = useState(false);
  const [reviseError, setReviseError]       = useState<string | null>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  // ─── Character avatars (AI-generated, optional) ─────────────────────────────
  const [characterAvatars, setCharacterAvatars]           = useState<Record<string, string>>({});
  const [characterTypes, setCharacterTypes]               = useState<Record<string, CharacterType>>({});
  const [characterDescriptions, setCharacterDescriptions] = useState<Record<string, string>>({});
  const [characterProfiles, setCharacterProfiles]         = useState<Record<string, CharacterProfile>>({});

  // ─── Saves ──────────────────────────────────────────────────────────────────
  const [savesRefreshKey, setSavesRefreshKey] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveLabel, setSaveLabel] = useState<"idle" | "saving" | "saved">("idle");
  // hasScriptChanges: blocks/voices differ from the last PRODUCED audio —
  // cleared only by a successful production (Produce Audio button gate).
  const [hasScriptChanges, setHasScriptChanges] = useState(false);
  // hasUnsavedChanges: blocks/voices differ from what's persisted in the DB —
  // cleared by a successful save OR a successful production, since producing
  // also persists blocks (Save version button gate).
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  // Title/summary edits (admin-only) — tracked separately so editing just the
  // title/summary enables Save without needing an unrelated script edit resolved first.
  const [metaDirty, setMetaDirty] = useState(false);
  // Whether this (existing) story already has produced audio — read once at load
  // time from the draft. Drives whether Produce starts enabled or disabled.
  const [storyHasAudio, setStoryHasAudio] = useState(false);
  // Single entry point for "the script/voices changed" — keeps both dirty
  // flags in sync so Save and Produce never drift apart.
  const markScriptDirty = useCallback(() => {
    setHasScriptChanges(true);
    setHasUnsavedChanges(true);
  }, []);
  const cleanLessonsRef = useRef<string[]>([]);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keeps the raw base64 payload from the last cover generation so production
  // can reuse it even after coverUrl has been swapped to a CDN URL
  const coverBase64Ref = useRef<{ data: string; mimeType: string } | null>(null);

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

  useEffect(() => { fetchVoicePool(storyLang).then(setVoicePool); }, [storyLang]);

  // When a story ID becomes available for the first time and there's a pending
  // uploaded cover (base64), persist it to the DB immediately.
  useEffect(() => {
    if (!editingStoryId) return;
    const payload = coverBase64Ref.current;
    if (!payload || !coverUrl.startsWith("data:")) return;
    fetch(`/api/library/${editingStoryId}/cover`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mimeType: payload.mimeType, data: payload.data }),
    }).then(async (r) => {
      if (r.ok) {
        const { coverUrl: persistedUrl } = await r.json() as { coverUrl: string };
        setCoverUrl(persistedUrl);
      }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingStoryId]);

  // Mark dirty when lessons change after the clean snapshot
  useEffect(() => {
    if (!loaded || scriptBlocks.length === 0) return;
    const clean = cleanLessonsRef.current;
    const changed = lessons.length !== clean.length || lessons.some((l, i) => l !== clean[i]);
    if (changed) markScriptDirty();
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
      setForkedFromTitle(draft.forkedFromTitle ?? null);
      setStoryLang(draft.language ?? language);
      setStoryHasAudio(!!draft.audioUrl);
      const savedAvatars = draft.characterAvatars ?? {};
      const hasStale = Object.values(savedAvatars).some((u) => (u as string).includes("dicebear.com"));
      setCharacterAvatars(hasStale ? {} : savedAvatars);
      setCharacterTypes((draft.characterTypes ?? {}) as Record<string, CharacterType>);
      setCharacterProfiles(draft.characterProfiles ?? {});
      setStoryTitle(draft.storyTitle ?? "");
      // Migrate: support both old string `lesson` and new array `lessons`
      setLessons(draft.lessons ?? (draft.lesson ? [draft.lesson] : []));
      setLessonImplementations(draft.lessonImplementations ?? []);
      setScenes(draft.scenes ?? []);
      if (!startOnPrompt) setActiveTab("script");
    } else {
      setActiveTab(startOnPrompt ? "step-by-step" : "chat");
    }
    setLoaded(true);
  }, []);

  // Persist draft on change
  useEffect(() => {
    if (!loaded) return;
    writeDraft({ promptText, scriptBlocks, summary, coverUrl, coverPrompt, editingStoryId: editingStoryId ?? undefined, forkedFromTitle: forkedFromTitle ?? undefined, characterAvatars, characterTypes, characterProfiles, storyTitle, lessons, lessonImplementations, scenes, language: storyLang }, DRAFT_KEY);
  }, [promptText, scriptBlocks, summary, coverUrl, coverPrompt, editingStoryId, forkedFromTitle, characterAvatars, characterTypes, characterProfiles, storyTitle, lessons, lessonImplementations, scenes, storyLang, loaded]);

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

  // ─── Auto-switch to script tab whenever generation/validation is active ───────

  useEffect(() => {
    if (generating || isValidating) {
      setActiveTab("script");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generating, isValidating]);

  // ─── Cycle through generation step labels while generating ─────────────────

  const GEN_STEPS = [
    "Imagining your hero…",
    "Building the world…",
    "Writing the adventure…",
    "Planning the scenes…",
    "Adding sound effects…",
    "Polishing the story…",
    "Almost ready…",
  ];

  useEffect(() => {
    if (!generating) {
      setGenStep(0);
      if (genStepTimer.current) clearTimeout(genStepTimer.current);
      return;
    }
    const delays = [0, 3000, 7000, 11000, 15000, 19000, 23000];
    delays.forEach((d, i) => {
      genStepTimer.current = setTimeout(() => setGenStep(i), d);
    });
    return () => { if (genStepTimer.current) clearTimeout(genStepTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generating]);

  // ─── Shared: classify cast + assign bank avatars ────────────────────────────

  const resolveAndSetCharacterAvatars = useCallback(async (
    blocks: ScriptBlock[],
    summary: string,
    storyCharacters?: Record<string, CharacterProfile>,
  ) => {
    const uniqueChars = Array.from(new Set(
      blocks.filter((b) => b.characterName !== "SFX").map((b) => b.characterName)
    ));
    if (!uniqueChars.length) return;
    const bank = await fetchBankAvatars();

    // Set fast bank-lookup defaults immediately (visible before async avatar matching)
    const defaultTypes: Record<string, CharacterType> = {};
    const defaultAvatars: Record<string, string> = {};
    for (const name of uniqueChars) {
      const t: CharacterType = (storyCharacters?.[name]?.type as CharacterType) ?? (name === "Narrator" ? "narrator" : "adult");
      defaultTypes[name] = t;
      defaultAvatars[name] = resolveCharacterAvatar(name, t, bank, voicePool);
    }
    setCharacterTypes(defaultTypes);
    setCharacterAvatars(defaultAvatars);

    if (storyCharacters && Object.keys(storyCharacters).length > 0) {
      setCharacterProfiles(storyCharacters);
      // Store descriptions so produce-drama can use them for voice profiling
      const descs: Record<string, string> = {};
      for (const [name, info] of Object.entries(storyCharacters)) {
        if (info.visualDescription) descs[name] = info.visualDescription;
      }
      setCharacterDescriptions(descs);
      // Rich descriptions from story generation — generate avatar via Imagen ad-hoc
      await Promise.allSettled(
        uniqueChars
          .filter((name) => storyCharacters[name]?.visualDescription && name !== "Narrator")
          .map(async (name) => {
            const { type, visualDescription } = storyCharacters[name];
            try {
              const res = await fetch("/api/generate-avatar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ description: visualDescription, type }),
              });
              if (!res.ok) return;
              const { avatarUrl } = await res.json() as { avatarUrl: string | null };
              if (avatarUrl) {
                setCharacterAvatars((prev) => ({ ...prev, [name]: avatarUrl }));
                setCharacterTypes((prev) => ({ ...prev, [name]: type as CharacterType }));
              }
            } catch { /* keep bank fallback */ }
          })
      );
    } else {
      // Fallback: classify by character names + full script sample (draft restore / chat paths)
      const scriptSample = blocks
        .filter((b) => b.characterName !== "SFX")
        .slice(0, 40)
        .map((b) => `${b.characterName}: ${b.textPayload.replace(/\[.*?\]/g, "").trim()}`)
        .join("\n");
      fetch("/api/classify-characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characters: uniqueChars, summary, scriptSample }),
      }).then((r) => r.json()).then((profiles: Record<string, { type: string; visualDescription: string } | string>) => {
        const refined: Record<string, CharacterType> = {};
        const refinedAvatars: Record<string, string> = {};
        for (const [name, profile] of Object.entries(profiles)) {
          // Support both old string format and new {type, visualDescription} format
          const type = (typeof profile === "string" ? profile : profile.type) as CharacterType;
          const desc = typeof profile === "object" ? profile.visualDescription : undefined;
          refined[name] = type;
          refinedAvatars[name] = resolveCharacterAvatar(name, type, bank, voicePool);
          // If we got a visual description, generate a proper avatar instead of bank hash
          if (desc && name !== "Narrator") {
            fetch("/api/generate-avatar", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ description: desc, type }),
            }).then((r) => r.json()).then(({ avatarUrl }: { avatarUrl: string | null }) => {
              if (avatarUrl) {
                setCharacterAvatars((prev) => ({ ...prev, [name]: avatarUrl }));
                setCharacterTypes((prev) => ({ ...prev, [name]: type }));
              }
            }).catch(() => { /* keep bank fallback */ });
          }
        }
        setCharacterTypes(refined);
        setCharacterAvatars(refinedAvatars);
      }).catch(() => console.warn("[Avatars] classification failed, keeping defaults"));
    }
  }, [voicePool]);

  // Re-resolve avatars on draft restore when characterAvatars is empty (stale DiceBear cleared or never saved)
  const avatarRefreshFiredRef = useRef(false);
  useEffect(() => {
    if (!loaded || scriptBlocks.length === 0) return;
    if (avatarRefreshFiredRef.current) return;
    if (Object.keys(characterAvatars).length === 0) {
      avatarRefreshFiredRef.current = true;
      const savedProfiles = Object.keys(characterProfiles).length > 0 ? characterProfiles : undefined;
      void resolveAndSetCharacterAvatars(scriptBlocks, summary, savedProfiles);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, scriptBlocks, resolveAndSetCharacterAvatars]);

  // ─── Generate story ─────────────────────────────────────────────────────────

  const handleGenerate = useCallback(async (selectedLessons: string[]) => {
    if (!promptText.trim()) return;
    setLessons(selectedLessons);
    setGenerating(true);
    setGenerateError(null);
    setEditingStoryId(null);
    setForkedFromTitle(null);
    setStoryTitle("");
    setScriptBlocks([]);
    setSummary("");
    setCoverUrl("");
    setStoryHasAudio(false);
    // Navigate to Script tab immediately so the user sees progress in context
    setActiveTab("script");

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
      ...(activeChild?.avoid ? { avoid: activeChild.avoid } : {}),
    };

    try {
      const res  = await fetch("/api/generate-story", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      const rawBlocks = data.blocks as ScriptBlock[];
      const sm = data.summary ?? "";
      const cp = data.coverPrompt ?? "";
      const title = (data.title as string | undefined) ?? "";
      const impls = (data.lessonImplementations ?? []) as { lesson: string; implemented: boolean; how: string }[];
      const storyChars = (data.characters ?? {}) as Record<string, CharacterProfile>;
      const rawScenes = (data.scenes ?? []) as StoryScene[];

      // Story is ready — transition from "generating" to "validating"
      setSummary(sm);
      setCoverPrompt(cp);
      setStoryTitle(title);
      setStoryLang(language);
      setLessonImplementations(impls);
      setScenes(rawScenes);
      setHasScriptChanges(false);
      setHasUnsavedChanges(false);
      cleanLessonsRef.current = selectedLessons;
      setCharacterAvatars({});
      setCharacterTypes({});
      setCharacterDescriptions({});
      setTotalExpectedBlocks(rawBlocks.length);
      setGenerating(false);   // ← flip now so validating phase starts cleanly
      setIsValidating(true);
      if (cp) fetchCover(cp, sm);

      // Round 2 — policy check + auto-fix (validate-script)
      const childAge = activeChild?.age ?? 6;
      let policyBlocks = rawBlocks;
      try {
        const polRes = await fetch("/api/validate-script", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blocks: rawBlocks }),
        });
        const polData = await polRes.json();
        const validShape = Array.isArray(polData.blocks) &&
          polData.blocks.length === rawBlocks.length &&
          polData.blocks.every((b: unknown) =>
            typeof b === "object" && b !== null &&
            typeof (b as Record<string, unknown>).characterName === "string" &&
            typeof (b as Record<string, unknown>).textPayload === "string"
          );
        if (polRes.ok && validShape) {
          policyBlocks = polData.blocks as ScriptBlock[];
          if (!polData.ok && polData.issues?.length) {
            console.warn(`[Policy] Auto-fixed ${polData.issues.length} violation(s):`, polData.issues);
          } else {
            console.log("[Policy] Script passed policy check.");
          }
        } else if (!validShape && polData.blocks) {
          console.warn("[Policy] Gemini returned unexpected block shape — using raw script", polData.blocks?.[0]);
        }
      } catch (err) {
        console.warn("[Policy] Policy check failed, using raw script:", err);
      }

      // Round 2.5 — per-block age/content check (validate-blocks)
      let blocks: ScriptBlock[];
      try {
        const valRes = await fetch("/api/validate-blocks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blocks: policyBlocks, age: childAge, lessons: selectedLessons, summary: sm }),
        });
        const valData = await valRes.json();
        blocks = (valRes.ok && valData.blocks?.length) ? valData.blocks as ScriptBlock[] : policyBlocks;
        if (valData.changes > 0) console.log(`[Validation] Fixed ${valData.changes} block(s)`);
      } catch {
        blocks = policyBlocks; // fall back to policy-checked blocks on network error
      }

      // Stagger-reveal validated blocks one by one for progressive feel
      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        setTimeout(() => {
          setScriptBlocks((prev) => [...prev, { ...block, validated: true }]);
          if (i === blocks.length - 1) {
            setIsValidating(false);
            setTotalExpectedBlocks(undefined);
            writeDraft({ promptText, scriptBlocks: blocks, summary: sm, coverUrl: "", coverPrompt: cp, editingStoryId: undefined, forkedFromTitle: undefined, characterAvatars: {}, characterTypes: {}, storyTitle: title, lessons: selectedLessons, lessonImplementations: impls, scenes: rawScenes }, DRAFT_KEY);
          }
        }, i * 65);
      }

      void resolveAndSetCharacterAvatars(blocks, sm, storyChars);
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
      // The revision changed the script content, so it now differs from what's
      // saved/produced — mark dirty (not clean) so Save/Produce reflect that.
      markScriptDirty();
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
      markScriptDirty();
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
    // Clear any issues surfaced by a previous save's check — the list below
    // the script panel should only ever reflect the check that just ran.
    setSaveValidationIssues([]);
    try {
      const saves: Promise<unknown>[] = [];

      // Always save a script-saves version snapshot
      saves.push(
        fetch("/api/script-saves", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blocks: scriptBlocks, summary, coverUrl, coverPrompt, isAutosave: false, label: storyTitle || undefined }),
        })
      );

      // If this story exists in the library, also update it directly
      if (editingStoryId) {
        // Update script blocks (and title/summary) on the library entry
        saves.push(
          fetch(`/api/library/${editingStoryId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ blocks: scriptBlocks, title: storyTitle || undefined, summary: summary || undefined, scenes: scenes.length ? scenes : undefined, characterProfiles: Object.keys(characterProfiles).length ? characterProfiles : undefined }),
          })
        );

        // Upload new cover if one was generated but not yet persisted as a CDN URL
        const coverPayload = coverBase64Ref.current;
        const coverIsBase64 = coverUrl.startsWith("data:");
        if (coverPayload && coverIsBase64) {
          saves.push(
            fetch(`/api/library/${editingStoryId}/cover`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ mimeType: coverPayload.mimeType, data: coverPayload.data }),
            }).then(async (r) => {
              if (r.ok) {
                const { coverUrl: persistedUrl } = await r.json() as { coverUrl: string };
                setCoverUrl(`${persistedUrl}?t=${Date.now()}`);
              }
            })
          );
        }
      }

      await Promise.all(saves);
      setSavesRefreshKey((k) => k + 1);
      setSaveLabel("saved");
      setMetaDirty(false);
      setHasUnsavedChanges(false);
      setTimeout(() => setSaveLabel("idle"), 2500);
    } catch {
      setSaveLabel("idle");
    } finally {
      setIsSaving(false);
    }

    // Re-run the same policy check used at creation time, against what the
    // user just edited and saved. Unlike the creation-time pass, this does
    // NOT silently apply Gemini's rewrite — the user already chose this
    // wording deliberately; we only surface what it flagged so they can
    // decide whether to fix it themselves.
    setIsValidating(true);
    try {
      const res = await fetch("/api/validate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks: scriptBlocks }),
      });
      const data = await res.json();
      if (res.ok && !data.ok && Array.isArray(data.issues) && data.issues.length > 0) {
        setSaveValidationIssues(data.issues as string[]);
      }
    } catch {
      // Network/parse failure — say nothing rather than a false "all clear"
      // or a confusing error; the user can retry by saving again.
    } finally {
      setIsValidating(false);
    }
  }, [scriptBlocks, summary, coverUrl, coverPrompt, isSaving, editingStoryId, storyTitle]);

  // ─── Load a save into the studio ────────────────────────────────────────────

  const handleLoadSave = useCallback((save: ScriptSaveFull) => {
    setScriptBlocks(save.blocks);
    if (save.summary)     setSummary(save.summary);
    if (save.coverUrl)    setCoverUrl(save.coverUrl);
    if (save.coverPrompt) setCoverPrompt(save.coverPrompt);
    // Restoring an older snapshot almost certainly differs from what's
    // currently saved/produced — mark dirty so Save/Produce reflect that.
    markScriptDirty();
    cleanLessonsRef.current = [];
    const uniqueChars = Array.from(new Set(save.blocks.filter((b) => b.characterName !== "SFX").map((b) => b.characterName)));
    const defaultTypes: Record<string, CharacterType> = {};
    for (const name of uniqueChars) {
      defaultTypes[name] = name === "Narrator" ? "narrator" : "adult";
    }
    setCharacterTypes(defaultTypes);
    // Resolve avatars from bank (narrator gets narrator voice avatar)
    fetchBankAvatars().then((bank) => {
      const avatars: Record<string, string> = {};
      for (const name of uniqueChars) {
        avatars[name] = resolveCharacterAvatar(name, defaultTypes[name], bank, voicePool);
      }
      setCharacterAvatars(avatars);
    });
  }, [voicePool]);

  // ─── Avatar change (direct URL pick from bank) ───────────────────────────────

  const handleAvatarChange = useCallback((characterName: string, url: string, type: CharacterType) => {
    setCharacterAvatars((prev) => ({ ...prev, [characterName]: url }));
    setCharacterTypes((prev) => ({ ...prev, [characterName]: type }));
  }, []);

  // User-initiated block edits (text, SFX) — marks script dirty
  const handleBlocksChange = useCallback((blocks: ScriptBlock[]) => {
    setScriptBlocks(blocks);
    markScriptDirty();
  }, []);

  // Save a single block's updated text to the library DB immediately
  const handleSaveBlock = useCallback(async (_blockId: string) => {
    if (!editingStoryId) return;
    try {
      await fetch(`/api/library/${editingStoryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks: scriptBlocks }),
      });
      // The full current blocks array was just persisted — nothing left to save.
      setHasUnsavedChanges(false);
    } catch { /* silent — autosave will catch it */ }
  }, [editingStoryId, scriptBlocks]);

  const handleCharacterVoiceChange = useCallback((characterName: string, voiceId: string) => {
    setScriptBlocks((prev) =>
      prev.map((b) => b.characterName === characterName ? { ...b, assignedVoiceId: voiceId } : b)
    );
    markScriptDirty();
  }, []);

  // ─── Admin-only: title/summary editing ───────────────────────────────────────

  const handleTitleChange = useCallback((next: string) => {
    setStoryTitle(next);
    setMetaDirty(true);
  }, []);

  const handleSummaryChange = useCallback((next: string) => {
    setSummary(next);
    setMetaDirty(true);
  }, []);

  // ─── Admin-only: re-run nature-based voice assignment for every cast member ──

  const handleReassignCast = useCallback(() => {
    const assignFn = storyLang === "he" ? assignHebrewVoicesToCharacters : assignVoicesToCharacters;
    // heroName="" disables the hero-lock so every character is (re)cast by
    // nature — same approach as the admin "Reassign Cast Voices" tool.
    const voiceMap = assignFn(scriptBlocks, "", undefined, characterProfiles);
    setScriptBlocks((prev) => prev.map((b) => {
      if (b.characterName === "SFX") return b;
      const newVoice = voiceMap[b.characterName];
      return newVoice ? { ...b, assignedVoiceId: newVoice } : b;
    }));
    markScriptDirty();
  }, [scriptBlocks, characterProfiles, storyLang]);

  // ─── Fetch cover ─────────────────────────────────────────────────────────────

  const fetchCover = useCallback(async (prompt: string, storySummary?: string) => {
    if (!prompt) return;
    setIsFetchingCover(true);
    try {
      const res = await fetch("/api/generate-cover", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, summary: storySummary }) });
      const data = await res.json();
      if (res.ok && data.coverUrl) {
        setCoverUrl(data.coverUrl);
        // Cache base64 so production can reuse it even after coverUrl is swapped to a CDN URL
        const match = (data.coverUrl as string).match(/^data:([^;]+);base64,(.+)$/);
        if (match) coverBase64Ref.current = { mimeType: match[1], data: match[2] };
        // Auto-persist to Supabase when story already exists in library
        if (editingStoryId && match) {
          fetch(`/api/library/${editingStoryId}/cover`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mimeType: match[1], data: match[2] }),
          }).then(async (r) => {
            if (r.ok) {
              const { coverUrl: persistedUrl } = await r.json() as { coverUrl: string };
              // Append cache-buster so the browser doesn't serve the CDN's stale cached copy
              setCoverUrl(`${persistedUrl}?t=${Date.now()}`);
            }
            // If PATCH fails, the base64 in state is fine — production will re-upload
          }).catch(() => {});
        }
      } else {
        console.error("[fetchCover] API error:", data);
      }
    } finally {
      setIsFetchingCover(false);
    }
  }, [editingStoryId]);

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
      const activeChildId = typeof window !== "undefined" ? localStorage.getItem("ns-active-child-id") : null;
      const body: Record<string, unknown> = { blocks, durationMinutes: duration, narratorVoiceId: getNarratorVoiceId(), characterDescriptions, characterTypes, characterProfiles: Object.keys(characterProfiles).length ? characterProfiles : undefined, ...(activeChildId ? { childIds: [activeChildId] } : {}) };
      if (editingStoryId) {
        body.editingStoryId = editingStoryId;
        // Always force re-production when editing an existing story — the server-side
        // guard would otherwise return the old cached audio without reading the new blocks.
        // Per-element audio cache still avoids re-synthesizing unchanged lines.
        body.force = true;
      }
      if (force) body.force = true;
      if (summary) body.summary = summary;
      if (coverPrompt) body.coverPrompt = coverPrompt;
      // Prefer the ref (survives CDN URL swap); fall back to parsing coverUrl for backward compat
      const coverPayload = coverBase64Ref.current ?? (() => {
        const m = coverUrl.match(/^data:([^;]+);base64,(.+)$/);
        return m ? { mimeType: m[1], data: m[2] } : null;
      })();
      if (coverPayload) {
        body.coverImageMimeType = coverPayload.mimeType;
        body.coverImageData = coverPayload.data;
      } else if (coverUrl && !coverUrl.startsWith("data:")) {
        // Cover is a CDN URL (e.g. after save/reload) — pass it so the server can reuse without regenerating
        body.existingCoverUrl = coverUrl.split("?")[0]; // strip cache-buster
      }
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
    // After a brand-new story is produced, its storyId equals jobId (job.id).
    // Record it so any subsequent re-produce updates the same story entry
    // instead of creating a duplicate.
    setEditingStoryId((prev) => prev ?? job.id);
    // Producing persists blocks/title/summary to the DB (via addEntry) and now
    // reflects the current script/voices as audio — clear all dirty flags.
    setStoryHasAudio(true);
    setHasScriptChanges(false);
    setHasUnsavedChanges(false);
    setMetaDirty(false);
  }, []);

  const handleProductionError = useCallback((msg: string) => {
    setProduceError(msg);
    setIsProducing(false);
    setProductionJobId(null);
    setActiveTab("script");
  }, []);

  // ─── Derived dirty state — shared by the Produce/Save buttons and the
  // leave-without-saving guard below, so they never drift out of sync ────────
  const needsProduce = scriptBlocks.length > 0 && (!storyHasAudio || hasScriptChanges);
  const needsSave = scriptBlocks.length > 0 && (metaDirty || hasUnsavedChanges);
  const hasUnsavedWork = needsProduce || needsSave;

  // ─── Warn before leaving the screen with unsaved/unproduced work ───────────
  useEffect(() => {
    unsavedGuard.setGuard(
      hasUnsavedWork,
      "You have changes that haven't been saved or turned into audio yet. If you leave now, they'll be lost.",
    );
  }, [hasUnsavedWork, unsavedGuard]);

  // Best-effort coverage for tab close/refresh/typing a new URL — the browser
  // shows its own generic prompt here (text/buttons can't be customized), but
  // it's the only way to warn on non-in-app navigation.
  useEffect(() => {
    if (!hasUnsavedWork) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedWork]);

  // ─── Early returns ──────────────────────────────────────────────────────────

  if (!loaded) return null;


  if (activeTab === "producing" && productionJobId) {
    return (
      <div className="min-h-full" dir={isRTL ? "rtl" : "ltr"}>
        <div className="px-5 pt-12 pb-8">
          <div className="flex items-center mb-7">
            <button onClick={() => { setActiveTab("script"); setIsProducing(false); setProductionJobId(null); }}
              className="w-8 h-8 flex items-center justify-center text-white/50"><Icon name="back" size={18} /></button>
            <h1 className="flex-1 text-center text-fs-heading font-semibold text-white tracking-wide">{i18nT(language, "producingDrama")}…</h1>
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
            <button onClick={() => setActiveTab("script")} className="w-8 h-8 flex items-center justify-center text-white/50"><Icon name="back" size={18} /></button>
            <h1 className="flex-1 text-center text-fs-heading font-semibold text-white tracking-wide">{i18nT(language, "dramaReady")}</h1>
            <div className="w-8" />
          </div>
          <DramaPlayer job={completedJob} onGenerateAnother={() => { setActiveTab("script"); setCompletedJob(null); }} />
        </div>
      </div>
    );
  }

  // ─── Main tab shell ─────────────────────────────────────────────────────────

  const hasScript = scriptBlocks.length > 0 || isValidating || generating;
  const showTabBar = activeTab !== "lesson";
  const isOnCreateTab = activeTab === "chat" || activeTab === "step-by-step";

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
          <h1 className="flex-1 text-center text-fs-heading font-semibold text-white tracking-wide">🌟 {i18nT(language, "studioTitle")}</h1>
          <button
            onClick={() => setVersionsOpen(true)}
            className="relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl transition-all active:scale-95"
            style={savesCount > 0
              ? { background: "rgba(79,195,247,0.12)", border: "1px solid rgba(79,195,247,0.35)", color: "#4fc3f7" }
              : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.3)" }
            }
          >
            <Icon name="folder" size={15} />
            {savesCount > 0 && (
              <span className="text-fs-body font-bold leading-none">{savesCount}</span>
            )}
          </button>
        </div>

        {/* Child profile picker */}
        {showTabBar && (
          <ChildProfilePicker selected={activeChild} onChange={(p) => { setActiveChild(p); setChatLocked(false); }} disabled={chatLocked} />
        )}

        {/* Tab bar — hidden during lesson step */}
        {showTabBar && (
          <div className="flex mb-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            {/* CREATE tab */}
            <button
              onClick={() => setActiveTab(createMode)}
              className={`relative flex-1 pb-3 text-fs-body font-bold tracking-wider uppercase transition-colors ${isOnCreateTab ? "text-white" : "text-white/30"}`}
            >
              <span className="flex items-center justify-center gap-1.5">
                <span>✨</span>
                <span>{i18nT(language, "createTab" as never)}</span>
              </span>
              {isOnCreateTab && <span className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: "#4fc3f7" }} />}
            </button>
            {/* SCRIPT tab */}
            <button
              onClick={() => { if (hasScript) setActiveTab("script"); }}
              disabled={!hasScript}
              className={`relative flex-1 pb-3 text-fs-body font-bold tracking-wider uppercase transition-colors ${activeTab === "script" ? "text-white" : !hasScript ? "text-white/15 cursor-not-allowed" : "text-white/30"}`}
            >
              <span className="flex items-center justify-center gap-1.5">
                <span>📜</span>
                <span>{i18nT(language, "scriptTab")}</span>
                {hasScript && <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#4fc3f7" }} />}
              </span>
              {activeTab === "script" && <span className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: "#4fc3f7" }} />}
            </button>
          </div>
        )}

        {/* Segmented toggle — chat vs step-by-step, visible only on CREATE tab */}
        {showTabBar && isOnCreateTab && (
          <div className="flex gap-1.5 mb-6 p-1 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <button
              onClick={() => { setCreateMode("chat"); setActiveTab("chat"); }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-fs-body font-semibold transition-all active:scale-[0.97]"
              style={createMode === "chat"
                ? { background: "rgba(79,195,247,0.15)", border: "1px solid rgba(79,195,247,0.4)", color: "#4fc3f7" }
                : { color: "rgba(255,255,255,0.35)" }
              }
            >
              <span>💬</span>
              <span>{i18nT(language, "chatWithLuna" as never)}</span>
            </button>
            <button
              onClick={() => { setCreateMode("step-by-step"); setActiveTab("step-by-step"); }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-fs-body font-semibold transition-all active:scale-[0.97]"
              style={createMode === "step-by-step"
                ? { background: "rgba(79,195,247,0.15)", border: "1px solid rgba(79,195,247,0.4)", color: "#4fc3f7" }
                : { color: "rgba(255,255,255,0.35)" }
              }
            >
              <span>🧚</span>
              <span>{i18nT(language, "stepByStep" as never)}</span>
            </button>
          </div>
        )}

        {/* Forked copy banner */}
        {forkedFromTitle && !editingStoryId && (
          <div className="mb-4 px-4 py-2.5 rounded-2xl flex items-center gap-2 text-fs-body"
            style={{ background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.25)", color: "rgba(167,139,250,0.9)" }}>
            <span>📋</span>
            <span>Editing your copy of <strong>«{forkedFromTitle}»</strong> — the original won&apos;t be changed</span>
          </div>
        )}

        {/* Error banner */}
        {(generateError || produceError) && (
          <div className="mb-5 px-4 py-3 rounded-2xl text-fs-body leading-relaxed"
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
            onGenerating={() => {
              setScriptBlocks([]);
            }}
            onScriptReady={(draft, chatDuration) => {
              const rawBlocks = draft.scriptBlocks;
              setGenerating(false);
              setScriptBlocks([]);
              setSummary(draft.summary);
              if (chatDuration) setDurationMinutes(chatDuration);
              setCoverPrompt(draft.coverPrompt);
              setCoverUrl("");
              setStoryTitle(draft.storyTitle ?? "");
              setLessons([]);
              setLessonImplementations([]);
              setActiveTab("script");
              setTotalExpectedBlocks(rawBlocks.length);
              setIsValidating(true);
              if (draft.coverPrompt) fetchCover(draft.coverPrompt, draft.summary);
              const childAge = activeChild?.age ?? 6;
              fetch("/api/validate-blocks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ blocks: rawBlocks, age: childAge, lessons: [], summary: draft.summary }),
              })
                .then((r) => r.json())
                .then((valData) => {
                  const blocks: ScriptBlock[] = (valData.blocks?.length ? valData.blocks : rawBlocks);
                  void resolveAndSetCharacterAvatars(blocks, draft.summary);
                  blocks.forEach((block, i) => {
                    setTimeout(() => {
                      setScriptBlocks((prev) => [...prev, { ...block, validated: true }]);
                      if (i === blocks.length - 1) {
                        setIsValidating(false);
                        setTotalExpectedBlocks(undefined);
                        writeDraft({ ...draft, scriptBlocks: blocks, coverUrl: "" }, DRAFT_KEY);
                      }
                    }, i * 65);
                  });
                })
                .catch(() => {
                  // Fallback: show unvalidated blocks
                  void resolveAndSetCharacterAvatars(rawBlocks, draft.summary);
                  rawBlocks.forEach((block, i) => {
                    setTimeout(() => {
                      setScriptBlocks((prev) => [...prev, block]);
                      if (i === rawBlocks.length - 1) {
                        setIsValidating(false);
                        setTotalExpectedBlocks(undefined);
                        writeDraft({ ...draft, coverUrl: "" }, DRAFT_KEY);
                      }
                    }, i * 65);
                  });
                });
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
              childName={activeChild?.name}
              childAvatarUrl={activeChild?.avatar_emoji?.startsWith("http") ? activeChild.avatar_emoji : undefined}
              onGenerating={() => {
                setScriptBlocks([]);
              }}
              onComplete={({ blocks: rawBlocks, summary: sm, coverPrompt: cp, characters: fqChars, scenes: fqScenes }) => {
                setActiveTab("script");
                setSummary(sm);
                setCoverPrompt(cp);
                setCoverUrl("");
                setStoryTitle("");
                setStoryLang(language);
                setLessons([]);
                setLessonImplementations([]);
                setScenes(fqScenes ?? []);
                setCharacterAvatars({});
                setCharacterTypes({});
                setCharacterDescriptions({});
                setTotalExpectedBlocks(rawBlocks.length);
                setIsValidating(true);
                if (cp) fetchCover(cp, sm);
                const childAge = activeChild?.age ?? 6;
                fetch("/api/validate-blocks", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ blocks: rawBlocks, age: childAge, lessons: [], summary: sm }),
                })
                  .then((r) => r.json())
                  .then((valData) => {
                    const blocks: ScriptBlock[] = (valData.blocks?.length ? valData.blocks : rawBlocks);
                    void resolveAndSetCharacterAvatars(blocks, sm, fqChars);
                    blocks.forEach((block, i) => {
                      setTimeout(() => {
                        setScriptBlocks((prev) => [...prev, { ...block, validated: true }]);
                        if (i === blocks.length - 1) {
                          setIsValidating(false);
                          setTotalExpectedBlocks(undefined);
                          writeDraft({ promptText: "", scriptBlocks: blocks, summary: sm, coverUrl: "", coverPrompt: cp, lessons: [], lessonImplementations: [], scenes: fqScenes ?? [], language }, DRAFT_KEY);
                        }
                      }, i * 65);
                    });
                  })
                  .catch(() => {
                    void resolveAndSetCharacterAvatars(rawBlocks, sm, fqChars);
                    rawBlocks.forEach((block, i) => {
                      setTimeout(() => {
                        setScriptBlocks((prev) => [...prev, block]);
                        if (i === rawBlocks.length - 1) {
                          setIsValidating(false);
                          setTotalExpectedBlocks(undefined);
                          writeDraft({ promptText: "", scriptBlocks: rawBlocks, summary: sm, coverUrl: "", coverPrompt: cp, lessons: [], lessonImplementations: [], scenes: fqScenes ?? [] }, DRAFT_KEY);
                        }
                      }, i * 65);
                    });
                  });
              }}
            />
          </div>
        )}

        {/* Script tab */}
        {activeTab === "script" && hasScript && (
          <>

            {/* ── In-tab generating placeholder ────────────────────────────── */}
            {generating && (
              <div className="flex flex-col gap-3">
                {/* Hero card */}
                <div className="relative w-full rounded-3xl overflow-hidden flex flex-col items-center justify-center"
                  style={{ minHeight: 200, background: "radial-gradient(ellipse at 50% 60%, rgba(45,27,105,0.9) 0%, rgba(10,20,60,0.95) 55%, rgba(6,9,20,1) 100%)", border: "1px solid rgba(139,92,246,0.2)" }}>
                  {/* Glow halos */}
                  <div className="absolute w-48 h-48 rounded-full animate-pulse pointer-events-none"
                    style={{ background: "radial-gradient(circle, rgba(79,195,247,0.12) 0%, transparent 70%)", animationDuration: "2.4s" }} />
                  <div className="absolute w-32 h-32 rounded-full animate-pulse pointer-events-none"
                    style={{ background: "radial-gradient(circle, rgba(139,92,246,0.16) 0%, transparent 70%)", animationDuration: "1.8s", animationDelay: "0.6s" }} />
                  {/* Orbital ring */}
                  <div className="relative flex items-center justify-center mb-5">
                    <div className="absolute w-16 h-16 rounded-full animate-spin"
                      style={{ border: "2px solid transparent", borderTopColor: "rgba(79,195,247,0.7)", borderRightColor: "rgba(139,92,246,0.4)", animationDuration: "1.8s" }} />
                    <div className="absolute w-11 h-11 rounded-full animate-spin"
                      style={{ border: "1.5px solid transparent", borderBottomColor: "rgba(167,139,250,0.5)", animationDuration: "2.6s", animationDirection: "reverse" }} />
                    <span className="text-fs-title relative z-10">✨</span>
                  </div>
                  {/* Text */}
                  <p className="text-fs-body font-bold text-white/80 tracking-wide transition-all duration-500">{GEN_STEPS[genStep]}</p>
                  {lessons.length > 0 && (
                    <p className="text-fs-body mt-1.5" style={{ color: "rgba(139,92,246,0.75)" }}>
                      Weaving in {lessons.join(" · ")}
                    </p>
                  )}
                  {/* Step progress bar */}
                  <div className="flex gap-1.5 mt-4 items-center">
                    {GEN_STEPS.map((_, i) => (
                      <div key={i} className="rounded-full transition-all duration-500"
                        style={{
                          width: i === genStep ? 20 : 6,
                          height: 6,
                          background: i <= genStep ? "#4fc3f7" : "rgba(79,195,247,0.2)",
                        }} />
                    ))}
                  </div>
                </div>
                {/* Block skeletons */}
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="rounded-2xl overflow-hidden animate-pulse"
                    style={{ height: i % 3 === 2 ? 52 : 72, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)", animationDelay: `${i * 90}ms` }}>
                    <div className="flex items-center gap-3 px-4 h-full">
                      <div className="w-8 h-8 rounded-full flex-shrink-0" style={{ background: "rgba(255,255,255,0.05)" }} />
                      <div className="flex-1 flex flex-col gap-2">
                        <div className="h-2 rounded-full" style={{ width: `${30 + (i * 11) % 25}%`, background: "rgba(255,255,255,0.06)" }} />
                        <div className="h-2 rounded-full" style={{ width: `${55 + (i * 7) % 30}%`, background: "rgba(255,255,255,0.04)" }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Actual script once generation is done ────────────────────── */}
            {!generating && (<><ScriptTab
              blocks={scriptBlocks}
              voices={voicePool}
              storyLanguage={storyLang}
              onBlocksChange={handleBlocksChange}
              onProduce={handleProduce}
              isProducing={isProducing}
              summary={summary}
              title={storyTitle}
              isAdmin={isAdmin}
              onTitleChange={handleTitleChange}
              onSummaryChange={handleSummaryChange}
              coverUrl={coverUrl}
              isFetchingCover={isFetchingCover}
              onRegenerateCover={scriptBlocks.length > 0 ? () => { setCoverUrl(""); coverBase64Ref.current = null; fetchCover(coverPrompt || storyTitle || summary.slice(0, 200), summary); } : undefined}
              onUploadCover={scriptBlocks.length > 0 ? (file: File) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                  const dataUrl = e.target?.result as string;
                  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
                  if (!match) return;
                  coverBase64Ref.current = { mimeType: match[1], data: match[2] };
                  setCoverUrl(dataUrl);
                  if (editingStoryId) {
                    fetch(`/api/library/${editingStoryId}/cover`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ mimeType: match[1], data: match[2] }),
                    }).then(async (r) => {
                      if (r.ok) {
                        const { coverUrl: persistedUrl } = await r.json() as { coverUrl: string };
                        setCoverUrl(persistedUrl);
                      }
                    }).catch(() => {});
                  }
                };
                reader.readAsDataURL(file);
              } : undefined}
              durationMinutes={durationMinutes}
              onDurationChange={setDurationMinutes}
              hideDirectorsNote
              hideDurationPicker
              hideProduceButton
              studioMode
              characterAvatars={characterAvatars}
              totalExpectedBlocks={totalExpectedBlocks}
              scenes={scenes}
              storyId={editingStoryId ?? undefined}
              onSaveBlock={editingStoryId ? handleSaveBlock : undefined}
              belowCover={
                <>
                  <CharacterCards
                    blocks={scriptBlocks}
                    voicePool={voicePool}
                    storyLanguage={storyLang}
                    avatars={characterAvatars}
                    characterTypes={characterTypes}
                    onDirectCharacter={(_, instruction) => handleRevise(instruction)}
                    onAvatarChange={handleAvatarChange}
                    onVoiceChange={handleCharacterVoiceChange}
                    isAdmin={isAdmin}
                    onReassignCast={handleReassignCast}
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

            {/* Content check results — from re-validating the script against
                story-guidance.txt right after a manual save. Informational
                only: the save already persisted exactly what was written;
                this just flags anything worth a second look. */}
            {saveValidationIssues.length > 0 && (
              <div
                className="mt-2 mb-3 rounded-2xl p-4 flex flex-col gap-2"
                style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.25)" }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-fs-body">⚠️</span>
                  <span className="text-fs-body font-bold uppercase tracking-widest" style={{ color: "rgba(252,165,165,0.85)" }}>
                    Content check found {saveValidationIssues.length === 1 ? "an issue" : `${saveValidationIssues.length} issues`}
                  </span>
                  <button
                    onClick={() => setSaveValidationIssues([])}
                    className="ml-auto text-fs-body px-1"
                    style={{ color: "rgba(255,255,255,0.35)" }}
                    aria-label="Dismiss"
                  >
                    ✕
                  </button>
                </div>
                <ul className="flex flex-col gap-1.5">
                  {saveValidationIssues.map((issue, i) => (
                    <li key={i} className="text-fs-body leading-relaxed flex gap-1.5" style={{ color: "rgba(255,255,255,0.65)" }}>
                      <span style={{ color: "rgba(252,165,165,0.6)" }}>•</span>
                      <span>{issue}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Director's Note */}
            {(() => {
              const hasPending = directorNote.trim().length > 0;
              return (
              <div
                className="mt-2 mb-3 rounded-2xl p-4 flex flex-col gap-3"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-fs-body opacity-60">🎬</span>
                  <span className="text-fs-body font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>
                    {i18nT(language, "directorsNote" as never)}
                  </span>
                  {isRevising && (
                    <span className="ml-auto flex items-center gap-1.5 text-fs-body" style={{ color: "rgba(255,255,255,0.4)" }}>
                      <span className="w-3 h-3 border-2 rounded-full animate-spin" style={{ borderColor: "rgba(255,255,255,0.1)", borderTopColor: "rgba(255,255,255,0.5)" }} />
                      {i18nT(language, "revisingLabel" as never)}
                    </span>
                  )}
                  {hasPending && !isRevising && (
                    <button
                      onClick={() => setDirectorNote("")}
                      className="ml-auto text-fs-body font-medium transition-colors"
                      style={{ color: "rgba(255,255,255,0.25)" }}
                    >
                      <Icon name="restore" size={14} className="inline-block align-middle" /> {i18nT(language, "discardChanges" as never)}
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {[
                    { labelKey: "moreSleepy" as const,   instruction: "Make the whole story more sleepy and calming — softer language, slower pace, perfect for drifting off" },
                    { labelKey: "moreMagical" as const,   instruction: "Add more magic, wonder and enchantment throughout" },
                    { labelKey: "funnier" as const,        instruction: "Add playful humor and lightness throughout — make it fun and giggly for young children" },
                    { labelKey: "shorter" as const,        instruction: "Shorten the story — condense each scene to its essential moment while keeping the emotional arc" },
                    { labelKey: "moreDramatic" as const,  instruction: "Add more dramatic tension and emotional peaks" },
                    { labelKey: "cozier" as const,         instruction: "Make the story feel warmer, cozier and more comforting — like being tucked in on a cold night" },
                  ].map(({ labelKey, instruction }) => (
                    <button
                      key={labelKey}
                      disabled={isRevising}
                      onClick={() => handleRevise(instruction)}
                      className="text-fs-body px-3 py-1.5 rounded-full font-medium transition-all active:scale-95"
                      style={{
                        background: isRevising ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        color: isRevising ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.55)",
                      }}
                    >
                      {i18nT(language, labelKey)}
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
                    placeholder={i18nT(language, "directorsNotePlaceholder")}
                    className="flex-1 rounded-xl px-3 py-2.5 text-fs-body leading-relaxed outline-none resize-none text-white/70 placeholder-white/15 transition-colors"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}
                  />
                  <button
                    disabled={!directorNote.trim() || isRevising}
                    onClick={() => handleRevise(directorNote)}
                    className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-fs-body font-bold transition-all active:scale-95"
                    style={directorNote.trim() && !isRevising
                      ? { background: "rgba(79,195,247,0.15)", border: "1px solid rgba(79,195,247,0.35)", color: "#4fc3f7" }
                      : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.15)" }
                    }
                  ><Icon name="submit" size={14} /></button>
                </div>

                {reviseError && (
                  <p className="text-fs-body" style={{ color: "rgba(239,68,68,0.75)" }}>⚠ {reviseError}</p>
                )}
              </div>
              );
            })()}

            {/* Produce Audio — enabled when there's no audio yet, or once something
                that affects the audio (cast/voice or a speech/SFX block) changed. */}
            {(() => {
              const blocked = isProducing || !needsProduce || isValidating || generating || isFetchingCover;
              return (
                <button
                  onClick={() => !blocked && handleProduce(scriptBlocks, durationMinutes)}
                  disabled={blocked}
                  className="w-full py-4 rounded-full font-bold text-fs-body transition-all duration-200 active:scale-[0.97] flex items-center justify-center gap-2.5"
                  style={!blocked ? {
                    background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 55%, #0284c7 100%)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    color: "#fff",
                    boxShadow: "0 6px 36px rgba(109,40,217,0.45), 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.15)",
                    letterSpacing: "0.02em",
                  } : isProducing ? {
                    background: "linear-gradient(135deg, rgba(124,58,237,0.5) 0%, rgba(79,70,229,0.5) 55%, rgba(2,132,199,0.5) 100%)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "rgba(255,255,255,0.7)",
                  } : {
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    color: "rgba(255,255,255,0.2)",
                    cursor: "not-allowed",
                  }}
                >
                  {isProducing ? (
                    <>
                      <span className="animate-pulse-slow text-fs-heading leading-none">🎙️</span>
                      <span>{i18nT(language, "mixingAudio")}</span>
                    </>
                  ) : isValidating ? (
                    <>
                      <span className="w-4 h-4 rounded-full border-2 animate-spin flex-shrink-0"
                        style={{ borderColor: "rgba(255,255,255,0.15)", borderTopColor: "rgba(255,255,255,0.4)" }} />
                      <span>Checking content…</span>
                    </>
                  ) : (
                    <>
                      <span className="text-fs-heading leading-none">🎙️</span>
                      <span>{i18nT(language, "produceAudio")}</span>
                    </>
                  )}
                </button>
              );
            })()}

            {/* Save script version — enabled whenever anything about the story changed
                (title, summary, cast/voice, or a speech/SFX block). */}
            {(() => {
              const canSave = needsSave && !isProducing;
              return (
                <button
                  onClick={handleManualSave}
                  disabled={!canSave || isSaving || saveLabel === "saved"}
                  className="w-full mt-2.5 py-3.5 rounded-full text-fs-body font-semibold transition-all duration-200 active:scale-[0.97] flex items-center justify-center gap-2"
                  style={saveLabel === "saved" ? {
                    background: "rgba(16,185,129,0.12)",
                    border: "1.5px solid rgba(52,211,153,0.4)",
                    color: "#6ee7b7",
                    boxShadow: "0 0 20px rgba(16,185,129,0.15)",
                  } : canSave ? {
                    background: "linear-gradient(135deg, rgba(139,92,246,0.18) 0%, rgba(99,102,241,0.14) 100%)",
                    border: "1.5px solid rgba(167,139,250,0.45)",
                    color: "#d8b4fe",
                    boxShadow: "0 0 22px rgba(139,92,246,0.18), 0 4px 12px rgba(0,0,0,0.2)",
                  } : {
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    color: "rgba(255,255,255,0.18)",
                    cursor: "not-allowed",
                  }}
                >
                  {saveLabel === "saving" ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 rounded-full animate-spin" style={{ borderColor: "rgba(216,180,254,0.2)", borderTopColor: "#d8b4fe" }} />
                      {i18nT(language, "savingVersion")}
                    </>
                  ) : saveLabel === "saved" ? (
                    <><span className="text-fs-heading leading-none">✓</span> {i18nT(language, "savedVersion")}</>
                  ) : (
                    <><Icon name="save" size={14} /> Save version</>
                  )}
                </button>
              );
            })()}
          </>) /* end !generating */}
          </>
        )}
      </div>

      {/* Versions bottom sheet */}
      {versionsOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end"
          style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}
          onClick={() => setVersionsOpen(false)}
        >
          <div
            className="rounded-t-3xl mx-auto w-full flex flex-col"
            style={{
              background: "linear-gradient(180deg,rgba(12,18,40,1) 0%,rgba(7,10,22,1) 100%)",
              border: "1px solid rgba(255,255,255,0.09)",
              borderBottom: "none",
              maxWidth: 430,
              maxHeight: "72vh",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top accent bar */}
            <div className="h-0.5 rounded-t-3xl flex-shrink-0"
              style={{ background: "linear-gradient(90deg,#4fc3f7,#8B5CF6,#4fc3f7)" }} />

            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-9 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }} />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <Icon name="folder" size={16} />
                <span className="text-fs-body font-semibold tracking-wide" style={{ color: "rgba(255,255,255,0.75)" }}>Saved Versions</span>
                <span className="text-fs-body font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: "rgba(79,195,247,0.12)", border: "1px solid rgba(79,195,247,0.25)", color: "rgba(79,195,247,0.8)" }}>
                  {savesCount}
                </span>
              </div>
              <button
                onClick={() => setVersionsOpen(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center transition-all"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)" }}
              >
                <Icon name="close" size={12} />
              </button>
            </div>

            {/* Divider */}
            <div className="mx-5 flex-shrink-0" style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />

            {/* Scrollable list */}
            <div className="overflow-y-auto px-5 pt-3 pb-8 flex-1" style={{ scrollbarWidth: "none" }}>
              <ScriptBrowser
                onLoad={(save) => { handleLoadSave(save); setVersionsOpen(false); }}
                refreshKey={savesRefreshKey}
                forceExpanded
                onCount={setSavesCount}
                onClose={() => setVersionsOpen(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
