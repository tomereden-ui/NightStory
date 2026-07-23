"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { stripNamePrefix } from "@/utils/stripSoundCues";
import { readDraft, writeDraft } from "@/lib/draftStore";
import { useLanguage } from "@/context/LanguageContext";
import { useRouter, useSearchParams } from "next/navigation";
import ScriptTab from "@/components/studio/ScriptTab";
import StudioAudioBar from "@/components/studio/StudioAudioBar";
import ProductionProgress from "@/components/studio/ProductionProgress";
import LessonStep from "@/components/studio/LessonStep";
import LessonEditor from "@/components/studio/LessonEditor";
import { MOCK_USER } from "@/lib/mockData";
import { PRESET_VOICE_POOL, fetchVoicePool } from "@/lib/services/voiceCatalog";
import type { ScriptBlock, Voice, StoryScene, Language, MoralLesson } from "@/types";
import LanguageToggle from "@/components/ui/LanguageToggle";
import type { CharacterProfile } from "@/lib/libraryStore";
import type { GenerateStoryRequest } from "@/app/api/generate-story/route";
import type { Job } from "@/lib/jobs";
import type { ScriptSaveMeta, ScriptSaveFull } from "@/lib/scriptSaves";
import { FiveQuestionFlow, DRAFT_KEY as WIZARD_DRAFT_KEY } from "@/app/create/five-question/FiveQuestionFlow";
import { SCENE_CHARS } from "@/config/sceneCharacters";
import { LANGUAGE_META, t as i18nT } from "@/lib/i18n";
import ChildProfilePicker, { type DBChildProfile } from "@/components/studio/ChildProfilePicker";
import LunaChatPanel from "@/components/studio/LunaChatPanel";
import { LunaWorkingHero, LunaWorkingBanner } from "@/components/studio/LunaWorkingCard";
import VoicePicker from "@/components/studio/VoicePicker";
import { getNarratorVoiceId } from "@/lib/narratorPreference";
import { fetchBankAvatars, resolveCharacterAvatar, type CharacterType, type BankAvatar } from "@/lib/services/characterAvatars";
import Icon from "@/components/ui/Icon";
import { pickBestVoiceForCharacter } from "@/lib/services/voiceAssignment";
import { useLanguageMismatchGate } from "@/hooks/useLanguageMismatchGate";
import { detectScriptLanguage } from "@/lib/scriptLanguageCheck";

// ─── Draft key — kept as its original storage-key name; only the route/URL
// moved from /studio2 to /studio, this key was never user-visible ───────────
const DRAFT_KEY = "nightstory_studio2_draft_v1";

// Sticky override for the story-creation default language — set only when
// the user explicitly picks a language in one of the creation panels (Chat
// or Step-by-step). Absent this, new creation sessions default to whatever
// the app's own UI language currently is.
const STORY_LANG_OVERRIDE_KEY = "nightstory_story_lang_override";

// Remembers which Create sub-tab (Chat vs Step-by-step) the user was last
// on, so a plain nav tap into Studio returns to that instead of always
// resetting to Chat.
const CREATE_MODE_KEY = "nightstory_studio_create_mode";

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
  storyId,
  onLoad,
  refreshKey,
  forceExpanded = false,
  onCount,
  onClose,
}: {
  storyId: string | null;
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
    if (!storyId) { setSaves([]); onCount?.(0); return; }
    fetch(`/api/script-saves?storyId=${encodeURIComponent(storyId)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) { setSaves(d); onCount?.(d.length); } })
      .catch(() => {});
  }, [refreshKey, storyId]);

  if (saves.length === 0 || !storyId) return null;

  const handleLoad = async (id: string) => {
    setLoadingId(id);
    try {
      const res = await fetch(`/api/script-saves/${id}?storyId=${encodeURIComponent(storyId)}`, { cache: "no-store" });
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
      const res = await fetch(`/api/script-saves/${id}?storyId=${encodeURIComponent(storyId)}`, { method: "DELETE" });
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
    await Promise.allSettled(saves.map((s) => fetch(`/api/script-saves/${s.id}?storyId=${encodeURIComponent(storyId)}`, { method: "DELETE" })));
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
          <span className="text-white/48 text-fs-body">{expanded ? "↑" : "↓"}</span>
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
                <p className="text-fs-body" style={{ color: "rgba(255,255,255,0.45)" }}>
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
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.52)" }}
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
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.52)" }}>
            {clearing ? i18nT(language, "deleting" as Parameters<typeof i18nT>[1]) : i18nT(language, "deleteAllVersions" as Parameters<typeof i18nT>[1])}
          </button>
        </div>
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
  characterTypes,
  characterProfiles,
  onAvatarChange,
  onVoiceChange,
  storyLanguage,
  totalExpectedBlocks,
}: {
  blocks: ScriptBlock[];
  voicePool: Voice[];
  avatars: Record<string, string>;
  characterTypes: Record<string, CharacterType>;
  characterProfiles: Record<string, CharacterProfile>;
  onAvatarChange: (characterName: string, url: string, type: CharacterType) => void;
  onVoiceChange: (characterName: string, voiceId: string) => void;
  /** The story's actual content language — falls back to UI language if not provided. */
  storyLanguage?: string;
  /** Set (non-undefined) while the post-generation review pass is still
   *  staggering blocks into `blocks` — lets Cast show a loading placeholder
   *  instead of vanishing outright while there's nothing to extract yet. */
  totalExpectedBlocks?: number;
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

  if (cast.length === 0) {
    // Mid-reveal (blocks still staggering in after generation) — show a
    // loading placeholder rather than rendering nothing, which used to read
    // as "Cast disappeared" instead of "Cast is still loading".
    if (totalExpectedBlocks) {
      return (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-fs-body font-bold uppercase tracking-widest" style={{ color: "rgba(79,195,247,0.45)" }}>
              {i18nT(language, "castLabel")} <span style={{ fontStyle: "italic", fontWeight: 400, textTransform: "none" }}>({i18nT(language, "tapToEdit")})</span>
            </p>
          </div>
          <div className="flex gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="w-16 h-16 rounded-full flex-shrink-0 animate-pulse"
                style={{ background: "rgba(255,255,255,0.05)", animationDelay: `${i * 100}ms` }} />
            ))}
          </div>
        </div>
      );
    }
    return null;
  }

  const openMember = openCharacter ? cast.find((c) => c.characterName === openCharacter) : null;

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-fs-body font-bold uppercase tracking-widest" style={{ color: "rgba(79,195,247,0.45)" }}>
          {i18nT(language, "castLabel")} <span style={{ fontStyle: "italic", fontWeight: 400, textTransform: "none" }}>({i18nT(language, "tapToEdit")})</span>
        </p>
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
          characterProfile={characterProfiles[openCharacter]}
          otherAssignedVoiceIds={new Set(
            cast.filter((c) => c.characterName !== openCharacter && c.voice).map((c) => c.voice!.id)
          )}
          otherAssignedAvatarUrls={new Set(
            Object.entries(avatars).filter(([name, url]) => name !== openCharacter && url).map(([, url]) => url)
          )}
          onAvatarChange={(url, type) => onAvatarChange(openCharacter, url, type)}
          onVoiceChange={(voiceId) => onVoiceChange(openCharacter, voiceId)}
          onClose={() => setOpenCharacter(null)}
          storyLanguage={storyLanguage}
        />
      )}
    </div>
  );
}

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
              : { color: "rgba(255,255,255,0.48)", border: "1px solid transparent" }
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
          <p className="text-center py-6 text-fs-body" style={{ color: "rgba(255,255,255,0.40)" }}>{i18nT(language, "noAvatarsYet")}</p>
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
  characterProfile,
  otherAssignedVoiceIds,
  otherAssignedAvatarUrls,
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
  /** This character's nature (gender/voicePersona/type/visualDescription) — feeds Auto Assign's matching. */
  characterProfile?: CharacterProfile;
  /** Voice ids already assigned to OTHER characters in this story — Auto Assign avoids picking these when possible. */
  otherAssignedVoiceIds?: Set<string>;
  /** Avatar URLs already assigned to OTHER characters in this story — avatar Auto Assign avoids picking these when possible. */
  otherAssignedAvatarUrls?: Set<string>;
  onAvatarChange: (url: string, type: CharacterType) => void;
  onVoiceChange: (voiceId: string) => void;
  onClose: () => void;
  /** The story's actual content language — falls back to UI language if not provided. */
  storyLanguage?: string;
}) {
  const { language } = useLanguage();
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showVoicePicker, setShowVoicePicker]   = useState(false);
  const [avatarMatching, setAvatarMatching]     = useState(false);
  // Gemini translates the literal word "Narrator" into the story's own
  // language (e.g. "קריין" in Hebrew), so name checks alone miss it for any
  // non-English story — characterProfile/characterType survive translation
  // since they come from the "type" field, not the character's display name.
  const isNarrator = characterType === "narrator" || characterProfile?.type === "narrator"
    || characterName === "Narrator" || characterName === "קריין";

  const handleAutoAssign = () => {
    // Auto Assign is nature-based casting and must never touch the Narrator —
    // that voice comes exclusively from the user's configured default, or it
    // gets silently clobbered the moment someone hits this button.
    if (isNarrator) return;
    const bestId = pickBestVoiceForCharacter(characterProfile, storyLanguage ?? language, otherAssignedVoiceIds);
    if (bestId) {
      onVoiceChange(bestId);
      setShowVoicePicker(false);
    }
  };

  // Unlike voice Auto Assign (an instant local lookup against the static
  // preset catalog), avatar matching is an AI call against the avatar bank
  // (findBestAvatarForCharacter, same one produce-drama runs automatically
  // at generation time) — so this needs a network round trip and a loading
  // state.
  const handleAvatarAutoAssign = async () => {
    if (isNarrator || avatarMatching || !characterProfile) return;
    setAvatarMatching(true);
    try {
      const res = await fetch("/api/match-avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: characterProfile,
          excludeUrls: otherAssignedAvatarUrls ? Array.from(otherAssignedAvatarUrls) : undefined,
        }),
      });
      const data = await res.json() as { avatarUrl?: string | null };
      if (data.avatarUrl) {
        onAvatarChange(data.avatarUrl, characterType);
        setShowAvatarPicker(false);
      }
    } catch {
      // best-effort — the manual gallery picker below is always available
    } finally {
      setAvatarMatching(false);
    }
  };

  // Accent colours per section
  const avatarAccent = "#A78BFA"; // violet
  const voiceAccent  = "#4FC3F7"; // cyan

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
                  <span style={{ fontSize: "var(--fs-caption)", color: "rgba(255,255,255,0.55)" }}>🎙</span>
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
                {!isNarrator && (
                <button
                  onClick={handleAvatarAutoAssign}
                  disabled={avatarMatching}
                  className="w-full mb-2 py-2.5 rounded-xl text-fs-body font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 disabled:opacity-60"
                  style={{ background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.35)", color: avatarAccent }}
                  title="Match this character's nature (type/gender/age) to the best-fitting avatar"
                >
                  {avatarMatching ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 rounded-full animate-spin" style={{ borderColor: "rgba(167,139,250,0.25)", borderTopColor: avatarAccent }} />
                      Matching…
                    </>
                  ) : (
                    <>✨ Auto Assign</>
                  )}
                </button>
                )}
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
                {!isNarrator && (
                <button
                  onClick={handleAutoAssign}
                  className="w-full mb-2 py-2.5 rounded-xl text-fs-body font-semibold tracking-wide transition-all active:scale-[0.98]"
                  style={{ background: "rgba(79,195,247,0.08)", border: "1px solid rgba(79,195,247,0.28)", color: "#4fc3f7" }}
                  title="Match this character's nature (gender/style/age) to the best-fitting voice"
                >
                  Auto Assign
                </button>
                )}
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
  const [imgError, setImgError] = useState(false);

  useEffect(() => { setImgError(false); }, [avatarUrl]);

  const size = 64;
  const ringActive = "linear-gradient(135deg,#4fc3f7,#a78bfa)";
  const ringIdle = "linear-gradient(135deg,rgba(255,255,255,0.1),rgba(255,255,255,0.04))";
  const glowActive = "0 0 20px rgba(79,195,247,0.35), 0 0 36px rgba(167,139,250,0.2)";
  const accentColor = "rgba(79,195,247,0.8)";
  const showImage = !!avatarUrl && !imgError;

  return (
    <div className="flex-shrink-0 flex flex-col items-center gap-1.5" style={{ minWidth: 72 }}>
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
            {showImage ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={avatarUrl} alt={characterName} style={{ width:"100%", height:"100%", objectFit:"cover" }} onError={() => setImgError(true)} />
            ) : (
              // No real avatar yet (still generating) or it failed to load —
              // show initials instead of a generic stock/DiceBear avatar that
              // would just get swapped out a moment later.
              <div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center",
                background: "linear-gradient(135deg,rgba(30,80,120,0.5),rgba(60,20,120,0.5))" }}>
                <span style={{ fontSize: "var(--fs-title)", fontWeight: 900, color: accentColor }}>{characterName.charAt(0).toUpperCase()}</span>
              </div>
            )}
          </div>
        </div>
        <span className="text-fs-body font-bold uppercase tracking-widest text-center leading-tight truncate w-full"
          style={{ color: accentColor }}>
          {characterName}
        </span>
        {voice && (
          <span className="text-fs-body font-medium text-center truncate w-full" style={{ color: "rgba(255,255,255,0.6)" }}>{voice.name.split(" ")[0]}</span>
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

// Director's Note mood chips -- pre-vetted canned instructions, combined with
// any typed free text only at the moment "Update Script" is clicked.
const DIRECTOR_CHIPS = [
  { labelKey: "moreSleepy" as const,   icon: "moon" as const,     instruction: "Make the whole story more sleepy and calming — softer language, slower pace, perfect for drifting off" },
  { labelKey: "moreMagical" as const,  icon: "sparkles" as const, instruction: "Add more magic, wonder and enchantment throughout" },
  { labelKey: "funnier" as const,      icon: "smile" as const,    instruction: "Add playful humor and lightness throughout — make it fun and giggly for young children" },
  { labelKey: "shorter" as const,      icon: "scissors" as const, instruction: "Shorten the story — condense each scene to its essential moment while keeping the emotional arc" },
  { labelKey: "moreDramatic" as const, icon: "zap" as const,      instruction: "Add more dramatic tension and emotional peaks" },
  { labelKey: "cozier" as const,       icon: "heart" as const,    instruction: "Make the story feel warmer, cozier and more comforting — like being tucked in on a cold night" },
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
            <span className="text-fs-body" style={{ color: "rgba(255,255,255,0.40)" }}>{wordCount} words</span>
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
          <p className="text-fs-body font-semibold uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.40)" }}>
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
            <span className="text-fs-body" style={{ color: "rgba(255,255,255,0.52)" }}>
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
            : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.40)", border: "1px solid rgba(255,255,255,0.07)" }
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

type StudioTab = "chat" | "step-by-step" | "lesson" | "script" | "producing";

// Reduces a script down to just the fields that matter for "did the script or
// its cast's voices actually change" — text, who speaks it, which voice reads
// it, and the order. Anything else on a ScriptBlock (id, lessonHighlight,
// validated) is bookkeeping that can legitimately differ across two
// otherwise-identical scripts and must not trip a false "changed" reading.
function scriptSnapshot(blocks: ScriptBlock[]): string {
  return JSON.stringify(blocks.map((b) => ({
    n: b.characterName,
    t: b.textPayload,
    v: b.assignedVoiceId,
    o: b.blockOrder,
  })));
}

export default function Studio2Page() {
  const { isRTL, language } = useLanguage();
  const { checkLanguage, languageMismatchModal } = useLanguageMismatchGate();
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
  const [coverFocusX, setCoverFocusX]       = useState<number | undefined>(undefined);
  const [coverFocusY, setCoverFocusY]       = useState<number | undefined>(undefined);
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
  //
  // Default for a brand-new creation session: mirrors the app's own UI
  // language, unless the user has explicitly picked a different language in
  // one of the creation panels before -- that pick is sticky (persisted in
  // localStorage) and wins over the app language until changed again via the
  // same in-panel picker. See setStoryLangOverride below.
  const [storyLang, setStoryLang]           = useState<string>(language);
  // Tracks whether storyLang currently holds a sticky user pick (as opposed
  // to just the live app-language default) -- a ref because it must be
  // readable synchronously inside the effects below, before their own
  // setStoryLang call has triggered a re-render.
  const storyLangOverrideRef = useRef<string | null>(null);

  // Load a persisted sticky override once, on mount.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORY_LANG_OVERRIDE_KEY);
      if (saved) {
        storyLangOverrideRef.current = saved;
        setStoryLang(saved);
      }
    } catch { /* ignore */ }
  }, []);

  // Used by the in-panel language pickers (Chat + Step-by-step) only --
  // an explicit user choice there is sticky: persisted and preferred over
  // the app language for every future new creation session, until changed
  // again via one of those same pickers.
  const setStoryLangOverride = useCallback((lang: string) => {
    storyLangOverrideRef.current = lang;
    try { localStorage.setItem(STORY_LANG_OVERRIDE_KEY, lang); } catch { /* ignore */ }
    setStoryLang(lang);
    setLanguageExplicitlyChosen(true);
  }, []);
  // Whether the user has actually pressed one of the in-panel language
  // toggles for the CURRENT story attempt, as opposed to storyLang just
  // holding its default (the app's own UI language) or a sticky value
  // carried over from a PAST session's pick. That carried-over value is a
  // convenience pre-fill, not a decision made for this story — treating it
  // as one is exactly what caused a story to "auto-select" a language the
  // user never actually chose this time (see scriptLanguageCheck.ts). Reset
  // to false at the start of every new generation attempt (all three
  // journeys) so each one is judged fresh rather than inheriting an earlier
  // story's confirmation in the same session.
  const [languageExplicitlyChosen, setLanguageExplicitlyChosen] = useState(false);

  // Bumped to force-remount FiveQuestionFlow for a full reset (its own state
  // — step, answers, etc. — is internal, so a key change is the clean way to
  // clear it from the parent without duplicating its reset logic here).
  const [wizardResetKey, setWizardResetKey] = useState(0);
  const [wizardResetConfirm, setWizardResetConfirm] = useState(false);
  // Mirrors chatLocked's role for the Chat tab: locks the language selector
  // once the wizard has real progress, so switching languages mid-story
  // (which would leave earlier answers in the old language) isn't possible.
  const [wizardStarted, setWizardStarted]   = useState(false);
  const [scriptResetConfirm, setScriptResetConfirm] = useState(false);

  // Absent a sticky override, and before any new creation session has
  // actually started (no chat/wizard progress, no story generated yet),
  // the default keeps following the app's own UI language live -- e.g. if
  // the user changes it from the Profile screen. Once real progress exists
  // this intentionally stops (via the chatLocked/wizardStarted guards),
  // so it never retroactively changes the language of an in-progress or
  // already-generated story.
  useEffect(() => {
    if (storyLangOverrideRef.current) return;
    if (chatLocked || wizardStarted || scriptBlocks.length > 0) return;
    setStoryLang(language);
  }, [language, chatLocked, wizardStarted, scriptBlocks.length]);

  // ─── Lesson state ───────────────────────────────────────────────────────────
  const [lessons, setLessons]               = useState<string[]>([]);
  const [lessonImplementations, setLessonImplementations] = useState<{ lesson: string; implemented: boolean; how: string }[]>([]);
  // Gemini's own analysis of what's actually embedded in the current script —
  // distinct from lessonImplementations (which only reflects what happened at
  // the moment of generation/revision). Persisted to stories.moral_lessons.
  const [moralLessons, setMoralLessons]     = useState<MoralLesson[]>([]);
  const [analyzingLessons, setAnalyzingLessons] = useState(false);

  // languageOverride lets a caller pass a just-resolved language value
  // directly, rather than relying on the storyLang state closure -- needed
  // when setStoryLang(...) and this call happen in the same synchronous
  // effect, where the closure would still see the OLD storyLang (a state
  // update doesn't take effect until the next render).
  const analyzeLessons = useCallback(async (blocks: ScriptBlock[], storyId?: string | null, languageOverride?: string) => {
    if (!blocks.length) { setMoralLessons([]); return; }
    setAnalyzingLessons(true);
    try {
      const res = await fetch("/api/analyze-lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks, storyId: storyId ?? undefined, language: languageOverride ?? storyLang }),
      });
      if (!res.ok) return;
      const data = await res.json() as { lessons?: MoralLesson[] };
      setMoralLessons(data.lessons ?? []);
    } catch (err) {
      console.warn("[analyzeLessons] failed:", err);
    } finally {
      setAnalyzingLessons(false);
    }
  }, [storyLang]);

  // ─── Tab / view state ───────────────────────────────────────────────────────
  const searchParams = useSearchParams();
  const startOnPrompt = searchParams.get("start") === "prompt";
  // Explicit deep-link used by "continue editing this story" flows (library,
  // classics, the five-question wizard's hand-off) — they write a full
  // script draft immediately before navigating here and expect to land on
  // it. A plain nav tap into Studio carries no such param, so it falls
  // through to the remembered Create sub-tab instead.
  const requestedTab = searchParams.get("tab");
  const lastCreateMode = (): "chat" | "step-by-step" => {
    if (typeof window === "undefined") return "chat";
    const stored = localStorage.getItem(CREATE_MODE_KEY);
    return stored === "step-by-step" ? "step-by-step" : "chat";
  };
  const [activeTab, setActiveTab]           = useState<StudioTab>(startOnPrompt ? "step-by-step" : lastCreateMode());
  const [createMode, setCreateModeState]    = useState<"chat" | "step-by-step">(startOnPrompt ? "step-by-step" : lastCreateMode());
  const setCreateMode = useCallback((mode: "chat" | "step-by-step") => {
    setCreateModeState(mode);
    if (typeof window !== "undefined") localStorage.setItem(CREATE_MODE_KEY, mode);
  }, []);
  const [productionJobId, setProductionJobId] = useState<string | null>(null);
  const [completedJob, setCompletedJob]     = useState<Job | null>(null);
  const [isProducing, setIsProducing]       = useState(false);
  const [produceError, setProduceError]     = useState<string | null>(null);
  const [isFetchingCover, setIsFetchingCover] = useState(false);

  // ─── Content validation state ───────────────────────────────────────────────
  const [isValidating, setIsValidating]     = useState(false);
  // Which of the two validation rounds is actually running right now — shown
  // in a LunaWorkingBanner above the script so the wait reads as real
  // progress instead of an undifferentiated stall.
  const [validatingPhase, setValidatingPhase] = useState("");
  const [totalExpectedBlocks, setTotalExpectedBlocks] = useState<number | undefined>(undefined);
  // How long the most recent generation's raw Gemini script-writing step took
  // (ms) — reported by generate-story/five-question-story, captured here from
  // whichever generation path just produced the current script, and forwarded
  // to POST /api/library (→ markScriptDone) the moment the draft is first
  // saved. Undefined for a story reopened from an existing draft/library
  // entry rather than freshly generated this session.
  const [lastGenerationMs, setLastGenerationMs] = useState<number | undefined>(undefined);
  // Timed spans for the post-generation review rounds (policy check +
  // validate-blocks' content/grammar/Hebrew passes) that just ran for the
  // current script — same lifecycle as lastGenerationMs above (set at
  // generation-completion, forwarded to POST /api/library, undefined for a
  // reopened draft). Recorded client-side because this is the one place that
  // sees every round in order, across what are actually two separate API
  // routes called sequentially.
  const [lastValidationStages, setLastValidationStages] = useState<Record<string, { startMs: number; endMs: number; ms: number }> | undefined>(undefined);
  // Issues found by re-running the policy check (validate-script) after a
  // manual save — cleared at the start of every Update Version click so a
  // stale list never lingers from a previous check.
  const [saveValidationIssues, setSaveValidationIssues] = useState<string[]>([]);

  // ─── Director's Note state ──────────────────────────────────────────────────
  const [directorNoteExpanded, setDirectorNoteExpanded] = useState(false);
  const [directorNote, setDirectorNote]     = useState("");
  const [isRevising, setIsRevising]         = useState(false);
  const [reviseError, setReviseError]       = useState<string | null>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  // Mood chips are a pure multi-select toggle -- they never write into the
  // free-text note. Their canned instructions are combined with the typed
  // text (if any) only at the moment "Update Script" is clicked.
  const [selectedMoodChips, setSelectedMoodChips] = useState<Set<string>>(new Set());
  // A chip's canned instruction is pre-vetted and marked valid immediately.
  // Manually typed text needs an explicit "Check Wording" click (below) --
  // NOT a debounce-on-every-keystroke, which fired a real Gemini call on
  // every natural typing pause mid-sentence and could show a stale verdict
  // for a half-finished thought.
  const [directionValid, setDirectionValid]           = useState(false);
  const [checkingDirection, setCheckingDirection]     = useState(false);
  // Short, specific problems Gemini found -- unreasonable free text, a
  // contradiction between the free text and a selected chip, or selected
  // chips contradicting each other. Empty once the check passes clean.
  const [directionCheckIssues, setDirectionCheckIssues] = useState<string[]>([]);

  // Resets validation state whenever the note is cleared (Cancel, or a
  // successful Update Script which clears it on completion) so the next
  // thing typed always starts from a clean, unvalidated state.
  useEffect(() => {
    if (!directorNote.trim()) {
      setDirectionValid(false);
      setCheckingDirection(false);
      setDirectionCheckIssues([]);
    }
  }, [directorNote]);

  const handleDirectorNoteChange = (val: string) => {
    setDirectorNote(val);
    // Any edit invalidates a previous check -- needs a fresh "Check Wording"
    // click before Update Script can enable.
    setDirectionValid(false);
    setDirectionCheckIssues([]);
  };

  // Returns whether the note passed, so a caller (the "Ok" button) can chain
  // straight into applying it without a separate click once this resolves.
  const checkDirectorNote = async (): Promise<boolean> => {
    if (!directorNote.trim() || checkingDirection) return false;
    setCheckingDirection(true);
    setDirectionCheckIssues([]);
    try {
      const chipInstructions = DIRECTOR_CHIPS
        .filter((c) => selectedMoodChips.has(c.labelKey))
        .map((c) => c.instruction);
      const res = await fetch("/api/validate-direction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction: directorNote, chipInstructions, blocks: scriptBlocks, summary }),
      });
      const data = await res.json() as { reasonable?: boolean; issues?: string[] };
      const ok = data.reasonable !== false;
      setDirectionValid(ok);
      setDirectionCheckIssues(ok ? [] : (data.issues ?? []));
      return ok;
    } catch {
      setDirectionValid(false);
      setDirectionCheckIssues([]);
      return false;
    } finally {
      setCheckingDirection(false);
    }
  };

  const toggleMoodChip = (labelKey: string) => {
    setSelectedMoodChips((prev) => {
      const next = new Set(prev);
      if (next.has(labelKey)) next.delete(labelKey);
      else next.add(labelKey);
      return next;
    });
  };

  // ─── Shared "pending edit" state for the general Update Script button ──────
  // Director's Note's own pending state lives above (directorNote/
  // selectedMoodChips/directionValid); these two cover the other kinds of
  // pending edit the general button (placed just above Produce Audio,
  // outside any one panel) needs to react to.
  //
  // Lessons: LessonEditor's own "Apply" (in its expanded picker) no longer
  // fires the rewrite itself — it stashes the built instruction here instead,
  // and the shared Update Script action sends it. null = no pending lessons
  // change; a non-null string is both "there IS a pending change" and the
  // exact instruction to send for it.
  const [pendingLessonsInstruction, setPendingLessonsInstruction] = useState<string | null>(null);
  // Bumped on Cancel so LessonEditor resyncs its own internal displayed-
  // lessons/pending-removals state back from the last real analysis — it
  // can't detect "the parent just reverted `lessons`" any other way, since
  // its own resync effect only watches the moralLessons prop.
  const [lessonsCancelSignal, setLessonsCancelSignal] = useState(0);
  const handleCancelLessonsChange = useCallback(() => {
    setLessons(cleanLessonsRef.current);
    setPendingLessonsInstruction(null);
    setLessonsCancelSignal((n) => n + 1);
  }, []);

  // Cast: an avatar/voice reassignment needs no Gemini call at all (it never
  // touches script text), but per the same "review everything before
  // producing" rule as Director's Note and Lessons, it still counts toward
  // "there's a pending edit" and gets acknowledged (cleared) by the same
  // Update Script click rather than silently slipping through ungated.
  const [hasPendingCastChange, setHasPendingCastChange] = useState(false);

  // ─── Character avatars (AI-generated, optional) ─────────────────────────────
  const [characterAvatars, setCharacterAvatars]           = useState<Record<string, string>>({});
  const [characterTypes, setCharacterTypes]               = useState<Record<string, CharacterType>>({});
  const [characterDescriptions, setCharacterDescriptions] = useState<Record<string, string>>({});
  const [characterProfiles, setCharacterProfiles]         = useState<Record<string, CharacterProfile>>({});
  // The post-generation reveal (below) staggers scriptBlocks in one at a
  // time over several seconds, appending each block's ORIGINAL, generation-
  // time assignedVoiceId — if the user reassigns a character's voice via
  // Cast while blocks for that same character are still queued to arrive,
  // those later blocks silently kept their stale voice, since the append
  // closures captured the pre-reassignment block object at loop setup and
  // had no way to know a reassignment happened in the meantime. Every reveal
  // loop below now looks up this ref (written by handleCharacterVoiceChange)
  // before appending, so a mid-reveal reassignment applies to every block of
  // that character, not just the ones that had already landed. Reset at the
  // start of each new generation (the onGenerating handlers) so a previous
  // story's overrides can't leak into the next one.
  const pendingVoiceOverridesRef = useRef<Record<string, string>>({});

  // ─── Saves ──────────────────────────────────────────────────────────────────
  const [savesRefreshKey, setSavesRefreshKey] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveLabel, setSaveLabel] = useState<"idle" | "saving" | "saved">("idle");
  // hasScriptChanges / hasUnsavedChanges / metaDirty are NOT the direct
  // button gates -- they mark "a real edit happened" so the baseline-diffing
  // below (producedBaselineRef/savedBaselineRef, scriptChangedFromProduced/
  // scriptOrMetaChangedFromSaved) knows when to stop treating incoming
  // scriptBlocks/title/coverUrl changes as harmless (generation streaming in,
  // initial load) and start comparing against a frozen snapshot instead.
  // hasScriptChanges: a script/voice edit happened since the last production.
  const [hasScriptChanges, setHasScriptChanges] = useState(false);
  // hasUnsavedChanges: a script/voice edit happened since the last save.
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  // Title/cover edits (admin-only for title) — tracked separately so editing
  // just the title/cover doesn't require an unrelated script edit to enable
  // Update Version, and doesn't affect Produce Audio at all.
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
  // Guards the draft-creation POST below from firing twice for the same
  // script (e.g. React re-renders before the fetch resolves).
  const creatingDraftRef = useRef(false);
  // Mirrors editingStoryId but updated synchronously (not on React's render/
  // effect schedule) the instant the draft-save POST below resolves, so
  // handleProduce can read the freshest value right after awaiting
  // draftSaveInFlightRef without a stale-closure risk.
  const editingStoryIdRef = useRef<string | null>(null);
  // The in-flight draft-creation POST (see the effect below), so Produce can
  // be clicked immediately and just wait on this internally instead of the
  // button being disabled — see handleProduce.
  const draftSaveInFlightRef = useRef<Promise<void> | null>(null);
  // Catch-all sync for every OTHER setEditingStoryId call site (draft load,
  // clearing on new/forked story, the job-id fallback, etc.) — the draft-
  // save effect above additionally sets the ref synchronously itself for
  // the one race-sensitive path where handleProduce can't afford to wait
  // for this effect to run.
  useEffect(() => { editingStoryIdRef.current = editingStoryId; }, [editingStoryId]);
  // Keeps the raw base64 payload from the last cover generation so production
  // can reuse it even after coverUrl has been swapped to a CDN URL
  const coverBase64Ref = useRef<{ data: string; mimeType: string } | null>(null);

  // ─── Story title / versions sheet ───────────────────────────────────────────
  const [storyTitle, setStoryTitle] = useState("");
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [savesCount, setSavesCount] = useState(0);

  // ─── Change-from-original tracking for Produce/Update Version gating ──────
  // A boolean "something was touched" flag (hasScriptChanges etc. above) isn't
  // enough on its own -- editing text and then typing it back to exactly what
  // it was must NOT leave the button enabled. These refs snapshot the script
  // (and, for saving, title/cover too) at the last point that was considered
  // "clean" -- last load, last successful save, or last successful
  // production -- and the two booleans below compare the live state against
  // that snapshot on every render. The refs are kept sliding to match the
  // live state for as long as nothing has been marked dirty (covers initial
  // load, generation streaming in, and Start Over/loading a save that
  // explicitly re-dirties): the moment a real edit flips hasScriptChanges or
  // hasUnsavedChanges/metaDirty to true, the corresponding ref stops sliding
  // and freezes at the pre-edit snapshot, so the comparison below reflects
  // "different from the version currently produced/saved", not just "was
  // ever touched".
  const producedBaselineRef = useRef(scriptSnapshot([]));
  const savedBaselineRef = useRef({ title: "", coverUrl: "", script: scriptSnapshot([]) });

  useEffect(() => {
    if (!hasScriptChanges) producedBaselineRef.current = scriptSnapshot(scriptBlocks);
  }, [scriptBlocks, hasScriptChanges]);

  useEffect(() => {
    if (!hasUnsavedChanges && !metaDirty) {
      savedBaselineRef.current = { title: storyTitle, coverUrl, script: scriptSnapshot(scriptBlocks) };
    }
  }, [scriptBlocks, storyTitle, coverUrl, hasUnsavedChanges, metaDirty]);

  const scriptChangedFromProduced = scriptSnapshot(scriptBlocks) !== producedBaselineRef.current;
  const scriptOrMetaChangedFromSaved =
    storyTitle !== savedBaselineRef.current.title ||
    coverUrl !== savedBaselineRef.current.coverUrl ||
    scriptSnapshot(scriptBlocks) !== savedBaselineRef.current.script;

  useEffect(() => {
    if (!editingStoryId) { setSavesCount(0); return; }
    fetch(`/api/script-saves?storyId=${encodeURIComponent(editingStoryId)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setSavesCount(d.length); })
      .catch(() => {});
  }, [savesRefreshKey, editingStoryId]);

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
      setCoverFocusX(draft.coverFocusX);
      setCoverFocusY(draft.coverFocusY);
      setEditingStoryId(draft.editingStoryId ?? null);
      setForkedFromTitle(draft.forkedFromTitle ?? null);
      setLastGenerationMs(draft.generationMs);
      const needsLessonAnalysis = !draft.moralLessons?.length && draft.scriptBlocks.length > 0;
      if (draft.language) {
        setStoryLang(draft.language);
      } else {
        // Language was never persisted for this story (created before that
        // field existed, or a legacy/classic entry) -- detect it from the
        // real script instead of assuming this browser's own UI language,
        // which can easily be wrong for the story's actual content. Lesson
        // analysis (below) waits for this to resolve rather than firing with
        // a guessed language, which previously left "already embedded"
        // lessons permanently analyzed (and persisted) in the wrong language.
        setStoryLang(language);
        fetch("/api/detect-language", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blocks: draft.scriptBlocks }),
        })
          .then((r) => r.json())
          .then((d) => {
            if (d?.language) setStoryLang(d.language);
            if (needsLessonAnalysis) {
              void analyzeLessons(draft.scriptBlocks, draft.editingStoryId ?? null, d?.language ?? language);
            }
          })
          .catch(() => {
            if (needsLessonAnalysis) void analyzeLessons(draft.scriptBlocks, draft.editingStoryId ?? null, language);
          });
      }
      setStoryHasAudio(!!draft.audioUrl);
      // The sticky player is gated on completedJob, which otherwise only
      // ever gets set by handleProductionDone right after a fresh in-session
      // production -- reopening an already-produced story never touched it,
      // so the player silently never appeared no matter how much audio the
      // story actually had. Synthesize the same shape here so the player
      // shows immediately for a story that's already produced.
      if (draft.audioUrl) {
        setCompletedJob({
          id: draft.editingStoryId ?? "existing",
          status: "done",
          step: "",
          progress: 100,
          createdAt: Date.now(),
          audioUrl: draft.audioUrl,
          title: draft.storyTitle,
          durationSeconds: draft.durationSeconds ?? 0,
        });
      }
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
      if (draft.moralLessons?.length) {
        setMoralLessons(draft.moralLessons);
      } else if (needsLessonAnalysis && draft.language) {
        // Either a pre-feature story being opened for the first time, or a
        // fresh generation whose draft didn't carry an analysis yet — analyze
        // now so "already embedded" lessons show up whether or not the story
        // was ever explicitly created through the lesson picker. When the
        // language isn't known yet, the detect-language branch above fires
        // this once the real language resolves instead.
        void analyzeLessons(draft.scriptBlocks, draft.editingStoryId ?? null, draft.language);
      }
      // Only jump straight to the script when explicitly asked to (the
      // "continue editing this story" links) — a plain nav tap into Studio
      // should land on Create even if a script draft happens to be sitting
      // in storage from a previous session, per the initial-state default
      // above (lastCreateMode()).
      if (!startOnPrompt && requestedTab === "script") setActiveTab("script");
    }
    setLoaded(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist draft on change
  useEffect(() => {
    if (!loaded) return;
    writeDraft({ promptText, scriptBlocks, summary, coverUrl, coverPrompt, editingStoryId: editingStoryId ?? undefined, forkedFromTitle: forkedFromTitle ?? undefined, characterAvatars, characterTypes, characterProfiles, storyTitle, lessons, lessonImplementations, moralLessons, scenes, language: storyLang }, DRAFT_KEY);
  }, [promptText, scriptBlocks, summary, coverUrl, coverPrompt, editingStoryId, forkedFromTitle, characterAvatars, characterTypes, characterProfiles, storyTitle, lessons, lessonImplementations, moralLessons, scenes, storyLang, loaded]);

  // Persist a freshly-generated script to the database immediately, as a
  // draft (no audio yet) -- previously a script lived only in localStorage
  // until "Produce" ran, so a crash, a cleared cache, or a different device
  // meant losing it outright, and Saved Versions had nothing real to attach
  // to. Producing audio later reuses this same id (it becomes body.editingStoryId
  // in the produce-drama request) and upserts the row without isDraft, which
  // promotes it to a real, visible library entry.
  useEffect(() => {
    // totalExpectedBlocks is only set (non-undefined) while the staggered
    // block-reveal animation is still running (see onScriptReady/onComplete/
    // handleGenerate) — waiting for it to clear means this fires once with
    // the COMPLETE script, not on whichever partial scriptBlocks state
    // happened to exist right after the very first block rendered. Without
    // this, the very first render tick (scriptBlocks.length === 1) already
    // satisfies every other condition here, so the draft (and its
    // production_metrics 'script_done' row) got saved with just 1-2 blocks
    // instead of the real full script — an incomplete snapshot that then
    // never gets corrected unless the user manually clicks "Update Version."
    if (!loaded || scriptBlocks.length === 0 || totalExpectedBlocks !== undefined || editingStoryId || creatingDraftRef.current) return;
    creatingDraftRef.current = true;
    const activeChildId = typeof window !== "undefined" ? localStorage.getItem("ns-active-child-id") : null;
    // Stored so handleProduce can await this exact in-flight request instead
    // of racing it — the user can click Produce the instant the script
    // finishes, before this save has even resolved, without ending up with
    // a produce-drama request that has no editingStoryId and orphans the
    // production_metrics row this save is about to create (markScriptDone).
    draftSaveInFlightRef.current = fetch("/api/library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: storyTitle || undefined,
        summary,
        blocks: scriptBlocks,
        language: storyLang,
        scenes: scenes.length ? scenes : undefined,
        characterProfiles: Object.keys(characterProfiles).length ? characterProfiles : undefined,
        moralLessons: moralLessons.length ? moralLessons : undefined,
        childIds: activeChildId ? [activeChildId] : undefined,
        scriptGenerationMs: lastGenerationMs,
        validationStages: lastValidationStages,
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        // Updated synchronously (not via a React effect keyed on state) so
        // it's guaranteed fresh the instant this promise settles, with no
        // dependency on when React actually commits the setEditingStoryId
        // re-render.
        if (d?.id) { editingStoryIdRef.current = d.id; setEditingStoryId(d.id); }
      })
      .catch(() => {})
      .finally(() => { creatingDraftRef.current = false; draftSaveInFlightRef.current = null; });
  }, [loaded, scriptBlocks, totalExpectedBlocks, editingStoryId, storyTitle, summary, storyLang, scenes, characterProfiles, moralLessons, lastGenerationMs, lastValidationStages]);

  // No silent autosave here by design: the live story row (and the version
  // history) must only ever change when the user explicitly clicks Update
  // Version -- see handleManualSave. A background debounce that PATCHed the
  // canonical story on every keystroke used to run here; it was removed
  // because it "reproduced" a new version of the script the user hadn't
  // actually chosen to save yet.

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

    // Set bank-lookup defaults immediately only for characters we already
    // know won't get a real generated avatar (Narrator always uses the fixed
    // voice avatar; named characters with no description keep the bank pick
    // as their final avatar). Everyone else is left unset here — showing a
    // generic bank/DiceBear pick for a couple of seconds and then swapping
    // it for the real one reads as a bug, not a nice progressive reveal.
    const defaultTypes: Record<string, CharacterType> = {};
    const defaultAvatars: Record<string, string> = {};
    for (const name of uniqueChars) {
      const t: CharacterType = (storyCharacters?.[name]?.type as CharacterType) ?? (name === "Narrator" ? "narrator" : "adult");
      defaultTypes[name] = t;
      // A persisted avatarUrl on the profile is the story's canonical cast
      // art (matched at production time or via the admin retrofit) — reuse it
      // instead of re-running generation, so Studio and the story card always
      // show the same face for the same character.
      const persisted = storyCharacters?.[name]?.avatarUrl;
      const willRegenerate = name !== "Narrator" && t !== "narrator" && !persisted
        && (!storyCharacters || !!storyCharacters[name]?.visualDescription);
      if (!willRegenerate) defaultAvatars[name] = resolveCharacterAvatar(name, t, bank, voicePool, persisted);
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
      // Rich descriptions from story generation — generate avatar via Imagen
      // ad-hoc, but only for characters with no persisted avatarUrl yet (an
      // existing story opened in Studio already has its canonical cast art).
      await Promise.allSettled(
        uniqueChars
          .filter((name) => storyCharacters[name]?.visualDescription && !storyCharacters[name]?.avatarUrl
            && name !== "Narrator" && storyCharacters[name]?.type !== "narrator")
          .map(async (name) => {
            const { type, visualDescription } = storyCharacters[name];
            try {
              const res = await fetch("/api/generate-avatar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ description: visualDescription, type }),
              });
              const data = res.ok ? await res.json() as { avatarUrl: string | null } : null;
              const finalUrl = data?.avatarUrl || resolveCharacterAvatar(name, type as CharacterType, bank, voicePool);
              setCharacterAvatars((prev) => ({ ...prev, [name]: finalUrl }));
              setCharacterTypes((prev) => ({ ...prev, [name]: type as CharacterType }));
            } catch {
              setCharacterAvatars((prev) => ({ ...prev, [name]: resolveCharacterAvatar(name, type as CharacterType, bank, voicePool) }));
            }
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
          const willRegenerate = !!desc && name !== "Narrator";
          if (!willRegenerate) refinedAvatars[name] = resolveCharacterAvatar(name, type, bank, voicePool);
          // If we got a visual description, generate a proper avatar instead of
          // showing the bank pick first — leave this character's avatar unset
          // until the real one (or, on failure, the bank fallback) is ready.
          if (willRegenerate) {
            fetch("/api/generate-avatar", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ description: desc, type }),
            }).then((r) => r.json()).then(({ avatarUrl }: { avatarUrl: string | null }) => {
              setCharacterAvatars((prev) => ({ ...prev, [name]: avatarUrl || resolveCharacterAvatar(name, type, bank, voicePool) }));
              setCharacterTypes((prev) => ({ ...prev, [name]: type }));
            }).catch(() => {
              setCharacterAvatars((prev) => ({ ...prev, [name]: resolveCharacterAvatar(name, type, bank, voicePool) }));
            });
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
    // The sticky StudioAudioBar is gated on completedJob independently of
    // storyHasAudio — without clearing it here too, a previous story's
    // audio/title/duration keeps playing in the bar underneath this
    // brand-new, not-yet-produced script.
    setCompletedJob(null);
    setLastGenerationMs(undefined);
    setLastValidationStages(undefined);
    setLanguageExplicitlyChosen(false);
    pendingVoiceOverridesRef.current = {};
    // A brand-new story must never show a previous story's analyzed lessons
    // while its own script is still being generated/analyzed.
    setMoralLessons([]);
    setLessonImplementations([]);
    // Leftover Director's Note text/chips from a PREVIOUS story (typed but
    // never applied or cancelled) otherwise survives into this brand-new
    // story untouched, since nothing but Cancel/a successful apply ever
    // clears them — hasPendingDirectorNote would then read true for a
    // script the user hasn't touched at all, blocking Produce Audio from
    // the moment it's ready.
    setDirectorNote("");
    setSelectedMoodChips(new Set());
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
      narratorVoiceId: getNarratorVoiceId(),
      ...(selectedLessons.length > 0 ? { lessons: selectedLessons } : {}),
      ...(activeChild?.avoid ? { avoid: activeChild.avoid } : {}),
      gender: activeChild?.gender,
      favoriteThemes: activeChild?.favorite_themes,
      favoriteAnimals: activeChild?.favorite_animals,
      preferredFigures: activeChild?.preferred_figures,
      interests: activeChild?.interests,
      notes: activeChild?.notes,
    };

    try {
      // Quick, free, instant check of what the user actually typed. Only
      // surfaces a conflict dialog (languageMismatchModal below) when the
      // user has genuinely, explicitly picked a language THIS session — see
      // languageExplicitlyChosen's declaration for why a merely-inherited
      // default must never be treated as a real choice to defend. Otherwise
      // just trusts whatever script the text itself is actually written in,
      // falling back to the app's own language only when the text gives no
      // signal either way (empty, or ambiguous Latin-script content).
      body.language = languageExplicitlyChosen
        ? await checkLanguage(promptText, language)
        : (detectScriptLanguage(promptText) ?? language);
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
      setLastGenerationMs(typeof data.generationMs === "number" ? data.generationMs : undefined);

      // Story is ready — transition from "generating" to "validating"
      setSummary(sm);
      setCoverPrompt(cp);
      setStoryTitle(title);
      // The prompt tab sends this browser's own UI language, but Gemini
      // auto-detects and writes in whatever language the free-text prompt
      // itself is in when that's "en" (the default, which adds no explicit
      // override) -- so trust what the server says it actually generated
      // rather than assume the request's own language always held.
      const resolvedLanguage = (data.language as string | undefined) ?? language;
      setStoryLang(resolvedLanguage);
      setLessonImplementations(impls);
      setScenes(rawScenes);
      setHasScriptChanges(false);
      setHasUnsavedChanges(false);
      // metaDirty too — a title/cover edit on the PREVIOUS story otherwise
      // freezes savedBaselineRef at that story's snapshot, making this
      // brand-new script read as needsSave=true the instant it lands.
      setMetaDirty(false);
      cleanLessonsRef.current = selectedLessons;
      setCharacterAvatars({});
      setCharacterTypes({});
      setCharacterDescriptions({});
      setTotalExpectedBlocks(rawBlocks.length);
      setGenerating(false);   // ← flip now so validating phase starts cleanly
      setIsValidating(true);
      if (cp) fetchCover(cp, sm);

      // Post-generation review rounds are timed relative to this shared t0,
      // same span-shape ({startMs, endMs, ms}) ProductionTimer uses for the
      // later audio pipeline — merged into the same production_metrics row
      // (via markScriptDone below) so the whole script->audio timeline lives
      // in one place. Recorded here (client-side) since this is the only
      // vantage point that sees every round in order, across what are
      // actually two separate, sequential API routes.
      const validationT0 = Date.now();
      const validationStages: Record<string, { startMs: number; endMs: number; ms: number }> = {};

      // Round 2 — policy check + auto-fix (validate-script)
      setValidatingPhase("Luna is checking your story's guidelines…");
      const childAge = activeChild?.age ?? 6;
      let policyBlocks = rawBlocks;
      const policyStartMs = Date.now() - validationT0;
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
      } finally {
        const policyEndMs = Date.now() - validationT0;
        validationStages.policy_check = { startMs: policyStartMs, endMs: policyEndMs, ms: policyEndMs - policyStartMs };
      }

      // Round 2.5 — per-block age/content check (validate-blocks)
      setValidatingPhase("Luna is proofreading it…");
      let blocks: ScriptBlock[];
      const blocksStartMs = Date.now() - validationT0;
      try {
        const valRes = await fetch("/api/validate-blocks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blocks: policyBlocks, age: childAge, lessons: selectedLessons, summary: sm, language: resolvedLanguage }),
        });
        const valData = await valRes.json();
        blocks = (valRes.ok && valData.blocks?.length) ? valData.blocks as ScriptBlock[] : policyBlocks;
        if (valData.changes > 0) console.log(`[Validation] Fixed ${valData.changes} block(s)`);
        // Break down into its own content/grammar/Hebrew sub-passes using the
        // server-reported per-pass timings, nested sequentially within this
        // round's own window (they really do run one after another).
        let cursor = blocksStartMs;
        const t = valData.timings as { pass1Ms?: number; pass2Ms?: number; pass3Ms?: number } | undefined;
        if (typeof t?.pass1Ms === "number") {
          validationStages.content_review = { startMs: cursor, endMs: cursor + t.pass1Ms, ms: t.pass1Ms };
          cursor += t.pass1Ms;
        }
        if (typeof t?.pass2Ms === "number") {
          validationStages.grammar_review = { startMs: cursor, endMs: cursor + t.pass2Ms, ms: t.pass2Ms };
          cursor += t.pass2Ms;
        }
        if (typeof t?.pass3Ms === "number") {
          validationStages.hebrew_review = { startMs: cursor, endMs: cursor + t.pass3Ms, ms: t.pass3Ms };
          cursor += t.pass3Ms;
        }
      } catch {
        blocks = policyBlocks; // fall back to policy-checked blocks on network error
      } finally {
        // No granular sub-pass breakdown to fall back on (network error, or
        // no text blocks to review at all) — record the whole round as one
        // span rather than losing the time entirely.
        if (!validationStages.content_review) {
          const blocksEndMs = Date.now() - validationT0;
          validationStages.validate_blocks = { startMs: blocksStartMs, endMs: blocksEndMs, ms: blocksEndMs - blocksStartMs };
        }
      }
      setLastValidationStages(validationStages);

      // Strip a redundant "CharacterName:" prefix some generations bake into
      // the line itself — deterministic, safe, always a no-op if not present.
      blocks = blocks.map((b) => ({ ...b, textPayload: stripNamePrefix(b.characterName, b.textPayload) }));

      // Draft persistence and lessons analysis need only the final blocks
      // array, already known here — firing them now instead of inside the
      // last reveal timeout means the lessons call isn't delayed by the
      // reveal animation (~65ms × block count of pure theater).
      writeDraft({ promptText, scriptBlocks: blocks, summary: sm, coverUrl: "", coverPrompt: cp, editingStoryId: undefined, forkedFromTitle: undefined, characterAvatars: {}, characterTypes: {}, storyTitle: title, lessons: selectedLessons, lessonImplementations: impls, scenes: rawScenes }, DRAFT_KEY);
      void analyzeLessons(blocks, null, resolvedLanguage);

      // Stagger-reveal validated blocks one by one for progressive feel
      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        setTimeout(() => {
          setScriptBlocks((prev) => [...prev, { ...block, assignedVoiceId: pendingVoiceOverridesRef.current[block.characterName] ?? block.assignedVoiceId, validated: true }]);
          if (i === blocks.length - 1) {
            setIsValidating(false);
            setValidatingPhase("");
            setTotalExpectedBlocks(undefined);
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

  // Returns whether the revision actually succeeded — handleRevise/
  // handleLessonRewrite never throw (errors are caught and surfaced via
  // reviseError), so callers that need to gate further state changes on
  // success (the shared Update Script action below) can't rely on the
  // promise rejecting; they need this explicit signal instead.
  const handleRevise = useCallback(async (instruction: string, onSuccess?: () => void): Promise<boolean> => {
    if (!instruction.trim() || isRevising || scriptBlocks.length === 0) return false;
    setIsRevising(true);
    setReviseError(null);
    try {
      const res  = await fetch("/api/revise-script", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ blocks: scriptBlocks, instruction: instruction.trim(), storyId: editingStoryId ?? undefined }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Revision failed");
      const cleaned = (data.blocks as ScriptBlock[]).map((b) => ({ ...b, textPayload: stripNamePrefix(b.characterName, b.textPayload) }));
      setScriptBlocks(cleaned);
      setDirectorNote("");
      onSuccess?.();
      // The revision changed the script content, so it now differs from what's
      // saved/produced — mark dirty (not clean) so Save/Produce reflect that.
      markScriptDirty();
      return true;
    } catch (err: unknown) {
      setReviseError(err instanceof Error ? err.message : "Revision failed");
      return false;
    } finally {
      setIsRevising(false);
    }
  }, [scriptBlocks, isRevising, editingStoryId]);

  // ─── Rewrite with lessons (passes lessons so blocks get tagged) ─────────────

  const handleLessonRewrite = useCallback(async (instruction: string): Promise<boolean> => {
    if (!instruction.trim() || isRevising || scriptBlocks.length === 0) return false;
    setIsRevising(true);
    setReviseError(null);
    try {
      const res  = await fetch("/api/revise-script", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ blocks: scriptBlocks, instruction: instruction.trim(), lessons, storyId: editingStoryId ?? undefined }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Revision failed");
      const cleaned = (data.blocks as ScriptBlock[]).map((b) => ({ ...b, textPayload: stripNamePrefix(b.characterName, b.textPayload) }));
      setScriptBlocks(cleaned);
      if (data.lessonImplementations) setLessonImplementations(data.lessonImplementations);
      setDirectorNote("");
      markScriptDirty();
      cleanLessonsRef.current = lessons;
      void analyzeLessons(cleaned, editingStoryId);
      return true;
    } catch (err: unknown) {
      setReviseError(err instanceof Error ? err.message : "Revision failed");
      return false;
    } finally {
      setIsRevising(false);
    }
  }, [scriptBlocks, isRevising, lessons, editingStoryId, analyzeLessons]);

  // ─── Manual save ────────────────────────────────────────────────────────────

  const handleManualSave = useCallback(async () => {
    if (scriptBlocks.length === 0 || isSaving) return;
    setIsSaving(true);
    setSaveLabel("saving");
    // Capture before it's cleared below — the re-check after saving is a full
    // Gemini pass over the whole script, only worth paying for when the
    // script text/voices themselves actually differ from what was last
    // saved. A title/cover-only edit shouldn't spend a minute re-verifying
    // text that was already checked and hasn't moved.
    const scriptContentChanged = scriptSnapshot(scriptBlocks) !== savedBaselineRef.current.script;
    // Clear any issues surfaced by a previous save's check — the list below
    // the script panel should only ever reflect the check that just ran.
    setSaveValidationIssues([]);

    // Deterministically strip any redundant "CharacterName:" prefix baked
    // into a line's own text — a no-op unless it's actually present, safe
    // to always apply (unlike the AI content check below, which only ever
    // lists what it found rather than rewriting anything itself).
    const cleanedBlocks = scriptBlocks.map((b) => ({ ...b, textPayload: stripNamePrefix(b.characterName, b.textPayload) }));
    if (cleanedBlocks.some((b, i) => b.textPayload !== scriptBlocks[i].textPayload)) {
      setScriptBlocks(cleanedBlocks);
    }

    // fetch() only rejects on a network failure — a 403/500 response still
    // resolves normally, so every save below explicitly checks r.ok and
    // throws with the real reason. Without this, a failed PATCH (expired
    // session, permission error, bad payload) would show "Saved ✓" while
    // silently changing nothing — exactly indistinguishable from success.
    async function saveOrThrow(label: string, res: Response) {
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`${label} failed (${res.status})${body ? `: ${body.slice(0, 200)}` : ""}`);
      }
      return res;
    }

    try {
      const saves: Promise<unknown>[] = [];

      // If this story exists in the library, also update it directly
      if (editingStoryId) {
        // script-saves is scoped per-story, so this needs a real id to save into
        saves.push(
          fetch("/api/script-saves", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ storyId: editingStoryId, blocks: cleanedBlocks, summary, coverUrl, coverPrompt, isAutosave: false, label: storyTitle || undefined }),
          }).then((r) => saveOrThrow("Version snapshot", r))
        );

        // Update script blocks (and title/summary) on the library entry
        saves.push(
          fetch(`/api/library/${editingStoryId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ blocks: cleanedBlocks, title: storyTitle || undefined, summary: summary || undefined, scenes: scenes.length ? scenes : undefined, characterProfiles: Object.keys(characterProfiles).length ? characterProfiles : undefined, moralLessons: moralLessons.length ? moralLessons : undefined, coverFocusX: coverFocusX ?? null, coverFocusY: coverFocusY ?? null }),
          }).then((r) => saveOrThrow("Story update", r))
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
            }).then((r) => saveOrThrow("Cover upload", r)).then(async (r) => {
              const { coverUrl: persistedUrl } = await r.json() as { coverUrl: string };
              setCoverUrl(`${persistedUrl}?t=${Date.now()}`);
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
    } catch (err) {
      setSaveLabel("idle");
      setSaveValidationIssues([err instanceof Error ? err.message : "Save failed — please try again."]);
    } finally {
      setIsSaving(false);
    }

    // Re-run the same policy check used at creation time, against what the
    // user just edited and saved. Unlike the creation-time pass, this does
    // NOT silently apply Gemini's rewrite — the user already chose this
    // wording deliberately; we only surface what it flagged so they can
    // decide whether to fix it themselves. Skipped entirely for a
    // metadata-only save (title/summary/cover) — there's no new script text
    // to re-check, so this would just be a slow no-op spinner.
    if (!scriptContentChanged) return;
    setIsValidating(true);
    try {
      const res = await fetch("/api/validate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks: cleanedBlocks }),
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
  }, [scriptBlocks, summary, coverUrl, coverPrompt, isSaving, editingStoryId, storyTitle, moralLessons, characterProfiles, scenes, hasUnsavedChanges]);

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
    setHasPendingCastChange(true);
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
    // Covers blocks for this character that haven't landed yet (still mid
    // staggered-reveal) — see pendingVoiceOverridesRef's declaration above.
    pendingVoiceOverridesRef.current[characterName] = voiceId;
    markScriptDirty();
    setHasPendingCastChange(true);
  }, []);

  // ─── Story title editing ───────────────────────────────────────────────────

  const handleTitleChange = useCallback((next: string) => {
    setStoryTitle(next);
    setMetaDirty(true);
  }, []);

  // Erase the whole generated story and go back to a blank creation state —
  // same idea as the "Start over" reset on the Chat/Step-by-step tabs, just
  // applied to an already-generated script instead of an in-progress draft.
  const resetScript = useCallback(() => {
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    // Step-by-step's own state: without this, wizardStarted stays stuck true
    // from whatever SBS session produced the story just discarded, which
    // permanently hides the language toggle on every SBS attempt for the
    // rest of this browser session (it's gated on !wizardStarted — see the
    // Step-by-step tab below) — reads exactly like the toggle was removed.
    // Also clears the wizard's own separately-persisted draft/answers and
    // bumps wizardResetKey to force FiveQuestionFlow to remount fresh,
    // matching what its own internal "Start over" button already does.
    try { localStorage.removeItem(WIZARD_DRAFT_KEY); } catch { /* ignore */ }
    setWizardResetKey((k) => k + 1);
    setWizardStarted(false);
    setLanguageExplicitlyChosen(false);
    setScriptBlocks([]);
    setPromptText("");
    setSummary("");
    setCoverUrl("");
    setCoverPrompt("");
    setStoryTitle("");
    setLessons([]);
    setLessonImplementations([]);
    setMoralLessons([]);
    setScenes([]);
    setEditingStoryId(null);
    setForkedFromTitle(null);
    setCharacterAvatars({});
    setCharacterTypes({});
    setCharacterDescriptions({});
    setCharacterProfiles({});
    setStoryHasAudio(false);
    setHasScriptChanges(false);
    setHasUnsavedChanges(false);
    setMetaDirty(false);
    setCompletedJob(null);
    cleanLessonsRef.current = [];
    setScriptResetConfirm(false);
    // Land back on whichever Create sub-tab the segmented toggle (createMode)
    // already shows, not a hardcoded "chat" — otherwise "Start over" could
    // leave the toggle highlighting Step-by-step while Chat's content
    // rendered underneath it (createMode persists across sessions via
    // localStorage; this reset previously ignored it entirely).
    setActiveTab(startOnPrompt ? "step-by-step" : createMode);
  }, [startOnPrompt, createMode]);

  // ─── Fetch cover ─────────────────────────────────────────────────────────────

  // Fetches a cover into local state only -- never persists it. Used both for
  // a freshly-generated story's first cover (which must NOT count as a user
  // "change") and for an explicit regenerate (whose caller marks the change
  // itself, see onRegenerateCover below). Either way, persistence only ever
  // happens through Update Version.
  const fetchCover = useCallback(async (prompt: string, storySummary?: string) => {
    if (!prompt) return;
    setIsFetchingCover(true);
    try {
      const res = await fetch("/api/generate-cover", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, summary: storySummary }) });
      const data = await res.json();
      if (res.ok && data.coverUrl) {
        setCoverUrl(data.coverUrl);
        // Cache base64 so production/save can reuse it even after coverUrl is swapped to a CDN URL
        const match = (data.coverUrl as string).match(/^data:([^;]+);base64,(.+)$/);
        if (match) coverBase64Ref.current = { mimeType: match[1], data: match[2] };
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
      // The button is clickable the instant the script is ready — it doesn't
      // wait on the background draft-save (markScriptDone/production_metrics
      // 'script_done' row) to finish. Instead, wait on it right here, before
      // the actual produce-drama request goes out: without this, a fast
      // click can fire before editingStoryId exists yet, and produce-drama
      // falls back to a fresh jobId as the story id — silently orphaning the
      // 'script_done' row instead of completing it. editingStoryIdRef (not
      // the editingStoryId closure variable) is read below because it's
      // updated synchronously the moment the save resolves, not on React's
      // next render/effect tick.
      if (!editingStoryIdRef.current && draftSaveInFlightRef.current) {
        await draftSaveInFlightRef.current;
      }
      const activeChildId = typeof window !== "undefined" ? localStorage.getItem("ns-active-child-id") : null;
      const body: Record<string, unknown> = {
        blocks, durationMinutes: duration, narratorVoiceId: getNarratorVoiceId(), characterDescriptions, characterTypes,
        characterProfiles: Object.keys(characterProfiles).length ? characterProfiles : undefined,
        moralLessons: moralLessons.length ? moralLessons : undefined,
        ...(activeChildId ? { childIds: [activeChildId] } : {}),
        // Lets the server use the child's real photo for the hero's avatar
        // when the hero represents the child (name match), instead of a
        // generic avatar-bank illustration.
        ...(activeChild?.name ? { childName: activeChild.name } : {}),
        ...(activeChild?.avatar_emoji?.startsWith("http") ? { childAvatarUrl: activeChild.avatar_emoji } : {}),
      };
      if (editingStoryIdRef.current) {
        body.editingStoryId = editingStoryIdRef.current;
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
  }, [summary, coverPrompt, coverUrl, moralLessons, characterProfiles, characterDescriptions, characterTypes, activeChild]);

  const handleProductionDone = useCallback((job: Job) => {
    setCompletedJob(job);
    setIsProducing(false);
    // Stay on the script tab instead of navigating to a separate "Drama
    // Ready" screen -- the finished audio just shows up in the sticky
    // StudioAudioBar at the bottom instead.
    setActiveTab("script");
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
    setVersionsOpen(false);
    // produce-drama recomputes scenes with its own dedicated, more reliable
    // pass (see sceneGenerator.ts) and persists them regardless of whatever
    // this session had beforehand -- re-sync local state from the job so the
    // Scenes panel reflects that immediately instead of only after a reload.
    if (job.scenes?.length) setScenes(job.scenes);
  }, []);

  const handleProductionError = useCallback((msg: string) => {
    setProduceError(msg);
    setIsProducing(false);
    setProductionJobId(null);
    setActiveTab("script");
  }, []);

  // ─── Derived dirty state — drives the Produce/Update Version buttons ──────
  // Produce Audio is reachable immediately whenever there's no audio yet --
  // whether that's a script generated fresh in THIS session, or a saved
  // draft reopened from the Library (see Drafts tab / handleOpenDraft) that
  // was never produced at all. Forcing a throwaway edit before either kind
  // of first production would be a pointless hoop. Only an ALREADY-produced
  // story needs a real diff from what's currently live before Produce
  // re-enables, so re-producing without a change doesn't silently happen.
  const needsProduce = scriptBlocks.length > 0 && (!storyHasAudio || scriptChangedFromProduced);
  const needsSave = scriptBlocks.length > 0 && scriptOrMetaChangedFromSaved;

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

  // ─── Main tab shell ─────────────────────────────────────────────────────────

  const hasScript = scriptBlocks.length > 0 || isValidating || generating;
  const showTabBar = activeTab !== "lesson";
  const isOnCreateTab = activeTab === "chat" || activeTab === "step-by-step";

  return (
    <div className="min-h-full" dir={isRTL ? "rtl" : "ltr"}>
      {/* Extra bottom padding when the sticky StudioAudioBar is showing
          (reopening an already-produced story) -- otherwise its ~210px-tall
          fixed bar covers the last section of content (e.g. Director's
          Note) with no way to scroll past it. */}
      <div className="px-5 pt-12" style={{ paddingBottom: completedJob?.audioUrl ? 220 : 32 }}>
        {/* Header */}
        <div className="flex items-center mb-7">
          {activeTab === "lesson" ? (
            <div className="w-8" />
          ) : (
            <div className="w-8" />
          )}
          <h1 className="flex-1 text-center text-fs-heading font-semibold text-white tracking-wide">🌟 {i18nT(language, "studioTitle")}</h1>
          {/* Saved Versions is a safety net for scripts that don't exist
              anywhere else yet — once a story has produced audio, it's
              persisted and reachable from the Stories tab, so this global
              draft-snapshot list no longer applies to it. */}
          {!storyHasAudio ? (
            <button
              onClick={() => setVersionsOpen(true)}
              className="relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl transition-all active:scale-95"
              style={savesCount > 0
                ? { background: "rgba(79,195,247,0.12)", border: "1px solid rgba(79,195,247,0.35)", color: "#4fc3f7" }
                : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.52)" }
              }
            >
              <Icon name="folder" size={15} />
              {savesCount > 0 && (
                <span className="text-fs-body font-bold leading-none">{savesCount}</span>
              )}
            </button>
          ) : (
            <div className="w-8" />
          )}
        </div>

        {/* Child profile picker */}
        {showTabBar && (
          <ChildProfilePicker selected={activeChild} onChange={(p) => { setActiveChild(p); setChatLocked(false); }} disabled={chatLocked} />
        )}

        {/* Segmented toggle — chat vs step-by-step. Create and Script used to be
            peer tabs (with Script disabled until a script existed), but that
            framed Script as a destination you'd choose instead of one you
            arrive at — the app already auto-advances to it the moment
            generation finishes, and editing afterward happens in place
            (director's notes, moral lessons, regenerate), never by flipping
            back to this toggle. So there's no tab bar at all now: this
            segmented toggle IS the whole "Create" phase's header, and the
            screen simply becomes Script once one exists. The only way back
            to a blank Create is the explicit "Start over" inside Script
            (resetScript below), not a tab click. */}
        {showTabBar && isOnCreateTab && (
          <div className="flex gap-1.5 mb-6 p-1 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <button
              onClick={() => { setCreateMode("chat"); setActiveTab("chat"); }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-fs-body font-semibold transition-all active:scale-[0.97]"
              style={createMode === "chat"
                ? { background: "rgba(79,195,247,0.15)", border: "1px solid rgba(79,195,247,0.4)", color: "#4fc3f7" }
                : { color: "rgba(255,255,255,0.55)" }
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
                : { color: "rgba(255,255,255,0.55)" }
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
          <>
            <LunaChatPanel
            activeChild={activeChild}
            storyLanguage={storyLang}
            onStoryLanguageChange={setStoryLangOverride}
            languageExplicitlyChosen={languageExplicitlyChosen}
            onFirstMessage={() => setChatLocked(true)}
            onDiscard={() => setChatLocked(false)}
            onGenerating={() => {
              setScriptBlocks([]);
              setMoralLessons([]);
              setScenes([]);
              // A brand-new script from Chat must be produceable immediately —
              // without this, a stale storyHasAudio=true left over from a
              // previously produced story (never cleared by this path, unlike
              // Step-by-step's handleGenerate/resetScript) kept "Produce Audio"
              // disabled since needsProduce read the fresh script as already
              // having audio.
              setStoryHasAudio(false);
              // The sticky StudioAudioBar is gated on completedJob
              // independently of storyHasAudio — without clearing it here
              // too, a previous story's audio/title/duration keeps playing
              // in the bar underneath this brand-new, not-yet-produced script.
              setCompletedJob(null);
              // Also clear editingStoryId — otherwise the "persist a freshly-
              // generated script" effect (which only saves once editingStoryId
              // is null) stays permanently blocked by whatever story was open
              // before, so a second story generated in the same session (Chat
              // or Step-by-step) never got its own draft row / production_
              // metrics 'script_done' row at all.
              setEditingStoryId(null);
              setLastGenerationMs(undefined);
              setLastValidationStages(undefined);
              setLanguageExplicitlyChosen(false);
              setPendingLessonsInstruction(null);
              setHasPendingCastChange(false);
              setHasScriptChanges(false);
              setHasUnsavedChanges(false);
              setMetaDirty(false);
              pendingVoiceOverridesRef.current = {};
              // Leftover Director's Note text/chips from a previous story —
              // see the matching comment in the prompt-tab's handleGenerate.
              setDirectorNote("");
              setSelectedMoodChips(new Set());
            }}
            onScriptReady={(draft, chatDuration) => {
              const rawBlocks = draft.scriptBlocks;
              setGenerating(false);
              setScriptBlocks([]);
              setSummary(draft.summary);
              setLastGenerationMs(draft.generationMs);
              if (chatDuration) setDurationMinutes(chatDuration);
              setCoverPrompt(draft.coverPrompt);
              setCoverUrl("");
              setStoryTitle(draft.storyTitle ?? "");
              setLessons([]);
              // Without this, a stale cleanLessonsRef left over from a
              // PREVIOUS story in this session (prompt-tab generation sets
              // it to that story's own selectedLessons; a lesson rewrite
              // sets it too) mismatches this new, lesson-less story's
              // lessons=[] the moment the "mark dirty when lessons change"
              // effect sees them — freezing the produced/saved baselines
              // before the reveal even finishes and leaving Produce Audio
              // (and Update Version) incorrectly blocked from the start.
              cleanLessonsRef.current = [];
              setLessonImplementations([]);
              setMoralLessons([]);
              setScenes(draft.scenes ?? []);
              // A brand-new script starts clean — without these resets, a
              // dirty flag left over from a PREVIOUS story in this session
              // (any block/voice/title/cover edit) keeps savedBaselineRef/
              // producedBaselineRef frozen at that old story's snapshot, so
              // this new script instantly reads as needsSave=true and
              // Produce Audio arrives already blocked. The prompt tab's
              // handleGenerate has always done this; Chat and Step-by-step
              // never did.
              setHasScriptChanges(false);
              setHasUnsavedChanges(false);
              setMetaDirty(false);
              setActiveTab("script");
              setTotalExpectedBlocks(rawBlocks.length);
              setIsValidating(true);
              setValidatingPhase("Luna is proofreading it…");
              if (draft.coverPrompt) fetchCover(draft.coverPrompt, draft.summary);
              const childAge = activeChild?.age ?? 6;
              // Chat mode skips the whole-script policy check (validate-script)
              // that the prompt tab runs — only validate-blocks' per-block
              // review applies here. Timed the same way (span shape, merged
              // into production_metrics via markScriptDone) for consistency,
              // just without a policy_check entry.
              const validationT0 = Date.now();
              fetch("/api/validate-blocks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ blocks: rawBlocks, age: childAge, lessons: [], summary: draft.summary, language: draft.language ?? storyLang }),
              })
                .then((r) => r.json())
                .then((valData) => {
                  const blocks: ScriptBlock[] = (valData.blocks?.length ? valData.blocks : rawBlocks)
                    .map((b: ScriptBlock) => ({ ...b, textPayload: stripNamePrefix(b.characterName, b.textPayload) }));
                  void resolveAndSetCharacterAvatars(blocks, draft.summary);
                  // Fire now, not in the last reveal timeout — the lessons
                  // call shouldn't wait out the reveal animation.
                  writeDraft({ ...draft, scriptBlocks: blocks, coverUrl: "" }, DRAFT_KEY);
                  void analyzeLessons(blocks, null);
                  const validationStages: Record<string, { startMs: number; endMs: number; ms: number }> = {};
                  let cursor = 0;
                  const t = valData.timings as { pass1Ms?: number; pass2Ms?: number; pass3Ms?: number } | undefined;
                  if (typeof t?.pass1Ms === "number") { validationStages.content_review = { startMs: cursor, endMs: cursor + t.pass1Ms, ms: t.pass1Ms }; cursor += t.pass1Ms; }
                  if (typeof t?.pass2Ms === "number") { validationStages.grammar_review = { startMs: cursor, endMs: cursor + t.pass2Ms, ms: t.pass2Ms }; cursor += t.pass2Ms; }
                  if (typeof t?.pass3Ms === "number") { validationStages.hebrew_review = { startMs: cursor, endMs: cursor + t.pass3Ms, ms: t.pass3Ms }; cursor += t.pass3Ms; }
                  if (!validationStages.content_review) {
                    const endMs = Date.now() - validationT0;
                    validationStages.validate_blocks = { startMs: 0, endMs, ms: endMs };
                  }
                  setLastValidationStages(validationStages);
                  blocks.forEach((block, i) => {
                    setTimeout(() => {
                      setScriptBlocks((prev) => [...prev, { ...block, assignedVoiceId: pendingVoiceOverridesRef.current[block.characterName] ?? block.assignedVoiceId, validated: true }]);
                      if (i === blocks.length - 1) {
                        setIsValidating(false);
                        setValidatingPhase("");
                        setTotalExpectedBlocks(undefined);
                      }
                    }, i * 65);
                  });
                })
                .catch(() => {
                  // Fallback: show unvalidated blocks
                  void resolveAndSetCharacterAvatars(rawBlocks, draft.summary);
                  writeDraft({ ...draft, coverUrl: "" }, DRAFT_KEY);
                  void analyzeLessons(rawBlocks, null);
                  const endMs = Date.now() - validationT0;
                  setLastValidationStages({ validate_blocks: { startMs: 0, endMs, ms: endMs } });
                  rawBlocks.forEach((block, i) => {
                    setTimeout(() => {
                      setScriptBlocks((prev) => [...prev, { ...block, assignedVoiceId: pendingVoiceOverridesRef.current[block.characterName] ?? block.assignedVoiceId }]);
                      if (i === rawBlocks.length - 1) {
                        setIsValidating(false);
                        setValidatingPhase("");
                        setTotalExpectedBlocks(undefined);
                      }
                    }, i * 65);
                  });
                });
            }}
            />
          </>
        )}

        {/* Lesson step — interstitial between step-by-step and generation */}
        {activeTab === "lesson" && (
          <LessonStep
            onSelect={(selectedLessons) => handleGenerate(selectedLessons)}
            onBack={() => setActiveTab("step-by-step")}
            language={storyLang}
          />
        )}

        {/* Step-by-step tab */}
        {activeTab === "step-by-step" && (
          <div className="-mx-5">
            {/* Reset + language — same as Chat with Luna: local to this story,
                never touches the app's global UI language. */}
            <div className="flex items-center gap-2 px-5 mb-4">
              {wizardResetConfirm ? (
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-fs-body" style={{ color: "rgba(255,255,255,0.55)" }}>Start over?</span>
                  <button
                    onClick={() => {
                      try { localStorage.removeItem(WIZARD_DRAFT_KEY); } catch { /* ignore */ }
                      setWizardResetKey((k) => k + 1);
                      setWizardResetConfirm(false);
                      setWizardStarted(false);
                    }}
                    className="text-fs-body px-3 py-1.5 rounded-xl font-semibold transition-all active:scale-95"
                    style={{ background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.3)", color: "#f87171" }}
                  >
                    Yes, start over
                  </button>
                  <button
                    onClick={() => setWizardResetConfirm(false)}
                    className="text-fs-body px-3 py-1.5 rounded-xl font-semibold transition-all active:scale-95"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.55)" }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setWizardResetConfirm(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-fs-body font-semibold transition-all active:scale-95"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.45)" }}
                >
                  <span>↺</span>
                  <span>Start over</span>
                </button>
              )}
              {/* Switching mid-story would leave earlier answers in the old
                  language, so — same as Chat with Luna — the toggle is only
                  offered before the wizard has any real progress. */}
              {!wizardResetConfirm && !wizardStarted && (
                <LanguageToggle
                  value={storyLang as Language}
                  onLanguageChange={(lang) => {
                    try { localStorage.removeItem(WIZARD_DRAFT_KEY); } catch { /* ignore */ }
                    setStoryLangOverride(lang);
                    setWizardResetKey((k) => k + 1);
                    setWizardResetConfirm(false);
                    setWizardStarted(false);
                  }}
                />
              )}
            </div>
            <FiveQuestionFlow
              key={wizardResetKey}
              contentLanguage={storyLang}
              languageExplicitlyChosen={languageExplicitlyChosen}
              childName={activeChild?.name}
              childAvatarUrl={activeChild?.avatar_emoji?.startsWith("http") ? activeChild.avatar_emoji : undefined}
              childId={activeChild?.id}
              showInternalReset={false}
              onFirstAnswer={() => setWizardStarted(true)}
              onGenerating={() => {
                setScriptBlocks([]);
                setMoralLessons([]);
                // Same fix as Chat mode's onGenerating (see below) — a fresh
                // Step-by-step script must be produceable immediately, not
                // left disabled by a stale storyHasAudio=true carried over
                // from whatever story was open before.
                setStoryHasAudio(false);
                // The sticky StudioAudioBar is gated on completedJob
                // independently of storyHasAudio — same fix as Chat mode's
                // onGenerating.
                setCompletedJob(null);
                // Also clear editingStoryId — otherwise a second story
                // generated in the same session never gets its own draft
                // row / production_metrics 'script_done' row (see the
                // matching comment in Chat mode's onGenerating below).
                setEditingStoryId(null);
                setLastGenerationMs(undefined);
                setLastValidationStages(undefined);
                setLanguageExplicitlyChosen(false);
                setPendingLessonsInstruction(null);
                setHasPendingCastChange(false);
                setHasScriptChanges(false);
                setHasUnsavedChanges(false);
                setMetaDirty(false);
                pendingVoiceOverridesRef.current = {};
                // Leftover Director's Note text/chips from a previous story —
                // see the matching comment in the prompt-tab's handleGenerate.
                setDirectorNote("");
                setSelectedMoodChips(new Set());
              }}
              onComplete={({ blocks: rawBlocks, summary: sm, coverPrompt: cp, characters: fqChars, scenes: fqScenes, storyTitle: fqTitle, generationMs: fqGenerationMs }) => {
                setActiveTab("script");
                setSummary(sm);
                setCoverPrompt(cp);
                setCoverUrl("");
                setStoryTitle(fqTitle ?? "");
                setLastGenerationMs(fqGenerationMs);
                // storyLang deliberately left as-is — it already reflects
                // whatever language was chosen in this flow's own picker,
                // not necessarily the app's global UI language.
                setLessons([]);
                // See the matching comment in Chat mode's onScriptReady
                // above — without this, a stale cleanLessonsRef from a
                // previous story in this session incorrectly marks this
                // brand-new, lesson-less story dirty the moment it lands,
                // blocking Produce Audio from the start.
                cleanLessonsRef.current = [];
                setLessonImplementations([]);
                setMoralLessons([]);
                setScenes(fqScenes ?? []);
                // Same reset as Chat's onScriptReady above — a stale dirty
                // flag from a previous story otherwise freezes the saved/
                // produced baselines and blocks Produce Audio from the start.
                setHasScriptChanges(false);
                setHasUnsavedChanges(false);
                setMetaDirty(false);
                setCharacterAvatars({});
                setCharacterTypes({});
                setCharacterDescriptions({});
                setTotalExpectedBlocks(rawBlocks.length);
                setIsValidating(true);
                setValidatingPhase("Luna is proofreading it…");
                if (cp) fetchCover(cp, sm);
                const childAge = activeChild?.age ?? 6;
                // Step-by-step also skips validate-script's whole-script
                // policy check, same as Chat mode — see the matching comment
                // there.
                const validationT0 = Date.now();
                fetch("/api/validate-blocks", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ blocks: rawBlocks, age: childAge, lessons: [], summary: sm, language: storyLang }),
                })
                  .then((r) => r.json())
                  .then((valData) => {
                    const blocks: ScriptBlock[] = (valData.blocks?.length ? valData.blocks : rawBlocks)
                      .map((b: ScriptBlock) => ({ ...b, textPayload: stripNamePrefix(b.characterName, b.textPayload) }));
                    void resolveAndSetCharacterAvatars(blocks, sm, fqChars);
                    // Fire now, not in the last reveal timeout — the lessons
                    // call shouldn't wait out the reveal animation.
                    writeDraft({ promptText: "", scriptBlocks: blocks, summary: sm, coverUrl: "", coverPrompt: cp, lessons: [], lessonImplementations: [], scenes: fqScenes ?? [], language: storyLang, storyTitle: fqTitle }, DRAFT_KEY);
                    void analyzeLessons(blocks, null);
                    const validationStages: Record<string, { startMs: number; endMs: number; ms: number }> = {};
                    let cursor = 0;
                    const t = valData.timings as { pass1Ms?: number; pass2Ms?: number; pass3Ms?: number } | undefined;
                    if (typeof t?.pass1Ms === "number") { validationStages.content_review = { startMs: cursor, endMs: cursor + t.pass1Ms, ms: t.pass1Ms }; cursor += t.pass1Ms; }
                    if (typeof t?.pass2Ms === "number") { validationStages.grammar_review = { startMs: cursor, endMs: cursor + t.pass2Ms, ms: t.pass2Ms }; cursor += t.pass2Ms; }
                    if (typeof t?.pass3Ms === "number") { validationStages.hebrew_review = { startMs: cursor, endMs: cursor + t.pass3Ms, ms: t.pass3Ms }; cursor += t.pass3Ms; }
                    if (!validationStages.content_review) {
                      const endMs = Date.now() - validationT0;
                      validationStages.validate_blocks = { startMs: 0, endMs, ms: endMs };
                    }
                    setLastValidationStages(validationStages);
                    blocks.forEach((block, i) => {
                      setTimeout(() => {
                        setScriptBlocks((prev) => [...prev, { ...block, assignedVoiceId: pendingVoiceOverridesRef.current[block.characterName] ?? block.assignedVoiceId, validated: true }]);
                        if (i === blocks.length - 1) {
                          setIsValidating(false);
                          setValidatingPhase("");
                          setTotalExpectedBlocks(undefined);
                        }
                      }, i * 65);
                    });
                  })
                  .catch(() => {
                    void resolveAndSetCharacterAvatars(rawBlocks, sm, fqChars);
                    writeDraft({ promptText: "", scriptBlocks: rawBlocks, summary: sm, coverUrl: "", coverPrompt: cp, lessons: [], lessonImplementations: [], scenes: fqScenes ?? [] }, DRAFT_KEY);
                    void analyzeLessons(rawBlocks, null);
                    const endMs = Date.now() - validationT0;
                    setLastValidationStages({ validate_blocks: { startMs: 0, endMs, ms: endMs } });
                    rawBlocks.forEach((block, i) => {
                      setTimeout(() => {
                        setScriptBlocks((prev) => [...prev, { ...block, assignedVoiceId: pendingVoiceOverridesRef.current[block.characterName] ?? block.assignedVoiceId }]);
                        if (i === rawBlocks.length - 1) {
                          setIsValidating(false);
                          setValidatingPhase("");
                          setTotalExpectedBlocks(undefined);
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

            {/* Discard this script and go back to a blank Create — same "Start
                over" idea as the Chat/Step-by-step tabs, just applied to an
                already-generated script. With no tab bar to fall back to,
                this button is the only way back to creation from here. */}
            <div className="flex items-center gap-2 mb-4">
              {scriptResetConfirm ? (
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-fs-body" style={{ color: "rgba(255,255,255,0.55)" }}>Discard this script and start over?</span>
                  <button
                    onClick={resetScript}
                    className="text-fs-body px-3 py-1.5 rounded-xl font-semibold transition-all active:scale-95"
                    style={{ background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.3)", color: "#f87171" }}
                  >
                    Yes, start over
                  </button>
                  <button
                    onClick={() => setScriptResetConfirm(false)}
                    className="text-fs-body px-3 py-1.5 rounded-xl font-semibold transition-all active:scale-95"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.55)" }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setScriptResetConfirm(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-fs-body font-semibold transition-all active:scale-95"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)" }}
                >
                  <Icon name="submit" size={12} />
                  <span>Discard &amp; start over</span>
                </button>
              )}
            </div>

            {/* ── In-tab generating placeholder ────────────────────────────── */}
            {generating && (
              <div className="flex flex-col gap-3">
                <LunaWorkingHero
                  label={GEN_STEPS[genStep]}
                  subtitle={lessons.length > 0 ? `Weaving in ${lessons.join(" · ")}` : undefined}
                  steps={GEN_STEPS}
                  currentStep={genStep}
                />
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
            {!generating && (<>
              {isValidating && validatingPhase && <LunaWorkingBanner label={validatingPhase} />}

              {/* Result — everything below is what was generated: cover,
                  title, summary, Cast (quick-fix editable), scenes, and the
                  script itself. Heavier editing tools (moral lessons,
                  director's note) live further down under their own "Make
                  Changes" heading, so it's never ambiguous which part is the
                  finished result and which part is a control for changing
                  it. */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center justify-center rounded-xl flex-shrink-0"
                  style={{ width: 40, height: 40, background: "rgba(79,195,247,0.15)", border: "1px solid rgba(79,195,247,0.3)" }}>
                  <span style={{ fontSize: 20 }}>📖</span>
                </div>
                <p className="font-bold tracking-wide" style={{
                  fontSize: "var(--fs-subtitle)",
                  background: "linear-gradient(90deg, #4fc3f7, #a78bfa)",
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
                }}>
                  Your Story
                </p>
              </div>

              <ScriptTab
              blocks={scriptBlocks}
              voices={voicePool}
              storyLanguage={storyLang}
              onBlocksChange={handleBlocksChange}
              onProduce={handleProduce}
              isProducing={isProducing}
              summary={summary}
              title={storyTitle}
              onTitleChange={handleTitleChange}
              coverUrl={coverUrl}
              coverFocusX={coverFocusX}
              coverFocusY={coverFocusY}
              onSetCoverFocus={scriptBlocks.length > 0 ? (x: number, y: number) => {
                setCoverFocusX(x);
                setCoverFocusY(y);
                setMetaDirty(true);
              } : undefined}
              isFetchingCover={isFetchingCover}
              onRegenerateCover={scriptBlocks.length > 0 ? () => {
                setCoverUrl("");
                setCoverFocusX(undefined);
                setCoverFocusY(undefined);
                coverBase64Ref.current = null;
                setMetaDirty(true);
                fetchCover(coverPrompt || storyTitle || summary.slice(0, 200), summary);
              } : undefined}
              onUploadCover={scriptBlocks.length > 0 ? (file: File) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                  const dataUrl = e.target?.result as string;
                  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
                  if (!match) return;
                  coverBase64Ref.current = { mimeType: match[1], data: match[2] };
                  // Shown as a local preview only — persisted like any other
                  // change, the next time the user clicks Update Version.
                  setCoverUrl(dataUrl);
                  setCoverFocusX(undefined);
                  setCoverFocusY(undefined);
                  setMetaDirty(true);
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
              readOnlyScript
              belowCover={
                // Cast lives right next to the story's identity, not grouped
                // with the heavier editing tools below — it's a quick fix
                // (swap a voice/avatar), not "make changes to the story"
                // the way lessons/director's note are. Stays fully editable
                // here despite the script above it being read-only.
                <CharacterCards
                  blocks={scriptBlocks}
                  voicePool={voicePool}
                  storyLanguage={storyLang}
                  avatars={characterAvatars}
                  characterTypes={characterTypes}
                  characterProfiles={characterProfiles}
                  onAvatarChange={handleAvatarChange}
                  onVoiceChange={handleCharacterVoiceChange}
                  totalExpectedBlocks={totalExpectedBlocks}
                />
              }
              belowScript={
                // The whole "Make Changes" area (this header + LessonEditor,
                // plus Director's Note right after this component closes)
                // stays hidden until the script itself is fully generated
                // AND has passed the staggered validate-blocks pass — showing
                // editing tools for a script that's still being checked lets
                // the user "fix" content that's about to be silently
                // overwritten by the validation pass's own corrections.
                isValidating ? null : (
                <>
                  {/* Edit — everything from here down changes the story
                      above rather than being part of it: moral lessons and
                      (right after this component closes) Director's Note.
                      Grouped under one heading instead of being scattered
                      before and after the actual result. */}
                  <div className="flex items-center gap-3 mt-2 mb-4">
                    <div className="flex items-center justify-center rounded-xl flex-shrink-0"
                      style={{ width: 40, height: 40, background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.3)" }}>
                      <span style={{ fontSize: 20 }}>🛠️</span>
                    </div>
                    <p className="font-bold tracking-wide" style={{
                      fontSize: "var(--fs-subtitle)",
                      background: "linear-gradient(90deg, #a78bfa, #fbbf24)",
                      WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
                    }}>
                      Make Changes
                    </p>
                  </div>

                  <LessonEditor
                    lessons={lessons}
                    onChange={(next) => setLessons(next)}
                    onRewrite={(instruction) => setPendingLessonsInstruction(instruction)}
                    hasPendingChange={pendingLessonsInstruction !== null}
                    onCancelPending={handleCancelLessonsChange}
                    resetSignal={lessonsCancelSignal}
                    moralLessons={moralLessons}
                    analyzing={analyzingLessons}
                    storyLanguage={storyLang}
                  />
                </>
                )
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
                    style={{ color: "rgba(255,255,255,0.55)" }}
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

            {/* Director's Note — hidden while the script is still being
                validated, same rationale as the Make Changes/LessonEditor
                gate above: nothing here should look editable while the
                validate-blocks pass could still overwrite it. */}
            {!isValidating && (() => {
              const hasFreeText = directorNote.trim().length > 0;
              const hasChips = selectedMoodChips.size > 0;
              const hasPending = hasFreeText || hasChips;
              // Chips alone are pre-vetted and ready immediately; any typed
              // free text still needs an explicit "Check Wording" pass.
              const readyToApply = hasFreeText ? directionValid : hasChips;
              return (
              <div
                className="mb-4 rounded-2xl p-4 flex flex-col gap-3"
                style={{
                  background: "linear-gradient(160deg, rgba(139,92,246,0.09), rgba(79,195,247,0.05))",
                  border: "1px solid rgba(139,92,246,0.25)",
                  boxShadow: "0 0 28px rgba(139,92,246,0.06)",
                }}
              >
                {isRevising && <LunaWorkingBanner label={i18nT(language, "revisingLabel" as never)} />}
                <button
                  onClick={() => setDirectorNoteExpanded((v) => !v)}
                  className="flex items-center gap-2 w-full text-left"
                >
                  <Icon name="edit" size={16} style={{ color: "#E9D8FD" }} />
                  <span className="text-fs-heading font-bold tracking-tight" style={{ color: "#E9D8FD" }}>
                    {i18nT(language, "directorsNote" as never)}
                  </span>
                  <span
                    className="transition-transform"
                    style={{ color: "rgba(196,181,253,0.6)", fontSize: 22, marginLeft: "auto", transform: directorNoteExpanded ? "rotate(180deg)" : "rotate(0deg)" }}
                  >
                    ▾
                  </span>
                </button>

                {directorNoteExpanded && (
                <>
                {/* Quick chips are a pure multi-select toggle — clicking one
                    never writes into the note below. Their instructions are
                    pre-vetted, so any combination of selected chips is ready
                    to apply immediately; typed free text still needs an
                    explicit "Check Wording" click (see the primary button
                    below). */}
                <div className="flex flex-wrap gap-2">
                  {DIRECTOR_CHIPS.map(({ labelKey, icon }) => {
                    const isSelected = selectedMoodChips.has(labelKey);
                    return (
                      <button
                        key={labelKey}
                        disabled={isRevising}
                        onClick={() => toggleMoodChip(labelKey)}
                        className="flex items-center gap-1.5 text-fs-body px-3 py-1.5 rounded-full font-medium transition-all active:scale-95"
                        style={isSelected
                          ? { background: "rgba(79,195,247,0.16)", border: "1px solid rgba(79,195,247,0.45)", color: "#4fc3f7" }
                          : {
                              background: isRevising ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.06)",
                              border: "1px solid rgba(255,255,255,0.1)",
                              color: isRevising ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.68)",
                            }
                        }
                      >
                        <Icon name={icon} size={13} />
                        {i18nT(language, labelKey)}
                      </button>
                    );
                  })}
                </div>

                <textarea
                  ref={noteRef}
                  value={directorNote}
                  onChange={(e) => handleDirectorNoteChange(e.target.value)}
                  rows={2}
                  disabled={isRevising}
                  placeholder={i18nT(language, "directorsNotePlaceholder")}
                  className="w-full rounded-xl px-3 py-2.5 text-fs-body leading-relaxed outline-none resize-none text-white/70 placeholder-white/15 transition-colors"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}
                />

                {directionCheckIssues.length > 0 && (
                  <ul className="flex flex-col gap-1">
                    {directionCheckIssues.map((issue, i) => (
                      <li key={i} className="text-fs-body flex gap-1.5" style={{ color: "rgba(251,191,36,0.8)" }}>
                        <span>⚠</span>
                        <span>{issue}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Cancel discards the pending note/chips outright. For
                    chips-only (pre-vetted, nothing to check) there's nothing
                    left to click here — the row just shows Cancel plus a
                    settled "ready" indicator. Typed free text still needs an
                    explicit "Ok" wording check before it counts as ready.
                    Either way, applying the change is no longer done from
                    this panel — that's now the shared Update Script action
                    just above Produce Audio, which reacts to readyToApply
                    the same way this used to trigger handleRevise directly. */}
                <div className="flex gap-2">
                  <button
                    disabled={!hasPending || isRevising}
                    onClick={() => { setDirectorNote(""); setSelectedMoodChips(new Set()); }}
                    className="flex-1 py-2.5 rounded-xl text-fs-body font-medium transition-all active:scale-[0.98] disabled:opacity-40"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)" }}
                  >
                    {i18nT(language, "cancel")}
                  </button>
                  {!hasFreeText && readyToApply ? (
                    <div
                      className="flex-1 py-2.5 rounded-xl text-fs-body font-semibold text-center"
                      style={{ background: "rgba(79,195,247,0.08)", border: "1px solid rgba(79,195,247,0.25)", color: "#4fc3f7" }}
                    >
                      ✓ Ready
                    </div>
                  ) : (
                    <button
                      disabled={!hasPending || isRevising || checkingDirection || directionValid}
                      onClick={async () => { await checkDirectorNote(); }}
                      className="flex-1 py-2.5 rounded-xl text-fs-body font-semibold transition-all active:scale-[0.98] disabled:opacity-40 flex items-center justify-center gap-1.5"
                      style={hasPending && !isRevising && !checkingDirection && !directionValid
                        ? { background: "rgba(79,195,247,0.15)", border: "1px solid rgba(79,195,247,0.35)", color: "#4fc3f7" }
                        : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.48)" }
                      }
                    >
                      {checkingDirection && (
                        <span className="w-3 h-3 border-2 rounded-full animate-spin flex-shrink-0" style={{ borderColor: "rgba(255,255,255,0.15)", borderTopColor: "rgba(255,255,255,0.6)" }} />
                      )}
                      {checkingDirection ? i18nT(language, "checkingDirection" as never) : directionValid ? "✓ Checked" : "Ok"}
                    </button>
                  )}
                </div>

                {reviseError && (
                  <p className="text-fs-body" style={{ color: "rgba(239,68,68,0.75)" }}>⚠ {reviseError}</p>
                )}
                </>
                )}
              </div>
              );
            })()}

            {/* Update Script — the single, general "apply everything
                pending" action for the whole Make Changes area (Director's
                Note, Lessons, and cast avatar/voice reassignment), placed
                here rather than inside any one panel so it can react to all
                three. Enabled once at least one of them has something
                pending AND nothing is still mid-validation (a typed
                Director's Note that hasn't passed its wording check yet
                blocks this the same way it blocks Produce Audio below).
                Clicking it applies Director's Note + Lessons in a SINGLE
                combined /api/revise-script call when both are pending (that
                route already supports instruction+lessons together), or
                just whichever one is actually pending; a cast-only change
                has no script text to rewrite, so it's simply acknowledged
                (cleared) with no Gemini call at all. Only clears each
                pending flag on a CONFIRMED success — handleRevise/
                handleLessonRewrite never throw (they catch their own errors
                into reviseError), so a failed attempt leaves everything
                exactly as the user left it, ready to retry. */}
            {(() => {
              const hasFreeText = directorNote.trim().length > 0;
              const hasChips = selectedMoodChips.size > 0;
              const hasPendingDirectorNote = hasFreeText || hasChips;
              const lessonsPending = pendingLessonsInstruction !== null;
              const hasAnyPending = hasPendingDirectorNote || lessonsPending || hasPendingCastChange;
              if (!hasAnyPending) return null;

              // A typed-but-unchecked note blocks readiness even though
              // hasAnyPending is already true — same rule the panel's own
              // Ok button enforces.
              const notReadyYet = hasFreeText && !directionValid;
              const enabled = !notReadyYet && !isRevising;

              const handleUpdateScript = async () => {
                if (!enabled) return;
                let ok = true;
                if (hasPendingDirectorNote || lessonsPending) {
                  const chipInstructions = DIRECTOR_CHIPS.filter((c) => selectedMoodChips.has(c.labelKey)).map((c) => c.instruction);
                  const parts = [...chipInstructions];
                  if (hasFreeText) parts.push(directorNote.trim());
                  if (lessonsPending && pendingLessonsInstruction) parts.push(pendingLessonsInstruction);
                  const combinedInstruction = parts.join(". ");
                  ok = lessonsPending
                    ? await handleLessonRewrite(combinedInstruction)
                    : await handleRevise(combinedInstruction);
                }
                // Failed — reviseError is already showing; leave everything
                // pending so the user can just retry instead of losing intent.
                if (!ok) return;
                setSelectedMoodChips(new Set());
                setPendingLessonsInstruction(null);
                setHasPendingCastChange(false);
              };

              return (
                <button
                  onClick={handleUpdateScript}
                  disabled={!enabled}
                  className="w-full py-3.5 rounded-full text-fs-body font-semibold transition-all active:scale-[0.98] disabled:opacity-40 mb-2.5"
                  style={enabled
                    ? { background: "linear-gradient(90deg, rgba(79,195,247,0.22), rgba(139,92,246,0.22))", border: "1.5px solid rgba(79,195,247,0.4)", color: "#4fc3f7" }
                    : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.4)" }}
                >
                  {isRevising ? i18nT(language, "revisingLabel" as never) : i18nT(language, "updateScript" as never)}
                </button>
              );
            })()}

            {/* Produce Audio — enabled when there's no audio yet, or once the
                script/voices genuinely differ from what's currently produced
                (editing text back to exactly its produced form disables it
                again — see scriptChangedFromProduced above). Blocked while
                anything the Update Story button above would apply is still
                staged but unapplied — a Director's Note, a lessons change,
                or a cast avatar/voice reassignment. Producing right then
                would silently ignore the staged edit and use the script as
                it stood before, which reads as the edit having no effect at
                all. Getting unblocked means either committing it (Update
                Story above) or discarding it (the panel's own Cancel); a
                hint below the button says so explicitly rather than leaving
                it looking disabled for no visible reason.
                Deliberately NOT blocked by needsSave: production itself
                persists the exact current script/title/cover (addEntry
                upsert in produce-drama), so an unsaved-but-applied change
                doesn't need a separate "Update Version" click first — that
                requirement previously left Produce dead right after
                clicking Update Story (the revision marks the script dirty),
                turning the intended change → Update Story → Produce flow
                into a three-click scavenger hunt. */}
            {(() => {
              const hasPendingDirectorNote = directorNote.trim().length > 0 || selectedMoodChips.size > 0;
              const lessonsPending = pendingLessonsInstruction !== null;
              const hasAnyPendingEdit = hasPendingDirectorNote || lessonsPending || hasPendingCastChange;
              const blocked = isProducing || !needsProduce || isValidating || generating || isFetchingCover || hasAnyPendingEdit;
              // Only worth calling out when a staged edit is specifically
              // why it's blocked — every other blocking reason already shows
              // its own state inside the button itself (mixing/checking/etc.).
              const blockedByPendingEdit = hasAnyPendingEdit && !isProducing && !isValidating && !generating && !isFetchingCover;
              return (
                <>
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
                      color: "rgba(255,255,255,0.55)",
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
                  {blockedByPendingEdit && (
                    <p className="text-fs-body text-center mt-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                      Update or cancel your pending changes to produce audio
                    </p>
                  )}
                </>
              );
            })()}

            {/* Save for later / Update version — one adaptive button, not two.
                Before this story has ever been saved once (savesCount === 0)
                AND before it's ever been produced, it's always visible as
                "Save for later" — an explicit, findable way to stop here
                without producing audio; the story shows up in Library > My
                Stories as a Draft from that point on (see includeDrafts in
                libraryStore.ts). Producing audio persists the story for real
                (addEntry upsert in produce-drama) without ever going through
                this button's own /api/script-saves call, so storyHasAudio
                counts as "saved" here too — otherwise this kept reading as
                neverSaved forever post-production and re-offered "Save for
                later" on an already-produced, already-listenable story.
                After the first save (or first production), this button
                disappears entirely until something actually changes
                (needsSave), then reappears labeled "Update version" — so its
                mere presence is the signal that there's something to save,
                rather than sitting there permanently disabled and easy to
                ignore. Stays visible through the "saving"/"saved" confirmation
                even though needsSave flips false the instant the save lands. */}
            {(() => {
              const neverSaved = savesCount === 0 && !storyHasAudio;
              const canSave = needsSave && !isProducing;
              // scriptBlocks doesn't reflect the final story yet while the
              // post-generation review pass is still trickling blocks in
              // (see the FiveQuestionFlow/chat onComplete handlers' staggered
              // reveal) — saving here would silently persist whatever
              // partial subset of blocks had landed so far, or no-op
              // entirely if clicked before the first one has. Same "not
              // settled yet" gate Produce Audio already uses.
              const notReadyToSave = isValidating;
              const saveEnabled = (neverSaved || canSave) && !notReadyToSave;
              if (!neverSaved && !needsSave && saveLabel === "idle") return null;
              // While the review pass runs, the Produce Audio button right
              // above already shows a "Checking content…" spinner — rendering
              // a second, identical spinner button here just reads as clutter
              // (two stacked spinners for one process). Hide until settled.
              if (notReadyToSave) return null;
              return (
                <button
                  onClick={handleManualSave}
                  disabled={!saveEnabled || isSaving || saveLabel === "saved"}
                  className="w-full mt-2.5 py-3.5 rounded-full text-fs-body font-semibold transition-all duration-200 active:scale-[0.97] flex items-center justify-center gap-2"
                  style={saveLabel === "saved" ? {
                    background: "rgba(16,185,129,0.12)",
                    border: "1.5px solid rgba(52,211,153,0.4)",
                    color: "#6ee7b7",
                    boxShadow: "0 0 20px rgba(16,185,129,0.15)",
                  } : saveEnabled ? {
                    background: "linear-gradient(135deg, rgba(139,92,246,0.18) 0%, rgba(99,102,241,0.14) 100%)",
                    border: "1.5px solid rgba(167,139,250,0.45)",
                    color: "#d8b4fe",
                    boxShadow: "0 0 22px rgba(139,92,246,0.18), 0 4px 12px rgba(0,0,0,0.2)",
                  } : {
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    color: "rgba(255,255,255,0.55)",
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
                  ) : neverSaved ? (
                    <><span className="text-fs-heading leading-none">💾</span> Save for later</>
                  ) : (
                    <><Icon name="save" size={14} /> Update version</>
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
                storyId={editingStoryId}
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

      {/* Sticky player for a just-produced drama -- replaces the old separate
          "Drama Ready" screen so producing no longer navigates away from
          whatever tab you were on. */}
      {completedJob?.audioUrl && (
        <StudioAudioBar
          audioUrl={completedJob.audioUrl}
          title={completedJob.title ?? storyTitle ?? "Your Story"}
          durationSeconds={completedJob.durationSeconds ?? 0}
          storyId={editingStoryId ?? undefined}
        />
      )}

      {languageMismatchModal}
    </div>
  );
}
