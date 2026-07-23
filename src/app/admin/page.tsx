"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import type { ScriptBlock } from "@/types";
import type { Voice } from "@/types";
import type { ClassicMeta } from "@/lib/classicStories";
import { PRESET_VOICE_POOL, fetchVoicePool } from "@/lib/services/voiceCatalog";
import ScriptTab from "@/components/studio/ScriptTab";
import VoicePicker from "@/components/studio/VoicePicker";
import Icon from "@/components/ui/Icon";
import { getNarratorVoiceId } from "@/lib/narratorPreference";
import { stripNamePrefix } from "@/utils/stripSoundCues";
import type { CharacterProfile } from "@/lib/libraryStore";
import type { CharacterClassification } from "@/lib/services/characterClassifier";
import { pickBestVoiceForCharacter } from "@/lib/services/voiceAssignment";
import type { AdminStoryOption } from "@/app/api/admin/list-all-stories/route";

const ADMIN_EMAIL = "tomereden@gmail.com";

// ─── Pricing model (estimates based on standard API rates) ────────────────────
// All prices in USD. Adjust here if plans/pricing change.
const PRICING = {
  gemini_token:      0.40  / 1_000_000,  // $0.40/1M tokens — blended text gen (Flash 2.5)
  gemini_tts_char:   0.10  / 1_000_000,  // $0.10/1M chars  — Gemini TTS synthesis
  gemini_image:      0.04,               // $0.04/image     — Imagen / Flash-image
  el_tts_char:       0.20  / 1_000,      // $0.20/1K chars  — ElevenLabs eleven_v3
  el_sfx_call:       0.08,               // $0.08/call      — ElevenLabs SFX generation
} as const;

const LANGUAGES = [
  { code: "en", label: "English 🇺🇸" },
  { code: "he", label: "Hebrew 🇮🇱" },
  { code: "es", label: "Spanish 🇪🇸" },
  { code: "fr", label: "French 🇫🇷" },
  { code: "de", label: "German 🇩🇪" },
  { code: "it", label: "Italian 🇮🇹" },
  { code: "pt", label: "Portuguese 🇵🇹" },
  { code: "ar", label: "Arabic 🇸🇦" },
  { code: "ru", label: "Russian 🇷🇺" },
];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function makeBlock(order: number): ScriptBlock {
  return { id: uid(), blockOrder: order, characterName: "Narrator", assignedVoiceId: "Aoede", textPayload: "" };
}

// ─── Shared UI ─────────────────────────────────────────────────────────────────

const baseInput = "w-full px-3 py-2.5 rounded-xl text-white text-fs-body outline-none";
const baseStyle = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" };

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-fs-body mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>{children}</p>;
}

function TextInput({ value, onChange, placeholder, rows, disabled }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; disabled?: boolean }) {
  if (rows) {
    return <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows} disabled={disabled}
      className={baseInput + " resize-none"} style={baseStyle} />;
  }
  return <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} disabled={disabled}
    className={baseInput} style={disabled ? { ...baseStyle, opacity: 0.6, cursor: "not-allowed" } : baseStyle} />;
}

// Strips a trailing "- Chapter N" / "- פרק N" suffix — same helper duplicated
// per-file across the app (library/[id], library/classics/[id], home, share
// page) since a chapter's OWN title already embeds the suffix and there's no
// separately-stored "series base name". Used here to derive a new episode's
// title from whichever existing chapter was picked as the series anchor.
function seriesDisplayTitle(title: string): string {
  return title.replace(/\s*-\s*(chapter|פרק)\s*\d+\s*$/i, "").trim();
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={baseInput}
      style={{ ...baseStyle, color: "#fff", appearance: "none" }}>
      {options.map((o) => <option key={o.value} value={o.value} style={{ background: "#0D1120" }}>{o.label}</option>)}
    </select>
  );
}

function Toggle({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <div onClick={onToggle} className="relative rounded-full transition-all flex-shrink-0"
        style={{ width: 44, height: 24, background: on ? "rgba(79,195,247,0.4)" : "rgba(255,255,255,0.1)", border: on ? "1px solid rgba(79,195,247,0.6)" : "1px solid rgba(255,255,255,0.15)" }}>
        <div className="absolute top-0.5 rounded-full transition-all"
          style={{ width: 20, height: 20, background: on ? "#4fc3f7" : "rgba(255,255,255,0.4)", left: on ? 22 : 2 }} />
      </div>
      <span className="text-fs-body" style={{ color: on ? "#4fc3f7" : "rgba(255,255,255,0.35)" }}>{label}</span>
    </label>
  );
}

function Divider({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 my-6">
      <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
      <span className="text-fs-body font-bold uppercase tracking-widest flex-shrink-0" style={{ color: "rgba(255,255,255,0.48)" }}>{title}</span>
      <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
    </div>
  );
}

// ─── Add Story draft persistence ────────────────────────────────────────────
// Everything in the Add Story form (and everything Process Script computes
// from it) is saved to localStorage so an accidental refresh or navigating
// away never loses a pasted script or its reviewed cast — cleared only when
// resetAddStory() runs.

const ADD_STORY_DRAFT_KEY = "nightstory_admin_add_story_draft";

interface AddStoryDraft {
  addTitle: string;
  addScript: string;
  addIsPublic: boolean;
  addCategory: "classics" | "community";
  parsedBlocks: ScriptBlock[];
  validationIssues: string[];
  processState: "idle" | "processing" | "done" | "error";
  validationChanges: number;
  storeCoverUrl: string;
  storeCoverPrompt: string;
  storeSummary: string;
  characterAvatars: Record<string, string>;
  characterTypes: Record<string, CharacterType>;
  castProfiles: Record<string, CharacterProfile>;
  scriptLanguage: string;
}

function loadAddStoryDraft(): Partial<AddStoryDraft> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(ADD_STORY_DRAFT_KEY);
    if (!raw) return {};
    const draft = JSON.parse(raw) as Partial<AddStoryDraft>;
    // "processing" only ever meant an in-flight async call in the tab that
    // saved it — that call died with the reload, so resurrecting it would
    // leave Process Script's button stuck disabled with nothing running.
    if (draft.processState === "processing") draft.processState = "idle";
    return draft;
  } catch {
    return {};
  }
}

// ─── Cast + direction components (mirrors studio) ─────────────────────────────

type CharacterType = "child" | "adult" | "animal" | "narrator";

function buildDiceBearUrl(characterName: string, type: CharacterType): string {
  const seed = encodeURIComponent(characterName);
  const bg = "0d1b4a";
  switch (type) {
    case "child":  return `https://api.dicebear.com/9.x/adventurer/svg?seed=${seed}&backgroundColor=${bg}`;
    case "animal": return `https://api.dicebear.com/9.x/croodles/svg?seed=${seed}&backgroundColor=${bg}&scale=90`;
    default:       return `https://api.dicebear.com/9.x/micah/svg?seed=${seed}&backgroundColor=${bg}&scale=85`;
  }
}

interface BankAvatar { id: string; type: string; image_url: string; }

async function fetchBankAvatars(): Promise<BankAvatar[]> {
  try {
    const res = await fetch("/api/avatar-bank-list", { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json() as { avatars?: BankAvatar[] };
    return data.avatars ?? [];
  } catch { return []; }
}

function nameHash(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h;
}

function pickBankAvatar(name: string, type: CharacterType, bank: BankAvatar[]): string {
  const typeKey = type === "narrator" ? "adult" : type;
  const candidates = bank.filter((a) => a.type === typeKey);
  const pool = candidates.length > 0 ? candidates : bank;
  if (!pool.length) return buildDiceBearUrl(name, type);
  return pool[nameHash(name) % pool.length].image_url;
}

const AVATAR_TABS_ADMIN = [
  { key: "child",  label: "Kids",    emoji: "🧒" },
  { key: "adult",  label: "Adults",  emoji: "🧑" },
  { key: "animal", label: "Animals", emoji: "🐾" },
];

function AvatarGallery({ currentUrl, characterType, onSelect }: {
  currentUrl?: string;
  characterType: CharacterType;
  onSelect: (url: string, type: CharacterType) => void;
}) {
  const [bank, setBank] = useState<BankAvatar[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>(characterType === "narrator" ? "adult" : characterType);

  useEffect(() => { fetchBankAvatars().then((b) => { setBank(b); setLoading(false); }); }, []);

  const filtered = bank.filter((a) => a.type === activeTab);

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: "rgba(5,7,18,0.97)", border: "1px solid rgba(139,92,246,0.2)" }}>
      <div className="flex p-1.5 gap-1" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        {AVATAR_TABS_ADMIN.map(({ key, label, emoji }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-fs-body font-bold transition-all active:scale-95"
            style={activeTab === key
              ? { background: "linear-gradient(135deg,rgba(139,92,246,0.3),rgba(79,195,247,0.15))", color: "#C4B5FD", border: "1px solid rgba(139,92,246,0.45)" }
              : { color: "rgba(255,255,255,0.48)", border: "1px solid transparent" }}>
            <span style={{ fontSize: "var(--fs-label)" }}>{emoji}</span>
            <span>{label}</span>
          </button>
        ))}
      </div>
      <div className="p-2.5 overflow-y-auto" style={{ maxHeight: 210 }}>
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <span className="w-6 h-6 border-2 rounded-full animate-spin"
              style={{ borderColor: "rgba(167,139,250,0.15)", borderTopColor: "#A78BFA" }} />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center py-6 text-fs-body" style={{ color: "rgba(255,255,255,0.40)" }}>No avatars yet</p>
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
                    : { background: "#07091a", boxShadow: "0 0 0 1px rgba(255,255,255,0.06)" }}>
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

function DirectionSheet({
  characterName, voice, voicePool, avatarUrl, characterType, characterProfile,
  otherAssignedVoiceIds, otherAssignedAvatarUrls, storyLanguage,
  onAvatarChange, onVoiceChange, onClose,
}: {
  characterName: string;
  voice: Voice | undefined;
  voicePool: Voice[];
  avatarUrl?: string;
  characterType: CharacterType;
  /** This character's nature (gender/type/ageBucket/category/visualDescription) — feeds Auto Assign's matching. */
  characterProfile?: CharacterProfile;
  /** Voice ids already assigned to OTHER characters in this story — Auto Assign avoids picking these when possible. */
  otherAssignedVoiceIds?: Set<string>;
  /** Avatar URLs already assigned to OTHER characters in this story — avatar Auto Assign avoids picking these when possible. */
  otherAssignedAvatarUrls?: Set<string>;
  storyLanguage?: string;
  onAvatarChange: (url: string, type: CharacterType) => void;
  onVoiceChange: (voiceId: string) => void;
  onClose: () => void;
}) {
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showVoicePicker, setShowVoicePicker]   = useState(false);
  const [avatarMatching, setAvatarMatching]     = useState(false);
  const isNarrator = characterType === "narrator" || characterProfile?.type === "narrator" || characterName === "Narrator";

  // Same nature-based casting logic as Studio's Direction Sheet — an
  // instant, local, deterministic lookup against the static preset catalog.
  const handleAutoAssign = () => {
    if (isNarrator) return;
    const bestId = pickBestVoiceForCharacter(characterProfile, storyLanguage, otherAssignedVoiceIds);
    if (bestId) {
      onVoiceChange(bestId);
      setShowVoicePicker(false);
    }
  };

  // Same AI avatar-bank match (findBestAvatarForCharacter) produce-drama runs
  // automatically at generation time, exposed here for the same per-character
  // "Auto Assign" button Studio has.
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

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)" }}
        onClick={onClose} />
      <div className="fixed z-50 flex flex-col overflow-hidden"
        style={{
          left: "50%", transform: "translateX(-50%)",
          bottom: 80, width: "calc(100vw - 24px)", maxWidth: 460,
          maxHeight: "calc(100dvh - 160px)", borderRadius: 24,
          background: "linear-gradient(170deg,#0d1530 0%,#080d1e 55%,#0a0618 100%)",
          border: "1px solid rgba(139,92,246,0.35)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.8)",
        }}>
        {/* Header */}
        <div className="relative flex-shrink-0 px-5 pt-5 pb-4"
          style={{ background: "linear-gradient(160deg,rgba(88,28,220,0.22) 0%,rgba(30,58,120,0.18) 100%)", borderBottom: "1px solid rgba(139,92,246,0.18)" }}>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0"
              style={{ background: "#07091a", boxShadow: "0 0 0 2.5px rgba(167,139,250,0.6),0 0 20px rgba(139,92,246,0.4)" }}>
              {avatarUrl
                ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={avatarUrl} alt={characterName} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-fs-subtitle font-black"
                    style={{ background: "linear-gradient(135deg,rgba(88,28,220,0.5),rgba(30,58,120,0.5))", color: "#C4B5FD" }}>
                    {characterName.charAt(0)}
                  </div>
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black leading-tight truncate" style={{ fontSize: "var(--fs-subtitle)", color: "#fff" }}>
                {characterName}
              </p>
              {voice && (
                <div className="flex items-center gap-1.5 mt-1">
                  <span style={{ fontSize: "var(--fs-caption)", color: "rgba(255,255,255,0.55)" }}>🎙</span>
                  <span className="text-fs-body truncate" style={{ color: "rgba(255,255,255,0.45)" }}>{voice.name}</span>
                </div>
              )}
            </div>
            <button onClick={onClose}
              className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full transition-all active:scale-90"
              style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }}>
              <Icon name="close" size={14} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-3 p-4">
          {/* Avatar section */}
          <div className="rounded-2xl overflow-hidden"
            style={{ background: "rgba(88,28,220,0.08)", border: "1px solid rgba(139,92,246,0.2)" }}>
            <button onClick={() => { setShowAvatarPicker((p) => !p); setShowVoicePicker(false); }}
              className="flex items-center gap-3 w-full px-4 py-3 transition-all active:scale-[0.99]">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.3)" }}>
                <span style={{ fontSize: "var(--fs-body)" }}>🎭</span>
              </div>
              <div className="flex-1 text-left">
                <p className="text-fs-body font-black uppercase tracking-widest" style={{ color: "#A78BFA" }}>Avatar</p>
                <p className="text-fs-body mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                  {showAvatarPicker ? "Tap an image to select" : "Choose character look"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {avatarUrl && (
                  <div className="w-7 h-7 rounded-lg overflow-hidden flex-shrink-0"
                    style={{ border: "1.5px solid rgba(167,139,250,0.4)" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={avatarUrl} alt="" className="w-full h-full object-cover rounded-full" />
                  </div>
                )}
                <Icon name={showAvatarPicker ? "collapse" : "expand"} size={12} style={{ color: "rgba(167,139,250,0.5)" }} />
              </div>
            </button>
            {showAvatarPicker && (
              <div className="px-3 pb-3">
                {!isNarrator && (
                <button
                  onClick={handleAvatarAutoAssign}
                  disabled={avatarMatching}
                  className="w-full mb-2 py-2.5 rounded-xl text-fs-body font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 disabled:opacity-60"
                  style={{ background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.35)", color: "#A78BFA" }}
                  title="Match this character's nature (type/gender/age) to the best-fitting avatar"
                >
                  {avatarMatching ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 rounded-full animate-spin" style={{ borderColor: "rgba(167,139,250,0.25)", borderTopColor: "#A78BFA" }} />
                      Matching…
                    </>
                  ) : (
                    <>✨ Auto Assign</>
                  )}
                </button>
                )}
                <AvatarGallery currentUrl={avatarUrl} characterType={characterType}
                  onSelect={(url, type) => { onAvatarChange(url, type); setShowAvatarPicker(false); }} />
              </div>
            )}
          </div>

          {/* Voice section */}
          <div className="rounded-2xl overflow-hidden"
            style={{ background: "rgba(14,78,107,0.15)", border: "1px solid rgba(79,195,247,0.18)" }}>
            <button onClick={() => { setShowVoicePicker((p) => !p); setShowAvatarPicker(false); }}
              className="flex items-center gap-3 w-full px-4 py-3 transition-all active:scale-[0.99]">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(79,195,247,0.12)", border: "1px solid rgba(79,195,247,0.28)" }}>
                <span style={{ fontSize: "var(--fs-body)" }}>🎙️</span>
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-fs-body font-black uppercase tracking-widest" style={{ color: "#4FC3F7" }}>Voice</p>
                <p className="text-fs-body mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.55)" }}>
                  {voice?.name ?? "No voice selected"}
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
                <Icon name={showVoicePicker ? "collapse" : "expand"} size={12} style={{ color: "rgba(79,195,247,0.45)" }} />
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
                <VoicePicker inline voices={voicePool} selectedVoiceId={voice?.id ?? ""}
                  onSelect={(voiceId) => { onVoiceChange(voiceId); setShowVoicePicker(false); }}
                  onClose={() => setShowVoicePicker(false)} />
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function CharacterCard({ characterName, voice, avatarUrl, isOpen, onOpen }: {
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
  const ringActive = isNarrator
    ? "linear-gradient(135deg,#f59e0b,#fbbf24,#f59e0b)"
    : "linear-gradient(135deg,#4fc3f7,#a78bfa)";
  const ringIdle = "linear-gradient(135deg,rgba(255,255,255,0.1),rgba(255,255,255,0.04))";
  const glowActive = isNarrator
    ? "0 0 22px rgba(245,158,11,0.5),0 0 40px rgba(251,191,36,0.2)"
    : "0 0 20px rgba(79,195,247,0.35),0 0 36px rgba(167,139,250,0.2)";
  const accentColor = isNarrator ? "#fbbf24" : "rgba(79,195,247,0.8)";
  const displayUrl = avatarUrl || buildDiceBearUrl(characterName, isNarrator ? "narrator" : "adult");

  return (
    <div className="flex-shrink-0 flex flex-col items-center gap-1.5" style={{ minWidth: isNarrator ? 80 : 72 }}>
      <button onClick={onOpen} className="flex flex-col items-center gap-1.5 w-full">
        <div className="relative flex items-center justify-center"
          style={{
            width: size + 6, height: size + 6, borderRadius: "50%",
            background: isOpen ? ringActive : ringIdle,
            padding: 2.5, boxShadow: isOpen ? glowActive : "none",
            transition: "all 0.25s ease",
          }}>
          <div className="w-full h-full rounded-full overflow-hidden" style={{ background: "#07091a" }}>
            {!imgError && displayUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={displayUrl} alt={characterName} className="w-full h-full object-cover"
                onError={() => setImgError(true)} />
            ) : (
              <div className="w-full h-full flex items-center justify-center font-black text-fs-heading"
                style={{ background: "linear-gradient(135deg,rgba(79,195,247,0.25),rgba(167,139,250,0.2))", color: "rgba(255,255,255,0.6)" }}>
                {characterName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col items-center gap-0.5 w-full">
          <p className="text-fs-body font-semibold text-center leading-tight truncate w-full px-1"
            style={{ color: "rgba(255,255,255,0.85)" }}>
            {characterName}
          </p>
          {voice && (
            <p className="text-fs-body text-center leading-none" style={{ color: accentColor }}>
              {voice.name.split(" ")[0]}
            </p>
          )}
        </div>
      </button>
    </div>
  );
}

function CharacterCards({
  blocks, voicePool, avatars, characterTypes, characterProfiles, storyLanguage,
  openCharacter, onOpen, onClose, onAvatarChange, onVoiceChange,
}: {
  blocks: ScriptBlock[];
  voicePool: Voice[];
  avatars: Record<string, string>;
  characterTypes: Record<string, CharacterType>;
  /** Nature per cast member (gender/ageBucket/category/visualDescription) — feeds Auto Assign. */
  characterProfiles?: Record<string, CharacterProfile>;
  storyLanguage?: string;
  openCharacter: string | null;
  onOpen: (name: string) => void;
  onClose: () => void;
  onAvatarChange: (characterName: string, url: string, type: CharacterType) => void;
  onVoiceChange: (characterName: string, voiceId: string) => void;
}) {
  type CastMember = { characterName: string; voice: Voice | undefined };
  const cast = Array.from(
    blocks.filter((b) => b.characterName !== "SFX")
      .reduce<Map<string, CastMember>>((map, b) => {
        if (!map.has(b.characterName)) {
          map.set(b.characterName, {
            characterName: b.characterName,
            voice: voicePool.find((v) => v.id === b.assignedVoiceId),
          });
        }
        return map;
      }, new Map()).values(),
  );

  if (cast.length === 0) return null;

  const openMember = openCharacter ? cast.find((c) => c.characterName === openCharacter) : null;

  return (
    <div className="mb-5">
      <p className="text-fs-body font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(79,195,247,0.45)" }}>
        Cast
      </p>
      <div className="flex gap-3 pb-2 -mx-5 px-5"
        style={{ overflowX: "scroll", scrollbarWidth: "none" } as React.CSSProperties}>
        {cast.map(({ characterName, voice }) => (
          <CharacterCard key={characterName} characterName={characterName} voice={voice}
            avatarUrl={avatars[characterName]} isOpen={openCharacter === characterName}
            onOpen={() => onOpen(characterName)} />
        ))}
      </div>
      {openCharacter && openMember && (
        <DirectionSheet
          characterName={openCharacter}
          voice={openMember.voice}
          voicePool={voicePool}
          avatarUrl={avatars[openCharacter]}
          characterType={characterTypes[openCharacter] ?? (openCharacter === "Narrator" ? "narrator" : "adult")}
          characterProfile={characterProfiles?.[openCharacter]}
          otherAssignedVoiceIds={new Set(cast.filter((c) => c.characterName !== openCharacter && c.voice).map((c) => c.voice!.id))}
          otherAssignedAvatarUrls={new Set(cast.filter((c) => c.characterName !== openCharacter && avatars[c.characterName]).map((c) => avatars[c.characterName]))}
          storyLanguage={storyLanguage}
          onAvatarChange={(url, type) => onAvatarChange(openCharacter, url, type)}
          onVoiceChange={(voiceId) => onVoiceChange(openCharacter, voiceId)}
          onClose={onClose}
        />
      )}
    </div>
  );
}

// ─── Job Progress ──────────────────────────────────────────────────────────────

function JobProgress({ status, step, progress, error }: { status: string; step: string; progress: number; error?: string }) {
  const done = status === "done";
  const err = status === "error";
  return (
    <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${err ? "rgba(236,72,153,0.3)" : done ? "rgba(79,195,247,0.3)" : "rgba(255,255,255,0.08)"}` }}>
      <div className="flex justify-between mb-2">
        <span className="text-white text-fs-body">{step || "Starting…"}</span>
        <span className="text-fs-body font-bold" style={{ color: err ? "#EC4899" : "#4fc3f7" }}>{progress}%</span>
      </div>
      <div className="w-full rounded-full overflow-hidden" style={{ height: 5, background: "rgba(255,255,255,0.07)" }}>
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${progress}%`, background: err ? "#EC4899" : "linear-gradient(90deg,#4fc3f7,#a78bfa)" }} />
      </div>
      {err && error && <p className="text-fs-body mt-2" style={{ color: "#EC4899" }}>{error}</p>}
    </div>
  );
}

// ─── Cost Analysis ────────────────────────────────────────────────────────────

interface CostData {
  totals: {
    gemini_tokens: number; gemini_calls: number;
    gemini_tts_chars: number; gemini_tts_calls: number;
    gemini_image_calls: number;
    el_tts_chars: number; el_tts_calls: number;
    el_sfx_chars: number; el_sfx_calls: number;
    pollinations_calls: number;
  };
  storyCount: number; publicCount: number; privateCount: number; totalDurationSec: number;
  // Real, per-call-log-derived cost — see src/lib/serviceUsage.ts and
  // /api/admin/cost-analysis. Accurate (per-model input/output token
  // pricing, real EL SFX duration-based billing) unlike `totals` above,
  // which is the old cumulative-blob estimate kept only for stories
  // produced before this tracking existed.
  accurate: {
    grandTotalUsd: number;
    rowCount: number;
    storiesWithUsage: number;
    callTypeBreakdown: { callType: string; provider: string; model: string; calls: number; costUsd: number; inputTokens: number; outputTokens: number; characters: number; audioSeconds: number }[];
    providerBreakdown: { provider: string; calls: number; costUsd: number }[];
    tableReady: boolean;
    error?: string;
  };
}

interface StoryUsageCost {
  storyId: string; title: string; language: string | null; isDraft: boolean | null;
  costUsd: number; calls: number;
  topCallTypes: { callType: string; costUsd: number }[];
}

interface StoryCost {
  id: string; title: string; isPublic: boolean;
  durationSeconds: number; blockCount: number;
  geminiChars: number; elChars: number;
  estimatedSfx: number; estimatedTokens: number; hasCover: boolean;
  costs: { geminiTextGen: number; geminiTts: number; geminiImage: number; elTts: number; elSfx: number; total: number };
  /** Every distinct AI model actually used to produce this story — undefined
   *  for stories produced before this was tracked. */
  modelsUsed?: string[];
}
interface LibraryCostData {
  stories: StoryCost[];
  totals: { durationSeconds: number; blockCount: number; geminiChars: number; elChars: number; estimatedSfx: number; estimatedTokens: number; coverCount: number; costs: StoryCost["costs"] };
  storyCount: number;
}

function fmtCost(usd: number): string {
  if (usd < 0.001) return `<$0.001`;
  if (usd < 0.01)  return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(3)}`;
}
function fmtDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function SummaryChips({ items }: { items: { label: string; value: string | number; sub: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl px-3 py-3"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <p className="text-fs-body" style={{ color: "rgba(255,255,255,0.55)" }}>{item.label}</p>
          <p className="text-white font-bold text-fs-subtitle">{item.value}</p>
          <p className="text-fs-body" style={{ color: "rgba(255,255,255,0.48)" }}>{item.sub}</p>
        </div>
      ))}
    </div>
  );
}

function CostRow({ label, usage, cost, sub }: { label: string; usage: string; cost: number; sub?: string }) {
  return (
    <div className="flex items-center gap-3 py-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <div className="flex-1 min-w-0">
        <p className="text-white text-fs-body">{label}</p>
        {sub && <p className="text-fs-body" style={{ color: "rgba(255,255,255,0.52)" }}>{sub}</p>}
      </div>
      <span className="text-fs-body flex-shrink-0" style={{ color: "rgba(255,255,255,0.4)", minWidth: 80, textAlign: "right" }}>{usage}</span>
      <span className="text-fs-body font-bold flex-shrink-0" style={{ color: "#4fc3f7", minWidth: 70, textAlign: "right" }}>{fmtCost(cost)}</span>
    </div>
  );
}

function BreakdownTable({ rows, total }: { rows: { label: string; usage: string; cost: number; sub?: string }[]; total: number }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
      <div className="flex items-center gap-3 px-3 py-2"
        style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <span className="flex-1 text-fs-body font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.52)" }}>Service</span>
        <span className="text-fs-body font-bold uppercase tracking-widest flex-shrink-0" style={{ color: "rgba(255,255,255,0.52)", minWidth: 80, textAlign: "right" }}>Usage</span>
        <span className="text-fs-body font-bold uppercase tracking-widest flex-shrink-0" style={{ color: "rgba(255,255,255,0.52)", minWidth: 70, textAlign: "right" }}>Cost</span>
      </div>
      <div className="px-3">
        {rows.map((r) => <CostRow key={r.label} {...r} />)}
        <div className="flex items-center gap-3 py-3">
          <span className="flex-1 text-white font-bold text-fs-body">Total estimated</span>
          <span style={{ minWidth: 80 }} />
          <span className="font-bold flex-shrink-0"
            style={{ color: "#a78bfa", fontSize: "var(--fs-subtitle)", minWidth: 70, textAlign: "right" }}>
            {fmtCost(total)}
          </span>
        </div>
      </div>
    </div>
  );
}

// Human-readable label for a call_type key — falls back to a title-cased
// version of the raw key so a new call site never shows up as a blank row.
function callTypeLabel(callType: string): string {
  const LABELS: Record<string, string> = {
    script_generation: "Script Generation", content_review: "Content Review (policy)",
    grammar_review: "Grammar Review", hebrew_review: "Hebrew Review (nikkud)",
    chat_reply: "Chat Reply", chat_greeting: "Chat Greeting", chat_confirmation_check: "Chat Confirmation Check",
    dialogue_tts: "Dialogue TTS", sfx_generation: "SFX Generation", cover_image: "Cover Image",
    cover_prompt_rewrite: "Cover Prompt Rewrite", cover_prompt_enhancement: "Cover Prompt Enhancement",
    casting: "Voice Casting", voice_profiling: "Voice Profiling", character_classification: "Character Classification",
    avatar_matching: "Avatar Matching", scene_generation: "Scene Generation", drama_planning: "Drama Planning",
    language_detection: "Language Detection", hebrew_letter_fix: "Hebrew Letter Fix",
    lesson_analysis: "Value Analysis", lesson_rewrite: "Value Rewrite", director_note_revise: "Director's Note Revise",
    summary_generation: "Summary Generation", title_conflict_resolution: "Title Conflict Resolution",
    content_safety_rewrite: "Content Safety Rewrite", voice_preview: "Voice Preview",
    voice_preset_preview: "Voice Preset Preview", voice_pick_preview: "Voice Pick (text model)",
    insert_block: "Insert Block", validate_text: "Validate Text", validate_sfx: "Validate SFX",
    validate_animal: "Validate Animal", validate_wizard_text: "Validate Wizard Text",
    suggest_names: "Suggest Names", avatar_age_backfill: "Avatar Age Backfill",
    story_meta_analysis: "Story Meta Analysis", sfx_suggestion: "SFX Suggestion",
    classic_script_generation: "Classic Script Generation", name_pronunciation: "Name Pronunciation",
    name_pronunciation_alternatives: "Name Pronunciation Alternatives",
  };
  return LABELS[callType] ?? callType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function usageDescriptor(row: { calls: number; inputTokens: number; outputTokens: number; characters: number; audioSeconds: number }): string {
  if (row.characters > 0) return `${fmtNum(row.characters)} chars`;
  if (row.audioSeconds > 0) return `${row.audioSeconds.toFixed(0)}s audio`;
  if (row.inputTokens || row.outputTokens) return `${fmtNum(row.inputTokens)} in / ${fmtNum(row.outputTokens)} out`;
  return `${row.calls} calls`;
}

// ── Mode A: accurate per-call usage (service_usage), with the old
// cumulative-blob estimate kept as a fallback note for context ─────────────
function UsageMode({ data, onRefresh }: { data: CostData; onRefresh: () => void }) {
  const { accurate, storyCount } = data;
  const [byStory, setByStory] = useState<StoryUsageCost[] | null>(null);
  const [byStoryLoading, setByStoryLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/cost-analysis/by-story", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setByStory(Array.isArray(d.stories) ? d.stories : []))
      .catch(() => setByStory([]))
      .finally(() => setByStoryLoading(false));
  }, []);

  if (!accurate.tableReady) {
    return (
      <div className="flex flex-col gap-3 items-center text-center py-8">
        <span className="text-4xl">📊</span>
        <p className="text-white text-fs-body font-bold">Accurate usage tracking isn't set up yet</p>
        <p className="text-fs-body max-w-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
          Run <code>supabase/service-usage-migration.sql</code> in the Supabase SQL Editor, then every Gemini/ElevenLabs
          call going forward will log its exact cost here, per call and per story.
        </p>
        {accurate.error && <p className="text-fs-body" style={{ color: "#EC4899" }}>{accurate.error}</p>}
        <button onClick={onRefresh} className="text-fs-body px-4 py-2 rounded-xl transition-all active:scale-95"
          style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.08)" }}>
          ↻ Check again
        </button>
      </div>
    );
  }

  const gTotal = accurate.providerBreakdown.find((p) => p.provider === "gemini")?.costUsd ?? 0;
  const elTotal = accurate.providerBreakdown.find((p) => p.provider === "elevenlabs")?.costUsd ?? 0;
  const providerTotal = gTotal + elTotal || 1;
  const elPct = Math.round((elTotal / providerTotal) * 100);

  return (
    <div className="flex flex-col gap-4">
      <SummaryChips items={[
        { label: "Total spend",       value: fmtCost(accurate.grandTotalUsd), sub: `${fmtNum(accurate.rowCount)} calls logged` },
        { label: "Stories w/ usage",  value: accurate.storiesWithUsage,       sub: `of ${storyCount} total` },
        { label: "Cost / story",      value: fmtCost(accurate.grandTotalUsd / (accurate.storiesWithUsage || 1)), sub: "avg, attributed calls only" },
        { label: "Gemini vs ElevenLabs", value: `${100 - elPct}% / ${elPct}%`, sub: "by cost, not call count" },
      ]} />

      <div className="rounded-xl px-3 py-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <p className="text-fs-body font-bold mb-2" style={{ color: "rgba(255,255,255,0.55)" }}>Cost by provider</p>
        <div className="flex rounded-full overflow-hidden mb-2" style={{ height: 8 }}>
          <div style={{ width: `${100 - elPct}%`, background: "linear-gradient(90deg,#4fc3f7,#a78bfa)" }} />
          <div style={{ width: `${elPct}%`, background: "linear-gradient(90deg,#f59e0b,#EC4899)" }} />
        </div>
        <div className="flex justify-between">
          <span className="text-fs-body" style={{ color: "#4fc3f7" }}>Gemini {100 - elPct}% — {fmtCost(gTotal)}</span>
          <span className="text-fs-body" style={{ color: "#f59e0b" }}>ElevenLabs {elPct}% — {fmtCost(elTotal)}</span>
        </div>
      </div>

      <BreakdownTable
        total={accurate.grandTotalUsd}
        rows={accurate.callTypeBreakdown.map((r) => ({
          label: callTypeLabel(r.callType),
          usage: usageDescriptor(r),
          cost: r.costUsd,
          sub: `${r.calls} call${r.calls === 1 ? "" : "s"} · ${r.model}`,
        }))}
      />

      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="px-3 py-2" style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <span className="text-fs-body font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.52)" }}>Most expensive stories</span>
        </div>
        <div className="px-3">
          {byStoryLoading ? (
            <p className="text-fs-body py-3" style={{ color: "rgba(255,255,255,0.4)" }}>Loading…</p>
          ) : !byStory?.length ? (
            <p className="text-fs-body py-3" style={{ color: "rgba(255,255,255,0.4)" }}>No per-story usage logged yet.</p>
          ) : (
            byStory.slice(0, 15).map((s) => (
              <div key={s.storyId} className="flex items-center gap-3 py-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-fs-body truncate">{s.title}{s.isDraft ? " (draft)" : ""}</p>
                  <p className="text-fs-body truncate" style={{ color: "rgba(255,255,255,0.5)" }}>
                    {s.topCallTypes.map((t) => callTypeLabel(t.callType)).join(", ")}
                  </p>
                </div>
                <span className="text-fs-body flex-shrink-0" style={{ color: "rgba(255,255,255,0.4)" }}>{s.calls} calls</span>
                <span className="text-fs-body font-bold flex-shrink-0" style={{ color: "#4fc3f7", minWidth: 70, textAlign: "right" }}>{fmtCost(s.costUsd)}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <p className="text-center text-fs-body" style={{ color: "rgba(255,255,255,0.40)" }}>
        Includes test runs, retries, voice previews — not just produced stories. Prices from src/lib/pricing.ts.
      </p>
      <button onClick={onRefresh} className="text-fs-body px-4 py-2 rounded-xl transition-all active:scale-95 self-center"
        style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.08)" }}>
        ↻ Refresh
      </button>
    </div>
  );
}

// ── Mode B: Library script analysis (bottom-up per story) ────────────────────
function LibraryMode({ data, onRefresh }: { data: LibraryCostData; onRefresh: () => void }) {
  const { stories, totals, storyCount } = data;
  const totalMinutes = totals.durationSeconds / 60;
  const [expanded, setExpanded] = useState<string | null>(null);
  const totalTts = totals.geminiChars + totals.elChars;
  const elPct    = totalTts > 0 ? Math.round((totals.elChars / totalTts) * 100) : 0;

  return (
    <div className="flex flex-col gap-4">
      <SummaryChips items={[
        { label: "Stories analysed", value: storyCount,                                  sub: `${totals.coverCount} with cover` },
        { label: "Total audio",      value: fmtDuration(totals.durationSeconds),          sub: `${totalMinutes.toFixed(1)} min` },
        { label: "Cost / minute",    value: fmtCost(totals.costs.total / (totalMinutes||1)), sub: "script-based estimate" },
        { label: "Cost / story",     value: fmtCost(totals.costs.total / (storyCount||1)),   sub: "script-based estimate" },
      ]} />

      <div className="rounded-xl px-3 py-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <p className="text-fs-body font-bold mb-2" style={{ color: "rgba(255,255,255,0.55)" }}>TTS Voice Split (from blocks)</p>
        <div className="flex rounded-full overflow-hidden mb-2" style={{ height: 8 }}>
          <div style={{ width: `${100-elPct}%`, background: "linear-gradient(90deg,#4fc3f7,#a78bfa)" }} />
          <div style={{ width: `${elPct}%`,     background: "linear-gradient(90deg,#f59e0b,#EC4899)" }} />
        </div>
        <div className="flex justify-between">
          <span className="text-fs-body" style={{ color: "#4fc3f7" }}>Gemini {100-elPct}% — {fmtNum(totals.geminiChars)} chars</span>
          <span className="text-fs-body" style={{ color: "#f59e0b" }}>EL {elPct}% — {fmtNum(totals.elChars)} chars</span>
        </div>
      </div>

      <BreakdownTable total={totals.costs.total} rows={[
        { label: "Gemini Text Gen",  usage: `~${fmtNum(totals.estimatedTokens)} tokens`,   cost: totals.costs.geminiTextGen, sub: "estimated: script gen + drama plan per story" },
        { label: "Gemini TTS",       usage: `${fmtNum(totals.geminiChars)} chars`,          cost: totals.costs.geminiTts,     sub: "actual chars from blocks · $0.10/1M" },
        { label: "Gemini Images",    usage: `${totals.coverCount} covers`,                  cost: totals.costs.geminiImage,   sub: "$0.04/image" },
        { label: "ElevenLabs TTS",   usage: `${fmtNum(totals.elChars)} chars`,              cost: totals.costs.elTts,         sub: "cloned voice chars from blocks · $0.20/1K" },
        { label: "ElevenLabs SFX",   usage: `~${totals.estimatedSfx} effects`,              cost: totals.costs.elSfx,         sub: "estimated from duration + block count · $0.08/effect" },
      ]} />

      {/* Per-story breakdown */}
      <p className="text-fs-body font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.50)" }}>Per Story</p>
      <div className="flex flex-col gap-1.5">
        {[...stories].sort((a, b) => b.costs.total - a.costs.total).map((s) => (
          <div key={s.id}>
            <button
              onClick={() => setExpanded(expanded === s.id ? null : s.id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
              style={{ background: expanded === s.id ? "rgba(79,195,247,0.07)" : "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <span className="text-fs-body flex-shrink-0" style={{ color: "rgba(255,255,255,0.48)" }}>
                {s.isPublic ? "🌍" : "🔒"}
              </span>
              <span className="flex-1 text-white text-fs-body truncate">{s.title}</span>
              <span className="text-fs-body flex-shrink-0" style={{ color: "rgba(255,255,255,0.55)" }}>
                {fmtDuration(s.durationSeconds)}
              </span>
              <span className="text-fs-body font-bold flex-shrink-0" style={{ color: "#4fc3f7", minWidth: 60, textAlign: "right" }}>
                {fmtCost(s.costs.total)}
              </span>
            </button>
            {expanded === s.id && (
              <div className="mx-3 mt-1 mb-1 rounded-xl px-3 py-2 flex flex-col gap-1"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                {[
                  ["Text gen",    `~${fmtNum(s.estimatedTokens)} tokens`, s.costs.geminiTextGen],
                  ["Gemini TTS",  `${fmtNum(s.geminiChars)} chars`,        s.costs.geminiTts],
                  ["Cover image", s.hasCover ? "1 image" : "none",          s.costs.geminiImage],
                  ["EL TTS",      `${fmtNum(s.elChars)} chars`,             s.costs.elTts],
                  ["EL SFX",      `~${s.estimatedSfx} effects`,             s.costs.elSfx],
                ].map(([name, usage, cost]) => (
                  <div key={name as string} className="flex items-center gap-2">
                    <span className="flex-1 text-fs-body" style={{ color: "rgba(255,255,255,0.4)" }}>{name as string}</span>
                    <span className="text-fs-body" style={{ color: "rgba(255,255,255,0.48)" }}>{usage as string}</span>
                    <span className="text-fs-body font-bold" style={{ color: "#4fc3f7", minWidth: 60, textAlign: "right" }}>{fmtCost(cost as number)}</span>
                  </div>
                ))}
                <div className="flex items-start gap-2 pt-1 mt-1" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <span className="flex-shrink-0 text-fs-body" style={{ color: "rgba(255,255,255,0.4)" }}>Models used</span>
                  <span className="flex-1 text-fs-body text-right" style={{ color: "rgba(255,255,255,0.55)" }}>
                    {s.modelsUsed?.length ? s.modelsUsed.join(", ") : "not tracked (produced before this was added)"}
                  </span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <p className="text-center text-fs-body" style={{ color: "rgba(255,255,255,0.40)" }}>
        Derived from script blocks · SFX & text-gen are estimated
      </p>
      <button onClick={onRefresh} className="text-fs-body px-4 py-2 rounded-xl transition-all active:scale-95 self-center"
        style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.08)" }}>
        ↻ Refresh
      </button>
    </div>
  );
}

// ── Outer shell with mode toggle ──────────────────────────────────────────────
function CostAnalysis({
  usageData, libraryData, usageLoading, libraryLoading, onLoadUsage, onLoadLibrary,
}: {
  usageData: CostData | null; libraryData: LibraryCostData | null;
  usageLoading: boolean; libraryLoading: boolean;
  onLoadUsage: () => void; onLoadLibrary: () => void;
}) {
  const [mode, setMode] = useState<"usage" | "library">("library");

  const loading = mode === "usage" ? usageLoading : libraryLoading;
  const hasData = mode === "usage" ? !!usageData : !!libraryData;
  const onLoad  = mode === "usage" ? onLoadUsage : onLoadLibrary;

  return (
    <div className="flex flex-col gap-4">
      {/* Mode toggle */}
      <div className="flex gap-2">
        {(["library", "usage"] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)}
            className="px-4 py-2 rounded-full text-fs-body font-medium transition-all"
            style={mode === m
              ? { background: "rgba(79,195,247,0.15)", border: "1px solid rgba(79,195,247,0.4)", color: "#4fc3f7" }
              : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.55)" }}>
            {m === "library" ? "📖 Script Analysis" : "📊 API Usage"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {[0,1,2,3,4].map((i) => <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />)}
        </div>
      ) : !hasData ? (
        <button onClick={onLoad}
          className="w-full py-3 rounded-xl text-fs-body font-medium transition-all active:scale-[0.98]"
          style={{ background: "rgba(79,195,247,0.07)", border: "1px solid rgba(79,195,247,0.25)", color: "#4fc3f7" }}>
          Load {mode === "library" ? "Script Analysis" : "API Usage"}
        </button>
      ) : mode === "library" ? (
        <LibraryMode data={libraryData!} onRefresh={onLoadLibrary} />
      ) : (
        <UsageMode data={usageData!} onRefresh={onLoadUsage} />
      )}
    </div>
  );
}

// ─── Existing stories list ─────────────────────────────────────────────────────

function ClassicsList({ classics, loading }: { classics: ClassicMeta[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />
        ))}
      </div>
    );
  }
  if (!classics.length) {
    return <p className="text-fs-body" style={{ color: "rgba(255,255,255,0.40)" }}>No public stories yet.</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      {classics.map((c) => (
        <div key={c.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <span className="text-fs-subtitle flex-shrink-0">{c.emoji}</span>
          <div className="flex-1 min-w-0">
            <p className="text-white text-fs-body font-medium truncate">{c.title}</p>
            <p className="text-fs-body truncate" style={{ color: "rgba(255,255,255,0.50)" }}>{c.tagline}</p>
          </div>
          <span className="text-fs-body flex-shrink-0 px-2 py-0.5 rounded-full font-bold"
            style={{
              background: c.status === "ready" ? "rgba(79,195,247,0.1)" : "rgba(255,255,255,0.04)",
              color: c.status === "ready" ? "#4fc3f7" : "rgba(255,255,255,0.25)",
              border: c.status === "ready" ? "1px solid rgba(79,195,247,0.22)" : "1px solid rgba(255,255,255,0.07)",
            }}>
            {c.status === "ready" ? "✓ ready" : "pending"}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── SFX Library Seeder ────────────────────────────────────────────────────────

function SfxLibrarySeeder() {
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [result, setResult] = useState<{ total: number; seeded: number; skipped: number; alreadyInLibrary: number } | null>(null);
  const [error, setError] = useState("");

  const handleSeed = async () => {
    setStatus("running");
    setResult(null);
    setError("");
    try {
      const res = await fetch("/api/admin/seed-sfx-library", { method: "POST", cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Seeding failed");
      setResult(data as typeof result);
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setStatus("error");
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-fs-body" style={{ color: "rgba(255,255,255,0.55)" }}>
        Scan all existing SFX in story_elements, deduplicate by description, embed each one with
        Gemini text-embedding-004, and insert into the global sfx_library for cross-story reuse.
      </p>

      {result && status === "done" && (
        <div className="rounded-xl px-4 py-3 flex flex-col gap-1"
          style={{ background: "rgba(79,195,247,0.06)", border: "1px solid rgba(79,195,247,0.2)" }}>
          <p className="text-white font-bold text-fs-body">✅ Done</p>
          <p className="text-fs-body" style={{ color: "rgba(255,255,255,0.45)" }}>
            {result.total} unique SFX found · {result.alreadyInLibrary} already in library · {result.seeded} newly added · {result.skipped} failed
          </p>
        </div>
      )}

      {status === "error" && (
        <p className="text-fs-body" style={{ color: "#EC4899" }}>{error}</p>
      )}

      <button onClick={handleSeed} disabled={status === "running"}
        className="w-full py-3 rounded-xl text-fs-body font-bold transition-all active:scale-[0.98] disabled:opacity-50"
        style={{ background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.3)", color: "#a78bfa" }}>
        {status === "running" ? "Seeding… (embedding takes a moment)" : "🔊 Seed SFX Library from story_elements"}
      </button>
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();

  // Everything typed/processed into the Add Story form survives a refresh or
  // navigating away — an admin pasting a long script and reviewing cast
  // assignments shouldn't lose that work to an accidental reload. Kept only
  // until resetAddStory() runs (the "Reset" / "Add another story" buttons).
  const [addStoryDraft] = useState<Partial<AddStoryDraft>>(() => loadAddStoryDraft());

  // ── Add Story fields ──────────────────────────────────────────────────────
  const [addTitle, setAddTitle]           = useState(addStoryDraft.addTitle ?? "");
  // Stable id for this add-story session, minted once at Process Script and
  // reused for every Produce click after it (as editingStoryId) and for the
  // final save — mirrors how Studio's flow keeps one id across an entire
  // session instead of a fresh one per produce. Without this, production_metrics
  // never had a stable story_id to update in place; see mark-script-done.
  const [addStoryId, setAddStoryId]       = useState("");
  const [addScript, setAddScript]         = useState(addStoryDraft.addScript ?? "");
  const [addIsPublic, setAddIsPublic]     = useState(addStoryDraft.addIsPublic ?? true);
  const [addCategory, setAddCategory]     = useState<"classics" | "community">(addStoryDraft.addCategory ?? "classics");
  // Adds this story to an existing series as a specific chapter instead of
  // saving it standalone — see handleSaveStory, which chains a call to
  // /api/admin/assign-to-series right after the story itself is saved.
  const [addAsEpisode, setAddAsEpisode]       = useState(false);
  const [episodeSeriesAnchorId, setEpisodeSeriesAnchorId] = useState("");
  const [episodeChapterNumber, setEpisodeChapterNumber]   = useState("");
  const [episodeAssignLog, setEpisodeAssignLog] = useState<{ type: "info" | "error" | "success"; text: string } | null>(null);
  const [parsedBlocks, setParsedBlocks]   = useState<ScriptBlock[]>(addStoryDraft.parsedBlocks ?? []);
  const [validationIssues, setValidationIssues] = useState<string[]>(addStoryDraft.validationIssues ?? []);
  const [processState, setProcessState]   = useState<"idle" | "processing" | "done" | "error">(addStoryDraft.processState ?? "idle");
  const [processPhase, setProcessPhase]   = useState("");
  const [validationChanges, setValidationChanges] = useState(addStoryDraft.validationChanges ?? 0);
  const [processError, setProcessError]   = useState("");
  const [addProduceLog, setAddProduceLog] = useState<string[]>([]);
  const [addProducing, setAddProducing]   = useState(false);
  const [addProduceError, setAddProduceError] = useState("");

  // ── Production job ─────────────────────────────────────────────────────────
  const [jobId, setJobId]               = useState<string | null>(null);
  const [job, setJob]                   = useState<{ status: string; step: string; progress: number; audioUrl?: string; coverUrl?: string; error?: string; libraryError?: string; title?: string; voiceAssignments?: Record<string, string>; storyId?: string } | null>(null);
  const pollRef                         = useRef<ReturnType<typeof setInterval> | null>(null);
  const coverUploadRef                  = useRef<HTMLInputElement | null>(null);

  // ── Cover preview & story meta ────────────────────────────────────────────
  const [storeCoverUrl, setStoreCoverUrl]         = useState(addStoryDraft.storeCoverUrl ?? ""); // base64 data URL from generate-cover
  const [storeCoverLoading, setStoreCoverLoading] = useState(false);
  const [storeCoverPrompt, setStoreCoverPrompt]   = useState(addStoryDraft.storeCoverPrompt ?? "");
  const [storeSummary, setStoreSummary]           = useState(addStoryDraft.storeSummary ?? "");

  // ── Explicit DB save (after production) ──────────────────────────────────
  const [addSaving, setAddSaving]       = useState(false);
  const [addSaveError, setAddSaveError] = useState("");
  const [addSaved, setAddSaved]         = useState(false);

  // ── Cast / voice pool ─────────────────────────────────────────────────────
  const [voicePool, setVoicePool]               = useState<Voice[]>(PRESET_VOICE_POOL);
  const [bankAvatars, setBankAvatars]           = useState<BankAvatar[]>([]);
  const [characterAvatars, setCharacterAvatars] = useState<Record<string, string>>(addStoryDraft.characterAvatars ?? {});
  const [openDirectSheet, setOpenDirectSheet]   = useState<string | null>(null);
  const [characterTypes, setCharacterTypes]     = useState<Record<string, CharacterType>>(addStoryDraft.characterTypes ?? {});
  // Nature (gender/ageBucket/category/visualDescription) per cast member,
  // classified once during Process Script — feeds the Direction Sheet's
  // Auto Assign buttons, same profiles produce-drama itself uses at cast time.
  const [castProfiles, setCastProfiles]         = useState<Record<string, CharacterProfile>>(addStoryDraft.castProfiles ?? {});
  const [scriptLanguage, setScriptLanguage]     = useState<string>(addStoryDraft.scriptLanguage ?? "en");

  // Persist every field above into localStorage (debounced) so an accidental
  // refresh or navigating away never loses a pasted script or its processed
  // cast — cleared only by resetAddStory().
  useEffect(() => {
    const timeout = setTimeout(() => {
      try {
        const draft: AddStoryDraft = {
          addTitle, addScript, addIsPublic, addCategory, parsedBlocks, validationIssues,
          processState, validationChanges, storeCoverUrl, storeCoverPrompt, storeSummary,
          characterAvatars, characterTypes, castProfiles, scriptLanguage,
        };
        localStorage.setItem(ADD_STORY_DRAFT_KEY, JSON.stringify(draft));
      } catch {
        // localStorage full/unavailable — draft persistence is best-effort
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [
    addTitle, addScript, addIsPublic, addCategory, parsedBlocks, validationIssues,
    processState, validationChanges, storeCoverUrl, storeCoverPrompt, storeSummary,
    characterAvatars, characterTypes, castProfiles, scriptLanguage,
  ]);

  // ── Classics list ─────────────────────────────────────────────────────────
  const [classics, setClassics]         = useState<ClassicMeta[]>([]);
  const [classicsLoading, setClassicsLoading] = useState(true);

  const loadClassics = useCallback(() => {
    fetch("/api/classics", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setClassics(d as ClassicMeta[]); })
      .catch(() => {})
      .finally(() => setClassicsLoading(false));
  }, []);

  useEffect(() => { loadClassics(); }, [loadClassics]);

  // ── Cost analysis ─────────────────────────────────────────────────────────
  const [costData, setCostData]           = useState<CostData | null>(null);
  const [costLoading, setCostLoading]     = useState(false);
  const [libraryData, setLibraryData]     = useState<LibraryCostData | null>(null);
  const [libraryLoading, setLibraryLoading] = useState(false);

  const loadCostAnalysis = useCallback(() => {
    setCostLoading(true);
    fetch("/api/admin/cost-analysis", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setCostData(d as CostData))
      .catch(() => {})
      .finally(() => setCostLoading(false));
  }, []);

  const loadLibraryAnalysis = useCallback(() => {
    setLibraryLoading(true);
    fetch("/api/admin/cost-analysis/library", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setLibraryData(d as LibraryCostData))
      .catch(() => {})
      .finally(() => setLibraryLoading(false));
  }, []);

  // Job polling
  useEffect(() => {
    if (!jobId) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/drama-status/${jobId}`, { cache: "no-store" });
        if (!res.ok) return;
        const j = await res.json() as { status: string; step: string; progress: number; audioUrl?: string; coverUrl?: string; error?: string; libraryError?: string; title?: string; voiceAssignments?: Record<string, string>; storyId?: string };
        setJob(j);
        if (j.status === "done" || j.status === "error") {
          clearInterval(pollRef.current!);
          setAddProducing(false);
          if (j.status === "done") loadClassics();
        }
      } catch {}
    }, 2500);
    return () => clearInterval(pollRef.current!);
  }, [jobId, loadClassics]);

  // Load voice pool + avatar bank once
  useEffect(() => {
    fetchVoicePool().then(setVoicePool);
    fetchBankAvatars().then(setBankAvatars);
  }, []);

  // ── Cast handlers ─────────────────────────────────────────────────────────
  const handleVoiceChangeForChar = useCallback((characterName: string, voiceId: string) => {
    setParsedBlocks((prev) => prev.map((b) =>
      b.characterName === characterName ? { ...b, assignedVoiceId: voiceId } : b,
    ));
  }, []);

  const handleAvatarChange = useCallback((characterName: string, url: string, type: CharacterType) => {
    setCharacterAvatars((prev) => ({ ...prev, [characterName]: url }));
    setCharacterTypes((prev) => ({ ...prev, [characterName]: type }));
    setOpenDirectSheet(null);
  }, []);

  // ── Script parser ─────────────────────────────────────────────────────────
  const CHAR_VOICE_POOL = ["Puck", "Kore", "Charon", "Fenrir", "Leda", "Orus", "Zephyr", "Autonoe"];
  function parseScriptText(raw: string): ScriptBlock[] {
    const lines = raw.split("\n").map((l) => l.trim()).filter((l) => l);
    const out: ScriptBlock[] = [];
    const voiceMap: Record<string, string> = {};
    let voiceIdx = 0;
    for (const line of lines) {
      // First [...] on the line is the character/SFX tag; everything after is textPayload
      const m = line.match(/^\[([^\]]+)\](.*)/);
      if (m) {
        const charName = m[1].trim();
        const rest = m[2].trim();
        if (charName.startsWith("SFX")) {
          // Store entire original bracket as textPayload so validate-script sees the full SFX block
          const textPayload = `[${charName}]${rest ? " " + rest : ""}`;
          out.push({ id: uid(), blockOrder: out.length, characterName: "SFX", assignedVoiceId: "", textPayload });
        } else {
          if (!voiceMap[charName]) {
            // Cosmetic only — the cast sheet's preview badge before Produce
            // Story runs. Actual narration always uses the profile's default
            // (see runProduction's narratorVoiceId override), regardless of
            // what's parsed here.
            voiceMap[charName] = charName.toLowerCase() === "narrator"
              ? getNarratorVoiceId()
              : CHAR_VOICE_POOL[voiceIdx++ % CHAR_VOICE_POOL.length];
          }
          // rest may already be the full spoken text ("[Name] text"), just a
          // performance tag with the dialogue on the next line(s) ("[Name]
          // [gently]"), or empty (name-only cue line) — any non-bracket
          // lines that follow are appended below as continued dialogue, so
          // multi-line pasted scripts don't silently lose their text.
          out.push({ id: uid(), blockOrder: out.length, characterName: charName, assignedVoiceId: voiceMap[charName], textPayload: rest });
        }
      } else if (out.length > 0 && out[out.length - 1].characterName !== "SFX") {
        const last = out[out.length - 1];
        last.textPayload = last.textPayload ? `${last.textPayload} ${line}` : line;
      }
    }
    // Drop cue-only blocks that never picked up any spoken text (e.g. a
    // trailing name/tag line with nothing after it in the pasted script).
    return out
      .filter((b) => b.characterName === "SFX" || b.textPayload.replace(/^\[[^\]]+\]\s*/, "").trim())
      .map((b, i) => ({ ...b, blockOrder: i }));
  }

  // Story-meta returns a range like "4-6"; validate-blocks wants a single
  // representative age — the midpoint reads closest to "who this is for".
  function ageGroupToAge(ageGroup?: string): number {
    const m = ageGroup?.match(/(\d+)-(\d+)/);
    if (!m) return 6;
    return Math.round((Number(m[1]) + Number(m[2])) / 2);
  }

  // ── Process Script ─────────────────────────────────────────────────────────
  const handleProcessScript = async () => {
    if (!addScript.trim()) return;
    setProcessState("processing");
    setProcessError("");
    setValidationIssues([]);
    setValidationChanges(0);
    setStoreCoverUrl(""); setStoreCoverPrompt(""); setStoreSummary("");
    const blocks = parseScriptText(addScript);
    if (!blocks.length) {
      setProcessState("error");
      setProcessError("Could not parse any blocks. Use [Character Name] to mark each speaker.");
      return;
    }
    setParsedBlocks(blocks);

    // Auto-assign avatars from bank for all cast members. Fetch the bank
    // fresh here rather than trusting the `bankAvatars` state var — that's
    // only populated by a mount-time effect, and pasting a script + hitting
    // Process before that fetch resolves silently left it as `[]`, which
    // made pickBankAvatar fall through to a generic DiceBear icon for
    // every character with no error or retry.
    const uniqueChars = Array.from(new Set(blocks.filter((b) => b.characterName !== "SFX").map((b) => b.characterName)));
    const freshBankAvatars = bankAvatars.length > 0 ? bankAvatars : await fetchBankAvatars();
    if (freshBankAvatars !== bankAvatars) setBankAvatars(freshBankAvatars);
    const autoAvatars: Record<string, string> = {};
    const autoTypes: Record<string, CharacterType> = {};
    for (const char of uniqueChars) {
      const type: CharacterType = char.toLowerCase() === "narrator" ? "narrator" : "adult";
      autoTypes[char] = type;
      autoAvatars[char] = pickBankAvatar(char, type, freshBankAvatars);
    }
    setCharacterAvatars(autoAvatars);
    setCharacterTypes(autoTypes);

    const rawBlocks = blocks.map((b) => ({ characterName: b.characterName, textPayload: b.textPayload }));

    // Same two-pass verification the normal generation flow (Studio's
    // handleGenerate) runs on every freshly-written script before showing it
    // to the user — Round 2 is a policy/guidance check, Round 2.5 is a
    // per-block age-appropriateness + typo/grammar pass. An admin-pasted
    // script skipped both before; now it goes through the identical checks,
    // with corrections actually applied rather than only shown as advisory.
    setProcessPhase("Checking policy…");
    const [valRes, metaRes] = await Promise.all([
      fetch("/api/validate-script", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ blocks: rawBlocks }) }),
      fetch("/api/admin/story-meta", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ blocks: rawBlocks, title: addTitle }) }),
    ]);
    const [valData, metaData] = await Promise.all([valRes.json(), metaRes.json()]) as [
      { ok: boolean; issues?: string[]; blocks?: { characterName: string; textPayload: string }[] },
      { summary?: string; coverPrompt?: string; ageGroup?: string }
    ];
    if (!valData.ok && Array.isArray(valData.issues)) setValidationIssues(valData.issues);

    // Round 2 — apply the policy-corrected text, merged back into the full
    // ScriptBlock objects (validate-script only returns characterName +
    // textPayload, so a blind replace would drop id/blockOrder/assignedVoiceId).
    const policyShapeOk = Array.isArray(valData.blocks) && valData.blocks.length === blocks.length;
    let policyBlocks: ScriptBlock[] = policyShapeOk
      ? blocks.map((b, i) => ({ ...b, textPayload: valData.blocks![i].textPayload }))
      : blocks;
    if (!policyShapeOk && valData.blocks) {
      console.warn("[Admin][Validation] validate-script returned unexpected shape — using unpolicy-checked script");
    }

    const coverPrompt = metaData.coverPrompt ?? `${addTitle || "Story"} — magical Pixar-style children's bedtime illustration`;
    const summary     = metaData.summary ?? "";
    const age         = ageGroupToAge(metaData.ageGroup);
    setStoreSummary(summary); setStoreCoverPrompt(coverPrompt);

    // Round 2.5 — per-block age-appropriateness + typo/grammar check, run
    // alongside AI cast classification (same classify-characters call
    // handleProduceStory used to run alone, right before production) — both
    // only need policyBlocks/summary, so there's no reason to serialize them.
    // Classifying here means the Direction Sheet's Auto Assign buttons (both
    // voice and avatar) have real nature profiles to match against as soon as
    // the admin opens the cast sheet, instead of only at production time.
    setProcessPhase("Checking grammar, typos & casting…");
    let finalBlocks = policyBlocks;
    const [gramResult, classifyResult] = await Promise.allSettled([
      fetch("/api/validate-blocks", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks: policyBlocks, age, summary }),
      }).then((r) => r.json()) as Promise<{ blocks?: ScriptBlock[]; changes?: number }>,
      fetch("/api/classify-characters", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characters: uniqueChars, summary: summary || addTitle }),
      }).then((r) => r.json()) as Promise<Record<string, CharacterClassification>>,
    ]);

    if (gramResult.status === "fulfilled" && gramResult.value.blocks?.length === policyBlocks.length) {
      finalBlocks = gramResult.value.blocks;
      setValidationChanges(gramResult.value.changes ?? 0);
    } else if (gramResult.status === "rejected") {
      console.warn("[Admin][Validation] Grammar/age check failed, using policy-checked script:", gramResult.reason);
    }

    if (classifyResult.status === "fulfilled") {
      const profiles: Record<string, CharacterProfile> = {};
      const types: Record<string, CharacterType> = {};
      for (const [name, c] of Object.entries(classifyResult.value)) {
        types[name] = c.type as CharacterType;
        profiles[name] = {
          type: c.type as CharacterProfile["type"],
          visualDescription: c.visualDescription,
          gender: c.gender as CharacterProfile["gender"],
          ageBucket: c.ageBucket,
          category: c.category,
        };
      }
      setCharacterTypes((prev) => ({ ...prev, ...types }));
      setCastProfiles(profiles);

      // parseScriptText's assignedVoiceId is a blind round-robin placeholder
      // (see its own comment above) with zero regard for gender or nature —
      // whichever voice the character's position in the script happened to
      // land on. Now that real classification is in, replace it with a
      // proper nature-based pick for every character, so a hard gender
      // mismatch (e.g. a fairy landing on a voice explicitly labeled
      // masculine) doesn't silently survive all the way to production
      // unless the admin also happens to click Auto Assign per character.
      const usedVoiceIds = new Set<string>();
      const voiceByChar: Record<string, string> = {};
      for (const name of uniqueChars) {
        const picked = pickBestVoiceForCharacter(profiles[name], undefined, usedVoiceIds);
        if (picked) {
          voiceByChar[name] = picked;
          usedVoiceIds.add(picked);
        }
      }
      finalBlocks = finalBlocks.map((b) =>
        voiceByChar[b.characterName] ? { ...b, assignedVoiceId: voiceByChar[b.characterName] } : b
      );

      // Avatars had the exact same problem voices just had, and for the
      // same reason: the automatic pass right after Process Script (above,
      // before classification existed yet) only knows character NAMES, so
      // it hardcodes type "adult" for everyone non-narrator and hash-picks
      // blindly — a child or animal character gets a mismatched adult bank
      // avatar until the admin manually clicks Auto Assign per character.
      // Now that real classification (type/gender/look) is in, re-pick
      // every character's avatar the same way that manual button does
      // (POST /api/match-avatar with the real profile) instead of leaving
      // the earlier blind pick in place. Sequential, not parallel, so each
      // pick can exclude every avatar already claimed by an earlier
      // character in this same loop — otherwise two characters could
      // independently land on the same face.
      const usedAvatarUrls = new Set<string>();
      const avatarByChar: Record<string, string> = {};
      for (const name of uniqueChars) {
        try {
          const res = await fetch("/api/match-avatar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ profile: profiles[name], excludeUrls: Array.from(usedAvatarUrls) }),
          });
          const data = await res.json() as { avatarUrl?: string | null };
          if (data.avatarUrl) {
            avatarByChar[name] = data.avatarUrl;
            usedAvatarUrls.add(data.avatarUrl);
          }
        } catch {
          // keep the earlier pickBankAvatar guess for this character
        }
      }
      if (Object.keys(avatarByChar).length > 0) {
        setCharacterAvatars((prev) => ({ ...prev, ...avatarByChar }));
      }
    } else {
      console.warn("[Admin][Validation] Character classification failed — Auto Assign will retry it at Produce Story:", classifyResult.reason);
    }

    // Strip a redundant "CharacterName:" prefix some pasted/generated scripts
    // bake into the line itself — same cleanup the normal flow applies.
    finalBlocks = finalBlocks.map((b) => ({ ...b, textPayload: stripNamePrefix(b.characterName, b.textPayload) }));

    // Hebrew-only: same final letter-consistency pass generate-story and
    // five-question-story run automatically — repairs any word where a
    // couple of mid-word Hebrew letters were accidentally rendered in Latin
    // script (see config/hebrew-letter-check.txt), which would otherwise
    // mispronounce through TTS. An admin-pasted script has no language field
    // of its own, so detect it from the finished text first — reused below
    // for Auto Assign's voice matching too.
    setProcessPhase("Checking Hebrew lettering…");
    let detectedLanguage = scriptLanguage;
    try {
      const langRes = await fetch("/api/detect-language", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ blocks: finalBlocks }),
      });
      const langData = await langRes.json() as { language?: string };
      if (langData.language) { setScriptLanguage(langData.language); detectedLanguage = langData.language; }
      if (langData.language === "he") {
        const hebRes = await fetch("/api/fix-hebrew-mixup", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ blocks: finalBlocks }),
        });
        const hebData = await hebRes.json() as { blocks?: ScriptBlock[] };
        if (hebData.blocks?.length === finalBlocks.length) finalBlocks = hebData.blocks;
      }
    } catch (err) {
      console.warn("[Admin][Validation] Hebrew letter check failed, using script unchanged:", err);
    }

    setParsedBlocks(finalBlocks);

    setProcessPhase("");
    setProcessState("done");

    // Seed the production_metrics `script_done` row once per add-story session,
    // mirroring what /api/library's POST does for Studio's flow. Without this,
    // ProductionTimer.flush (perfMetrics.ts) never finds an existing row to
    // update in place, so every Produce click here inserted a fresh, orphaned
    // row instead of updating one through the script_done → done lifecycle.
    const scriptDoneId = addStoryId || crypto.randomUUID();
    if (!addStoryId) setAddStoryId(scriptDoneId);
    void fetch("/api/admin/mark-script-done", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storyId: scriptDoneId,
        title: addTitle,
        language: detectedLanguage,
        dialogueCount: finalBlocks.filter((b) => b.characterName !== "SFX").length,
        sfxCount: finalBlocks.filter((b) => b.characterName === "SFX").length,
      }),
    }).catch((err) => console.warn("[Admin] mark-script-done failed:", err));

    // Fetch cover image in the background (non-blocking)
    setStoreCoverLoading(true);
    fetch("/api/generate-cover", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: coverPrompt, summary }) })
      .then((r) => r.json())
      .then((d: { coverUrl?: string }) => setStoreCoverUrl(d.coverUrl ?? ""))
      .catch(() => {})
      .finally(() => setStoreCoverLoading(false));
  };

  // ── Produce Story ──────────────────────────────────────────────────────────
  const handleProduceStory = async () => {
    const blocks = parsedBlocks.filter((b) => b.textPayload.trim());
    if (!addTitle.trim()) { setAddProduceError("Title is required."); return; }
    if (!blocks.length)  { setAddProduceError("Process the script first."); return; }
    setAddProducing(true);
    setAddProduceLog([]);
    setAddProduceError("");
    setAddSaved(false); setAddSaveError("");
    setJob(null);
    setJobId(null);
    const log = (msg: string) => setAddProduceLog((p) => [...p, msg]);
    try {
      // 1. Classify characters — same AI classifier the normal new-story flow
      // uses (classify-characters wraps classifyCharacters directly), and
      // its response is the classification map itself, flat, keyed by
      // character name -- NOT nested under a "types" field. Both the coarse
      // type (for voice casting) and the full profile (type/gender/ageBucket/
      // category/visualDescription, for AI avatar matching in produce-drama)
      // come from this single call. Process Script already ran this once (to
      // feed the Direction Sheet's Auto Assign buttons) — reuse castProfiles
      // if it covers the full cast rather than paying for a second call, and
      // only fall back to a fresh classification if it's missing anyone.
      const charNames = Array.from(new Set(blocks.map((b) => b.characterName)));
      const characterTypes: Record<string, string> = {};
      const characterProfiles: Record<string, CharacterProfile> = {};
      const missingProfiles = charNames.filter((n) => !castProfiles[n]);
      if (missingProfiles.length === 0) {
        for (const name of charNames) {
          characterProfiles[name] = castProfiles[name];
          characterTypes[name] = castProfiles[name].type;
        }
      } else {
        log("Classifying characters…");
        const classifyRes = await fetch("/api/classify-characters", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ characters: charNames, summary: storeSummary || addTitle }),
        });
        const classification = await classifyRes.json() as Record<string, CharacterClassification>;
        for (const [name, c] of Object.entries(classification)) {
          characterTypes[name] = c.type;
          characterProfiles[name] = {
            type: c.type as CharacterProfile["type"],
            visualDescription: c.visualDescription,
            gender: c.gender as CharacterProfile["gender"],
            ageBucket: c.ageBucket,
            category: c.category,
          };
        }
      }

      // 2. Kick off production — use pre-generated cover if available
      log("Starting production (audio + cover)…");
      const coverMatch = storeCoverUrl.match(/^data:([^;]+);base64,(.+)$/);
      const produceBody: Record<string, unknown> = {
        blocks,
        title: addTitle.trim(),
        summary: storeSummary || "",
        isPublic: addIsPublic,
        isClassic: addIsPublic && addCategory === "classics",
        characterTypes,
        // Lets produce-drama run the same AI avatar-bank matching
        // (findBestAvatarForCharacter) the normal generation flow gets —
        // without this, admin-added stories silently fell back to a blind
        // hash-based avatar pick instead of a real profile match.
        characterProfiles,
        durationMinutes: 5,
        skipLibrarySave: true,
        // Reuse the id seeded by mark-script-done at Process Script time so
        // ProductionTimer.flush updates that same production_metrics row
        // in place instead of inserting a fresh orphaned one on every
        // Produce click (including re-produces after a director's note).
        editingStoryId: addStoryId || crypto.randomUUID(),
      };
      if (coverMatch) {
        produceBody.coverImageMimeType = coverMatch[1];
        produceBody.coverImageData     = coverMatch[2];
      } else {
        produceBody.coverPrompt = storeCoverPrompt || `${addTitle} — magical Pixar-style children's bedtime illustration`;
      }

      const produceRes = await fetch("/api/produce-drama", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(produceBody),
      });
      const produceData = await produceRes.json() as { jobId?: string; error?: string };
      if (!produceRes.ok) throw new Error(produceData.error ?? "Production failed");
      setJobId(produceData.jobId!);
      log("Production running — see progress below…");
    } catch (e) {
      setAddProduceError(e instanceof Error ? e.message : "Unknown error");
      setAddProducing(false);
    }
  };

  // ── Explicit DB save ───────────────────────────────────────────────────────
  const handleSaveStory = async () => {
    if (!jobId) return;
    setAddSaving(true); setAddSaveError(""); setEpisodeAssignLog(null);
    try {
      const res = await fetch("/api/admin/save-story", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      const d = await res.json() as { ok?: boolean; error?: string; storyId?: string };
      if (!res.ok) throw new Error(d.error ?? "Save failed");
      setAddSaved(true);

      // If this story was set up as an episode of a series, link it now that
      // it actually has a row in `stories` to link — copies the series' cover
      // + cast (avatar/voice per matching character name) onto it and stamps
      // series_id/chapter_number/chapter_count.
      const chapterNumber = Number(episodeChapterNumber);
      if (addAsEpisode && episodeSeriesAnchorId && d.storyId && Number.isInteger(chapterNumber) && chapterNumber >= 1) {
        setEpisodeAssignLog({ type: "info", text: "Linking to series — copying cover, avatars, and voices…" });
        try {
          const assignRes = await fetch("/api/admin/assign-to-series", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ storyId: d.storyId, seriesAnchorId: episodeSeriesAnchorId, chapterNumber }),
          });
          const assignData = await assignRes.json().catch(() => ({}));
          if (!assignRes.ok) {
            setEpisodeAssignLog({ type: "error", text: `Story saved, but series linking failed: ${assignData.error ?? assignRes.statusText}` });
          } else {
            setEpisodeAssignLog({
              type: "success",
              text: `✅ Added as Chapter ${assignData.chapterNumber} — series now has ${assignData.chapterCount} chapters. Cast matched: ${assignData.castMatched}/${assignData.castTotal} character(s).`,
            });
            fetch("/api/admin/list-all-stories").then((r) => r.json()).then((list) => { if (Array.isArray(list)) setSeriesStoryList(list); }).catch(() => {});
          }
        } catch (e) {
          setEpisodeAssignLog({ type: "error", text: `Story saved, but series linking failed: ${e instanceof Error ? e.message : String(e)}` });
        }
      }
    } catch (e) {
      setAddSaveError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setAddSaving(false);
    }
  };

  const resetAddStory = () => {
    setAddTitle(""); setAddScript(""); setAddIsPublic(true); setAddCategory("classics");
    setParsedBlocks([]); setValidationIssues([]);
    setProcessState("idle"); setProcessError(""); setAddProduceLog([]);
    setAddProducing(false); setAddProduceError(""); setJobId(null); setJob(null);
    setStoreCoverUrl(""); setStoreCoverLoading(false); setStoreCoverPrompt(""); setStoreSummary("");
    setAddSaving(false); setAddSaveError(""); setAddSaved(false);
    setCharacterAvatars({}); setOpenDirectSheet(null); setCharacterTypes({});
    setCastProfiles({}); setScriptLanguage("en");
    setAddAsEpisode(false); setEpisodeSeriesAnchorId(""); setEpisodeChapterNumber(""); setEpisodeAssignLog(null);
    setAddStoryId("");
    try { localStorage.removeItem(ADD_STORY_DRAFT_KEY); } catch { /* best-effort */ }
  };

  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (dataUrl) setStoreCoverUrl(dataUrl);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleRegenerateCover = async () => {
    if (!storeCoverPrompt) return;
    setStoreCoverUrl(""); setStoreCoverLoading(true);
    try {
      const res = await fetch("/api/generate-cover", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: storeCoverPrompt, summary: storeSummary }),
      });
      const d = await res.json() as { coverUrl?: string };
      setStoreCoverUrl(d.coverUrl ?? "");
    } catch { /* silent */ }
    setStoreCoverLoading(false);
  };

  // ── Auth gate ──────────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="cosmic-page min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "#4fc3f7 transparent transparent transparent" }} />
      </div>
    );
  }
  if (!user || user.email !== ADMIN_EMAIL) {
    return (
      <div className="cosmic-page min-h-screen flex flex-col items-center justify-center gap-3 text-center px-8">
        <span className="text-5xl">🔐</span>
        <p className="text-white/40 text-fs-body">Admin access only</p>
      </div>
    );
  }

  const isDone  = job?.status === "done";
  const isError = job?.status === "error";
  const CAST_COLORS = ["#4fc3f7", "#a78bfa", "#fbbf24", "#f87171", "#34d399", "#fb923c"];

  const [adminTab, setAdminTab] = useState<"factory" | "costs" | "services">("factory");

  // ── Admin Services: SFX cache update ─────────────────────────────────────
  const [sfxRunning, setSfxRunning] = useState(false);
  const [sfxProgress, setSfxProgress] = useState(0);
  const [sfxLog, setSfxLog] = useState<Array<{ type: "info" | "error" | "success"; text: string }>>([]);

  const handleUpdateSfxCache = async () => {
    setSfxRunning(true);
    setSfxProgress(10);
    setSfxLog([{ type: "info", text: "Scanning story_elements for SFX entries…" }]);
    try {
      setSfxProgress(30);
      const res = await fetch("/api/admin/seed-sfx-library", { method: "POST" });
      setSfxProgress(90);
      if (!res.ok) {
        const { error } = await res.json() as { error?: string };
        setSfxLog((l) => [...l, { type: "error", text: `Server error: ${error ?? res.statusText}` }]);
      } else {
        const data = await res.json() as { total: number; seeded: number; skipped: number; alreadyInLibrary: number };
        setSfxLog((l) => [
          ...l,
          { type: "success", text: `✅ Done — ${data.seeded} new SFX added to cache (${data.skipped} skipped, ${data.alreadyInLibrary} already stored, ${data.total} unique descriptions total)` },
        ]);
      }
    } catch (e) {
      setSfxLog((l) => [...l, { type: "error", text: `Network error: ${e instanceof Error ? e.message : String(e)}` }]);
    } finally {
      setSfxProgress(100);
      setSfxRunning(false);
    }
  };

  // ── Admin Services: Reassign cast voices (nature-based matching) ─────────
  const [reassignStoryId, setReassignStoryId] = useState("");
  const [reassignRunning, setReassignRunning] = useState(false);
  const [reassignLog, setReassignLog] = useState<Array<{ type: "info" | "error" | "success"; text: string }>>([]);

  const runReassignVoices = async (body: { storyId?: string } | { applyAll: true }) => {
    setReassignRunning(true);
    setReassignLog([{ type: "info", text: "applyAll" in body ? "Scanning every story in the library…" : `Reassigning story ${(body as { storyId: string }).storyId}…` }]);
    try {
      // narratorVoiceId comes from this browser's own default-narrator setting —
      // there's no per-family preference persisted server-side, so the Narrator
      // in every reassigned story gets whichever voice is set here.
      const res = await fetch("/api/admin/reassign-voices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, narratorVoiceId: getNarratorVoiceId() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setReassignLog((l) => [...l, { type: "error", text: `Server error: ${data.error ?? res.statusText}` }]);
        return;
      }
      const d = data as { totalStories: number; storiesChanged: number; storiesSkipped: number; totalBlocksChanged: number; results: Array<{ storyId: string; title: string; blocksChanged: number; skippedReason?: string }> };
      setReassignLog((l) => [
        ...l,
        { type: "success", text: `✅ Done — ${d.storiesChanged}/${d.totalStories} stories updated, ${d.totalBlocksChanged} block${d.totalBlocksChanged === 1 ? "" : "s"} recast (${d.storiesSkipped} skipped — no script blocks)` },
        ...d.results.filter((r) => r.blocksChanged > 0).map((r) => ({ type: "info" as const, text: `  · "${r.title}" — ${r.blocksChanged} block(s) recast` })),
      ]);
    } catch (e) {
      setReassignLog((l) => [...l, { type: "error", text: `Network error: ${e instanceof Error ? e.message : String(e)}` }]);
    } finally {
      setReassignRunning(false);
    }
  };

  const handleReassignOneStory = () => {
    if (!reassignStoryId.trim()) return;
    runReassignVoices({ storyId: reassignStoryId.trim() });
  };

  const handleReassignAllStories = () => {
    if (!confirm("Reassign cast voices for EVERY story in the library (public + private)? This only updates each block's assigned voice id — already-produced audio is unaffected until the story is re-produced.")) return;
    runReassignVoices({ applyAll: true });
  };

  // ── Admin Services: Reassign cast avatars (profile-based matching) ───────
  const [reassignAvatarStoryId, setReassignAvatarStoryId] = useState("");
  const [reassignAvatarRunning, setReassignAvatarRunning] = useState(false);
  const [reassignAvatarLog, setReassignAvatarLog] = useState<Array<{ type: "info" | "error" | "success"; text: string }>>([]);

  const runReassignAvatars = async (body: { storyId?: string } | { applyAll: true }) => {
    setReassignAvatarRunning(true);
    setReassignAvatarLog([{ type: "info", text: "applyAll" in body ? "Scanning every story in the library…" : `Reassigning story ${(body as { storyId: string }).storyId}…` }]);
    try {
      const res = await fetch("/api/admin/reassign-avatars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setReassignAvatarLog((l) => [...l, { type: "error", text: `Server error: ${data.error ?? res.statusText}` }]);
        return;
      }
      const d = data as { totalStories: number; storiesChanged: number; storiesSkipped: number; totalAvatarsChanged: number; results: Array<{ storyId: string; title: string; avatarsChanged: number; skippedReason?: string }> };
      setReassignAvatarLog((l) => [
        ...l,
        { type: "success", text: `✅ Done — ${d.storiesChanged}/${d.totalStories} stories updated, ${d.totalAvatarsChanged} avatar${d.totalAvatarsChanged === 1 ? "" : "s"} rematched (${d.storiesSkipped} skipped — no character profiles)` },
        ...d.results.filter((r) => r.avatarsChanged > 0).map((r) => ({ type: "info" as const, text: `  · "${r.title}" — ${r.avatarsChanged} avatar(s) rematched` })),
      ]);
    } catch (e) {
      setReassignAvatarLog((l) => [...l, { type: "error", text: `Network error: ${e instanceof Error ? e.message : String(e)}` }]);
    } finally {
      setReassignAvatarRunning(false);
    }
  };

  const handleReassignOneStoryAvatars = () => {
    if (!reassignAvatarStoryId.trim()) return;
    runReassignAvatars({ storyId: reassignAvatarStoryId.trim() });
  };

  const handleReassignAllStoriesAvatars = () => {
    if (!confirm("Reassign cast avatars for EVERY story in the library (public + private)? This only updates each character profile's matched avatar — already-rendered pages just need a reload to pick it up.")) return;
    runReassignAvatars({ applyAll: true });
  };

  // ── Admin Services: Backfill character profiles (pre-existing stories) ──
  const [backfillStoryId, setBackfillStoryId] = useState("");
  const [backfillRunning, setBackfillRunning] = useState(false);
  const [backfillLog, setBackfillLog] = useState<Array<{ type: "info" | "error" | "success"; text: string }>>([]);

  const runBackfillCharacterProfiles = async (body: { storyId?: string } | { applyAll: true }) => {
    setBackfillRunning(true);
    setBackfillLog([{ type: "info", text: "applyAll" in body ? "Scanning every produced story in the library…" : `Backfilling story ${(body as { storyId: string }).storyId}…` }]);
    try {
      const res = await fetch("/api/admin/backfill-character-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setBackfillLog((l) => [...l, { type: "error", text: `Server error: ${data.error ?? res.statusText}` }]);
        return;
      }
      const d = data as { totalStories: number; storiesBackfilled: number; storiesSkipped: number; results: Array<{ storyId: string; title: string; charactersProfiled: number; skippedReason?: string }> };
      setBackfillLog((l) => [
        ...l,
        { type: "success", text: `✅ Done — ${d.storiesBackfilled}/${d.totalStories} stories backfilled (${d.storiesSkipped} skipped)` },
        ...d.results.filter((r) => r.charactersProfiled > 0).map((r) => ({ type: "info" as const, text: `  · "${r.title}" — ${r.charactersProfiled} character(s) profiled` })),
        ...d.results.filter((r) => r.skippedReason && r.skippedReason !== "no audio yet" && r.skippedReason !== "already has character profile data").map((r) => ({ type: "error" as const, text: `  · "${r.title}" — ${r.skippedReason}` })),
      ]);
    } catch (e) {
      setBackfillLog((l) => [...l, { type: "error", text: `Network error: ${e instanceof Error ? e.message : String(e)}` }]);
    } finally {
      setBackfillRunning(false);
    }
  };

  const handleBackfillOneStory = () => {
    if (!backfillStoryId.trim()) return;
    runBackfillCharacterProfiles({ storyId: backfillStoryId.trim() });
  };

  const handleBackfillAllStories = () => {
    if (!confirm("Backfill character profiles for EVERY produced story missing them (public + private)? Stories with no audio yet are skipped. This calls Gemini once per story that needs it.")) return;
    runBackfillCharacterProfiles({ applyAll: true });
  };

  // ── Admin Services: Regenerate scene maps ────────────────────────────────
  const [regenSceneStoryId, setRegenSceneStoryId] = useState("");
  const [regenSceneRunning, setRegenSceneRunning] = useState(false);
  const [regenSceneLog, setRegenSceneLog] = useState<Array<{ type: "info" | "error" | "success"; text: string }>>([]);

  const runRegenerateScenes = async (body: { storyId?: string } | { applyAll: true }) => {
    setRegenSceneRunning(true);
    setRegenSceneLog([{ type: "info", text: "applyAll" in body ? "Scanning every story in the library…" : `Regenerating scene map for story ${(body as { storyId: string }).storyId}…` }]);
    try {
      const res = await fetch("/api/admin/regenerate-scenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setRegenSceneLog((l) => [...l, { type: "error", text: `Server error: ${data.error ?? res.statusText}` }]);
        return;
      }
      const d = data as { totalStories: number; storiesUpdated: number; storiesSkipped: number; results: Array<{ storyId: string; title: string; sceneCount: number; skippedReason?: string }> };
      setRegenSceneLog((l) => [
        ...l,
        { type: "success", text: `✅ Done — ${d.storiesUpdated}/${d.totalStories} stories updated (${d.storiesSkipped} skipped)` },
        ...d.results.filter((r) => r.sceneCount > 0).map((r) => ({ type: "info" as const, text: `  · "${r.title}" — ${r.sceneCount} scene(s)` })),
        ...d.results.filter((r) => r.skippedReason).map((r) => ({ type: "error" as const, text: `  · "${r.title}" — skipped: ${r.skippedReason}` })),
      ]);
    } catch (e) {
      setRegenSceneLog((l) => [...l, { type: "error", text: `Network error: ${e instanceof Error ? e.message : String(e)}` }]);
    } finally {
      setRegenSceneRunning(false);
    }
  };

  const handleRegenerateOneStory = () => {
    if (!regenSceneStoryId.trim()) return;
    runRegenerateScenes({ storyId: regenSceneStoryId.trim() });
  };

  const handleRegenerateAllStories = () => {
    if (!confirm("Regenerate the scene map for EVERY story in the library (public + private)? Each story requires a fresh Gemini call — this may take a while for a large library.")) return;
    runRegenerateScenes({ applyAll: true });
  };

  // ── Admin Services: Refresh story policies (cast/voices, lessons, scenes, summary) ──
  const [refreshQuery, setRefreshQuery] = useState("");
  const [refreshRunning, setRefreshRunning] = useState(false);
  const [refreshLog, setRefreshLog] = useState<Array<{ type: "info" | "error" | "success"; text: string }>>([]);

  const runRefreshStory = async (body: { storyId: string } | { title: string } | { applyAll: true }) => {
    setRefreshRunning(true);
    setRefreshLog([{
      type: "info",
      text: "applyAll" in body ? "Scanning every story in the library…"
        : "title" in body ? `Searching for stories matching "${body.title}"…`
        : `Refreshing story ${body.storyId}…`,
    }]);
    try {
      const res = await fetch("/api/admin/refresh-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, narratorVoiceId: getNarratorVoiceId() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRefreshLog((l) => [...l, { type: "error", text: `Server error: ${data.error ?? res.statusText}` }]);
        return;
      }
      const d = data as {
        totalStories: number; storiesRefreshed: number; storiesFailed: number;
        results: Array<{ storyId: string; title: string; status: "ok" | "error"; changes?: { voicesRecast: number; lessonCount: number; sceneCount: number }; error?: string }>;
      };
      setRefreshLog((l) => [
        ...l,
        { type: "success", text: `✅ Done — ${d.storiesRefreshed}/${d.totalStories} stories refreshed (${d.storiesFailed} failed)` },
        ...d.results.filter((r) => r.status === "ok").map((r) => ({
          type: "info" as const,
          text: `  · "${r.title}" — ${r.changes?.voicesRecast ?? 0} voice(s) recast, ${r.changes?.lessonCount ?? 0} lesson(s), ${r.changes?.sceneCount ?? 0} scene(s)`,
        })),
        ...d.results.filter((r) => r.status === "error").map((r) => ({ type: "error" as const, text: `  · "${r.title}" (${r.storyId}) — ${r.error}` })),
      ]);
    } catch (e) {
      setRefreshLog((l) => [...l, { type: "error", text: `Network error: ${e instanceof Error ? e.message : String(e)}` }]);
    } finally {
      setRefreshRunning(false);
    }
  };

  const handleRefreshById = () => {
    if (!refreshQuery.trim()) return;
    runRefreshStory({ storyId: refreshQuery.trim() });
  };

  const handleRefreshByTitle = () => {
    if (!refreshQuery.trim()) return;
    runRefreshStory({ title: refreshQuery.trim() });
  };

  const handleRefreshAllStories = () => {
    if (!confirm("Refresh cast/voices, lessons, scenes, and summary for EVERY story in the library (public + private)? This never touches script text, cover image, or audio. Each story requires 4 fresh Gemini calls — this may take a while for a large library.")) return;
    runRefreshStory({ applyAll: true });
  };

  // ── Add Story: "episode of a series" option ─────────────────────────────────
  // Fetched once, reused by the Add Story series picker (see the "Series"
  // toggle in the Visibility section) to know every existing story + which
  // series each already belongs to.
  const [seriesStoryList, setSeriesStoryList] = useState<AdminStoryOption[]>([]);
  useEffect(() => {
    fetch("/api/admin/list-all-stories").then((r) => r.json()).then((data) => {
      if (Array.isArray(data)) setSeriesStoryList(data);
    }).catch(() => {});
  }, []);

  const episodeAnchorEntry = seriesStoryList.find((s) => s.id === episodeSeriesAnchorId);
  const episodeAnchorChapters = episodeAnchorEntry
    ? seriesStoryList.filter((s) => s.seriesId && s.seriesId === episodeAnchorEntry.seriesId)
    : [];

  // Once a series + chapter number are picked, the title isn't the admin's
  // to type — it's always "{series base name} - Chapter {N}", so it can't
  // drift from the naming convention every other chapter already follows
  // (seriesDisplayTitle strips exactly this suffix everywhere else it's
  // read back). Only derived once the chapter number is a real number —
  // before that there's nothing valid to build a title from yet.
  const derivedEpisodeTitle = addAsEpisode && episodeAnchorEntry && episodeChapterNumber.trim() && Number.isInteger(Number(episodeChapterNumber))
    ? `${seriesDisplayTitle(episodeAnchorEntry.title)} - Chapter ${episodeChapterNumber.trim()}`
    : null;
  useEffect(() => {
    if (derivedEpisodeTitle) setAddTitle(derivedEpisodeTitle);
  }, [derivedEpisodeTitle]);

  // ── Admin Services: Feature a story on the home hero banner ───────────────
  const [promoteStoryId, setPromoteStoryId] = useState("");
  const [promoteRunning, setPromoteRunning] = useState(false);
  const [promoteLog, setPromoteLog] = useState<Array<{ type: "info" | "error" | "success"; text: string }>>([]);

  const handlePromoteStory = async (promoted: boolean) => {
    const id = promoteStoryId.trim();
    if (!id) return;
    setPromoteRunning(true);
    setPromoteLog([{ type: "info", text: promoted ? `Promoting ${id}…` : `Un-promoting ${id}…` }]);
    try {
      const res = await fetch("/api/admin/promote-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, promoted }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPromoteLog((l) => [...l, { type: "error", text: `Server error: ${data.error ?? res.statusText}` }]);
        return;
      }
      setPromoteLog((l) => [...l, { type: "success", text: promoted
        ? `✅ "${data.title}" is now featured on every family's home hero banner.`
        : `✅ "${data.title}" is no longer featured.` }]);
    } catch (e) {
      setPromoteLog((l) => [...l, { type: "error", text: `Network error: ${e instanceof Error ? e.message : String(e)}` }]);
    } finally {
      setPromoteRunning(false);
    }
  };

  // ── Admin Services: Delete a story by ID ──────────────────────────────────
  const [deleteStoryId, setDeleteStoryId] = useState("");
  const [deleteRunning, setDeleteRunning] = useState(false);
  const [deleteLog, setDeleteLog] = useState<Array<{ type: "info" | "error" | "success"; text: string }>>([]);

  const handleDeleteStory = async () => {
    const id = deleteStoryId.trim();
    if (!id) return;

    setDeleteRunning(true);
    setDeleteLog([{ type: "info", text: `Looking up story ${id}…` }]);
    try {
      const lookupRes = await fetch(`/api/library/${encodeURIComponent(id)}`);
      if (!lookupRes.ok) {
        setDeleteLog((l) => [...l, { type: "error", text: lookupRes.status === 404 ? "No story found with that ID." : `Lookup failed: ${lookupRes.statusText}` }]);
        return;
      }
      const entry = await lookupRes.json() as { title: string };

      if (!confirm(`Move "${entry.title}" (${id}) to trash?\n\nRecoverable from Trash for 30 days — this is not a permanent delete.`)) {
        setDeleteLog((l) => [...l, { type: "info", text: "Cancelled." }]);
        return;
      }

      const res = await fetch(`/api/library/${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDeleteLog((l) => [...l, { type: "error", text: `Server error: ${data.error ?? res.statusText}` }]);
        return;
      }
      setDeleteLog((l) => [...l, { type: "success", text: `✅ Moved "${entry.title}" to trash — recoverable for 30 days.` }]);
      setDeleteStoryId("");
    } catch (e) {
      setDeleteLog((l) => [...l, { type: "error", text: `Network error: ${e instanceof Error ? e.message : String(e)}` }]);
    } finally {
      setDeleteRunning(false);
    }
  };

  // ── Admin Services: Delete only the audio file from a story ──────────────
  const [deleteAudioStoryId, setDeleteAudioStoryId] = useState("");
  const [deleteAudioRunning, setDeleteAudioRunning] = useState(false);
  const [deleteAudioLog, setDeleteAudioLog] = useState<Array<{ type: "info" | "error" | "success"; text: string }>>([]);

  const handleDeleteAudio = async () => {
    const id = deleteAudioStoryId.trim();
    if (!id) return;

    setDeleteAudioRunning(true);
    setDeleteAudioLog([{ type: "info", text: `Looking up story ${id}…` }]);
    try {
      const lookupRes = await fetch(`/api/library/${encodeURIComponent(id)}`);
      if (!lookupRes.ok) {
        setDeleteAudioLog((l) => [...l, { type: "error", text: lookupRes.status === 404 ? "No story found with that ID." : `Lookup failed: ${lookupRes.statusText}` }]);
        return;
      }
      const entry = await lookupRes.json() as { title: string; audioUrl?: string };

      if (!entry.audioUrl) {
        setDeleteAudioLog((l) => [...l, { type: "info", text: `"${entry.title}" already has no audio — nothing to remove.` }]);
        return;
      }

      if (!confirm(`Delete the audio file for "${entry.title}" (${id})?\n\nScript, cover, and everything else stay as-is — only audio_url and the stored audio file are removed. Not recoverable; re-produce to regenerate.`)) {
        setDeleteAudioLog((l) => [...l, { type: "info", text: "Cancelled." }]);
        return;
      }

      const res = await fetch("/api/admin/delete-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId: id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDeleteAudioLog((l) => [...l, { type: "error", text: `Server error: ${data.error ?? res.statusText}` }]);
        return;
      }
      setDeleteAudioLog((l) => [...l, { type: "success", text: `✅ Removed audio for "${data.title}"${data.removedFile ? "" : " (DB field cleared; storage file was already missing)"}.` }]);
      setDeleteAudioStoryId("");
    } catch (e) {
      setDeleteAudioLog((l) => [...l, { type: "error", text: `Network error: ${e instanceof Error ? e.message : String(e)}` }]);
    } finally {
      setDeleteAudioRunning(false);
    }
  };

  // ── Admin Services: Generate voice preview samples ───────────────────────
  const [previewVoiceId, setPreviewVoiceId] = useState("");
  const [previewRunning, setPreviewRunning] = useState(false);
  const [previewLog, setPreviewLog] = useState<Array<{ type: "info" | "error" | "success"; text: string }>>([]);

  const runGenerateVoiceSamples = async (body: { voiceId?: string } | { applyAll: true }) => {
    setPreviewRunning(true);
    setPreviewLog([{ type: "info", text: "applyAll" in body ? "Generating samples for every voice × language…" : `Generating samples for voice ${(body as { voiceId: string }).voiceId}…` }]);
    try {
      const res = await fetch("/api/admin/generate-voice-samples", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setPreviewLog((l) => [...l, { type: "error", text: `Server error: ${data.error ?? res.statusText}` }]);
        return;
      }
      const d = data as { totalCombos: number; succeeded: number; failed: number; results: Array<{ voiceId: string; language: string; ok: boolean; error?: string }> };
      setPreviewLog((l) => [
        ...l,
        { type: "success", text: `✅ Done — ${d.succeeded}/${d.totalCombos} samples generated (${d.failed} failed)` },
        ...d.results.filter((r) => !r.ok).map((r) => ({ type: "error" as const, text: `  · ${r.voiceId} [${r.language}] — ${r.error}` })),
      ]);
    } catch (e) {
      setPreviewLog((l) => [...l, { type: "error", text: `Network error: ${e instanceof Error ? e.message : String(e)}` }]);
    } finally {
      setPreviewRunning(false);
    }
  };

  const handleGenerateOneVoice = () => {
    if (!previewVoiceId.trim()) return;
    runGenerateVoiceSamples({ voiceId: previewVoiceId.trim() });
  };

  const handleGenerateAllVoices = () => {
    if (!confirm("Generate preview samples for EVERY voice — presets, the Hebrew pool, and every family's cloned voices — × English + Hebrew? This will take a while and use real API quota.")) return;
    runGenerateVoiceSamples({ applyAll: true });
  };

  return (
    <div className="cosmic-page min-h-full pb-40">
      <div className="px-5 pt-12">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-fs-title font-bold"
              style={{ background: "linear-gradient(135deg,#fff 0%,#4fc3f7 50%,#a78bfa 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              Admin
            </h1>
            <p className="text-fs-body mt-0.5" style={{ color: "rgba(255,255,255,0.48)" }}>{user.email}</p>
          </div>
          {adminTab === "factory" && (
            <button onClick={resetAddStory}
              className="text-fs-body px-3 py-1.5 rounded-lg transition-all active:scale-95"
              style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.08)" }}>
              Reset
            </button>
          )}
        </div>

        {/* Tab bar */}
        <div className="flex gap-2 mb-8 p-1 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
          {([
            { id: "factory",  label: "➕ Add Story" },
            { id: "costs",    label: "📊 Cost Analysis" },
            { id: "services", label: "🛠️ Admin Services" },
          ] as const).map((tab) => (
            <button key={tab.id} onClick={() => setAdminTab(tab.id)}
              className="flex-1 py-2.5 rounded-xl text-fs-body font-medium transition-all"
              style={adminTab === tab.id
                ? { background: "rgba(79,195,247,0.15)", border: "1px solid rgba(79,195,247,0.35)", color: "#4fc3f7" }
                : { background: "transparent", border: "1px solid transparent", color: "rgba(255,255,255,0.55)" }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/*  TAB: Factory                                                     */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {adminTab === "factory" && (<>

        {/* ── Visibility ── */}
        <Divider title="Visibility" />
        <div className="flex flex-col gap-4 mb-2">
          <Toggle on={addIsPublic} onToggle={() => setAddIsPublic((v) => !v)}
            label={addIsPublic ? "Public story" : "Private — only visible to you"} />
          {addIsPublic && (
            <div className="flex gap-2">
              {(["classics", "community"] as const).map((cat) => (
                <button key={cat} onClick={() => setAddCategory(cat)}
                  className="flex-1 py-2.5 rounded-xl text-fs-body font-medium transition-all"
                  style={addCategory === cat
                    ? { background: cat === "classics" ? "rgba(251,191,36,0.15)" : "rgba(167,139,250,0.15)", border: `1px solid ${cat === "classics" ? "rgba(251,191,36,0.4)" : "rgba(167,139,250,0.4)"}`, color: cat === "classics" ? "#fbbf24" : "#a78bfa" }
                    : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.52)" }}>
                  {cat === "classics" ? "✨ Classics" : "🌍 Community"}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Series ── */}
        <Divider title="Series" />
        <div className="flex flex-col gap-3 mb-2">
          <Toggle on={addAsEpisode} onToggle={() => setAddAsEpisode((v) => !v)}
            label={addAsEpisode ? "Episode of an existing series" : "Standalone story"} />
          {addAsEpisode && (
            <div className="flex flex-col gap-2.5 rounded-2xl p-4"
              style={{ background: "rgba(167,139,250,0.04)", border: "1px solid rgba(167,139,250,0.18)" }}>
              <p className="text-fs-body" style={{ color: "rgba(255,255,255,0.55)" }}>
                Once this story is saved, it's linked as a chapter of the series below — its cover image
                and every returning character's avatar + voice (matched by exact name) are copied from
                that series so the cast looks and sounds identical across episodes.
              </p>

              <div>
                <Label>Add to the series of this story</Label>
                <Select
                  value={episodeSeriesAnchorId}
                  onChange={setEpisodeSeriesAnchorId}
                  options={[
                    { value: "", label: "— Select a story —" },
                    ...seriesStoryList.map((s) => ({
                      value: s.id,
                      label: `${s.title}${s.seriesId ? ` (series, ${s.chapterCount ?? "?"} ch.)` : " (standalone → becomes Ch. 1)"} — ${new Date(s.createdAt).toLocaleDateString()}`,
                    })),
                  ]}
                />
                {episodeAnchorChapters.length > 0 && (
                  <p className="text-fs-body mt-1.5" style={{ color: "rgba(167,139,250,0.7)" }}>
                    Existing chapters: {episodeAnchorChapters
                      .slice()
                      .sort((a, b) => (a.chapterNumber ?? 0) - (b.chapterNumber ?? 0))
                      .map((c) => `Ch.${c.chapterNumber ?? "?"} "${c.title}"`)
                      .join(", ")}
                  </p>
                )}
              </div>

              <div>
                <Label>This new story's chapter number</Label>
                <input
                  type="number"
                  min={1}
                  value={episodeChapterNumber}
                  onChange={(e) => setEpisodeChapterNumber(e.target.value)}
                  placeholder="e.g. 2"
                  className="w-full rounded-xl px-3 py-2.5 text-fs-body outline-none text-white/80"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Script ── */}
        <Divider title="Script" />
        <p className="text-fs-body mb-3" style={{ color: "rgba(255,255,255,0.52)" }}>
          Use <span style={{ color: "#4fc3f7" }}>[Character Name]</span> to mark each speaker. Example:
        </p>
        <div className="rounded-xl px-3 py-2.5 mb-3 text-fs-body leading-relaxed"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.55)", fontFamily: "monospace", fontSize: 12 }}>
          [Narrator] Once upon a time…{"\n"}[Maya] Oh, what&apos;s out there?{"\n"}[Miss Cassandra] Stay safe inside, little bee.
        </div>
        <textarea
          value={addScript}
          onChange={(e) => setAddScript(e.target.value)}
          placeholder="Paste or type your script here using [Character Name] markers…"
          rows={12}
          className="w-full px-3 py-2.5 rounded-xl text-white text-fs-body outline-none resize-none"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", fontFamily: "monospace" }}
        />

        {/* ── Title ── */}
        <Divider title="Story Title" />
        <TextInput value={addTitle} onChange={setAddTitle} placeholder="Maya the Bee" disabled={!!derivedEpisodeTitle} />
        {derivedEpisodeTitle && (
          <p className="text-fs-body mt-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>
            Derived from the series — chapters are always named "{"{series name}"} - Chapter {"{N}"}".
          </p>
        )}

        {processError && (
          <p className="text-fs-body mt-2" style={{ color: "#EC4899" }}>{processError}</p>
        )}

        <button
          onClick={handleProcessScript}
          disabled={processState === "processing" || !addScript.trim()}
          className="w-full mt-3 py-3 rounded-xl text-fs-body font-bold transition-all active:scale-[0.98] disabled:opacity-40"
          style={{ background: "linear-gradient(135deg,rgba(79,195,247,0.2),rgba(167,139,250,0.2))", border: "1px solid rgba(79,195,247,0.4)", color: "#fff" }}>
          {processState === "processing" ? (processPhase || "Processing…") : "⚙️ Process Script"}
        </button>

        {/* ── Preview (after script processed) ── */}
        {processState === "done" && !isDone && (
          <>
            <ScriptTab
              blocks={parsedBlocks}
              voices={voicePool}
              onBlocksChange={setParsedBlocks}
              onProduce={() => {}}
              isProducing={false}
              title={addTitle}
              summary={storeSummary}
              coverUrl={storeCoverUrl}
              isFetchingCover={storeCoverLoading}
              onRegenerateCover={handleRegenerateCover}
              onUploadCover={(file: File) => {
                const reader = new FileReader();
                reader.onload = (ev) => { const d = ev.target?.result as string; if (d) setStoreCoverUrl(d); };
                reader.readAsDataURL(file);
              }}
              hideDurationPicker
              hideProduceButton
              storyId={addStoryId || undefined}
              characterAvatars={characterAvatars}
              belowCover={
                <CharacterCards
                  blocks={parsedBlocks}
                  voicePool={voicePool}
                  avatars={characterAvatars}
                  characterTypes={characterTypes}
                  characterProfiles={castProfiles}
                  storyLanguage={scriptLanguage}
                  openCharacter={openDirectSheet}
                  onOpen={setOpenDirectSheet}
                  onClose={() => setOpenDirectSheet(null)}
                  onAvatarChange={handleAvatarChange}
                  onVoiceChange={handleVoiceChangeForChar}
                />
              }
            />

            {/* Validation — same two-pass check the normal generation flow runs;
                both passes already auto-applied their fixes above, this is a
                transparency log of what changed, not an action item. */}
            {validationIssues.length > 0 && (
              <div className="rounded-xl px-4 py-3 mt-3"
                style={{ background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.25)" }}>
                <p className="text-fs-body font-bold mb-1" style={{ color: "#fbbf24" }}>⚠️ Policy issues auto-fixed</p>
                {validationIssues.map((issue, idx) => (
                  <p key={idx} className="text-fs-body leading-snug" style={{ color: "rgba(251,191,36,0.75)" }}>• {issue}</p>
                ))}
              </div>
            )}
            {validationIssues.length === 0 && (
              <p className="text-center text-fs-body mt-2" style={{ color: "rgba(79,195,247,0.6)" }}>✓ Script passes policy check</p>
            )}
            {validationChanges > 0 ? (
              <p className="text-center text-fs-body mt-1" style={{ color: "rgba(251,191,36,0.75)" }}>
                ✎ Fixed {validationChanges} typo/grammar/age issue{validationChanges === 1 ? "" : "s"}
              </p>
            ) : (
              <p className="text-center text-fs-body mt-1" style={{ color: "rgba(79,195,247,0.6)" }}>✓ No typos or grammar issues found</p>
            )}

            {/* Produce */}
            <Divider title="Produce Story" />
            {addProduceLog.length > 0 && (
              <div className="rounded-xl px-3 py-2.5 mb-3 flex flex-col gap-1"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                {addProduceLog.map((msg, i) => (
                  <p key={i} className="text-fs-body" style={{ color: "rgba(255,255,255,0.4)" }}>→ {msg}</p>
                ))}
              </div>
            )}
            {job && (
              <div className="mb-4">
                <JobProgress status={job.status} step={job.step} progress={job.progress} error={job.error} />
                {(job as { libraryError?: string }).libraryError && (
                  <div className="mt-2 rounded-xl px-4 py-3"
                    style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.3)" }}>
                    <p className="text-fs-body font-bold" style={{ color: "#fbbf24" }}>⚠️ Library save failed</p>
                    <p className="text-fs-body mt-0.5" style={{ color: "rgba(251,191,36,0.7)" }}>
                      {(job as { libraryError?: string }).libraryError}
                    </p>
                    <p className="text-fs-body mt-1" style={{ color: "rgba(255,255,255,0.52)" }}>
                      Audio was produced but could not be saved. Try clicking "Produce Story" again.
                    </p>
                  </div>
                )}
              </div>
            )}
            {addProduceError && (
              <p className="text-fs-body mb-3" style={{ color: "#EC4899" }}>{addProduceError}</p>
            )}
            <button
              onClick={handleProduceStory}
              disabled={addProducing || storeCoverLoading}
              className="w-full py-4 rounded-2xl text-fs-subtitle font-bold transition-all active:scale-[0.98] disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,rgba(79,195,247,0.28),rgba(167,139,250,0.28))", border: "1px solid rgba(79,195,247,0.45)", color: "#fff", boxShadow: "0 4px 24px rgba(79,195,247,0.18)" }}>
              {addProducing ? "Working…" : "🎙️ Produce Story"}
            </button>
          </>
        )}

        {/* ── Done — rich review & explicit save ── */}
        {isDone && (
          <div className="mt-4 flex flex-col gap-4">
            {/* Cover */}
            {job?.coverUrl && (
              <div className="relative w-full rounded-2xl overflow-hidden" style={{ aspectRatio: "16/9" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={job.coverUrl} alt="Story cover" className="w-full h-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 h-24"
                  style={{ background: "linear-gradient(to top,rgba(4,6,18,0.9),transparent)" }} />
                <p className="absolute bottom-3 left-4 font-bold text-white text-fs-subtitle"
                  style={{ textShadow: "0 1px 8px rgba(0,0,0,0.6)" }}>
                  {job.title || addTitle}
                </p>
              </div>
            )}

            {/* Cast — same CharacterCards as the script editing phase */}
            {parsedBlocks.length > 0 && (
              <CharacterCards
                blocks={parsedBlocks}
                voicePool={voicePool}
                avatars={characterAvatars}
                characterTypes={characterTypes}
                characterProfiles={castProfiles}
                storyLanguage={scriptLanguage}
                openCharacter={openDirectSheet}
                onOpen={setOpenDirectSheet}
                onClose={() => setOpenDirectSheet(null)}
                onAvatarChange={handleAvatarChange}
                onVoiceChange={handleVoiceChangeForChar}
              />
            )}

            {/* Audio player */}
            {job?.audioUrl && (
              <div className="rounded-xl px-4 py-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <audio controls src={job.audioUrl} className="w-full" style={{ height: 40 }} />
              </div>
            )}

            {/* Add Story button */}
            {!addSaved ? (
              <div className="flex flex-col gap-2">
                {addSaveError && (
                  <p className="text-fs-body text-center" style={{ color: "#EC4899" }}>{addSaveError}</p>
                )}
                {addAsEpisode && (!episodeSeriesAnchorId || !episodeChapterNumber.trim()) && (
                  <p className="text-fs-body text-center" style={{ color: "#fbbf24" }}>
                    Pick a series and chapter number above, or turn off "Episode of an existing series" to save standalone.
                  </p>
                )}
                <button
                  onClick={handleSaveStory}
                  disabled={addSaving || (addAsEpisode && (!episodeSeriesAnchorId || !episodeChapterNumber.trim()))}
                  className="w-full py-4 rounded-2xl text-fs-subtitle font-bold transition-all active:scale-[0.98] disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg,rgba(79,195,247,0.35),rgba(16,185,129,0.35))", border: "1px solid rgba(79,195,247,0.5)", color: "#fff", boxShadow: "0 4px 24px rgba(79,195,247,0.22)" }}>
                  {addSaving ? "Saving…" : addAsEpisode ? "✅ Add Story as Episode" : "✅ Add Story to Library"}
                </button>
              </div>
            ) : (
              <div className="rounded-xl px-4 py-3 text-center" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.3)" }}>
                <p className="text-fs-body font-bold" style={{ color: "#34d399" }}>✓ Story saved to library!</p>
              </div>
            )}

            {episodeAssignLog && (
              <div className="rounded-xl px-4 py-3 text-center"
                style={{
                  background: episodeAssignLog.type === "error" ? "rgba(239,68,68,0.08)" : episodeAssignLog.type === "success" ? "rgba(167,139,250,0.08)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${episodeAssignLog.type === "error" ? "rgba(239,68,68,0.3)" : episodeAssignLog.type === "success" ? "rgba(167,139,250,0.3)" : "rgba(255,255,255,0.1)"}`,
                }}>
                <p className="text-fs-body font-medium" style={{ color: episodeAssignLog.type === "error" ? "#f87171" : episodeAssignLog.type === "success" ? "#a78bfa" : "rgba(255,255,255,0.5)" }}>
                  {episodeAssignLog.text}
                </p>
              </div>
            )}

            <button onClick={resetAddStory}
              className="text-fs-body px-4 py-2 rounded-xl font-medium transition-all active:scale-[0.98] self-center"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)" }}>
              Add another story
            </button>
          </div>
        )}


        </>)}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/*  TAB: Cost Analysis                                               */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {adminTab === "costs" && (
          <CostAnalysis
            usageData={costData}
            libraryData={libraryData}
            usageLoading={costLoading}
            libraryLoading={libraryLoading}
            onLoadUsage={loadCostAnalysis}
            onLoadLibrary={loadLibraryAnalysis}
          />
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/*  TAB: Admin Services                                               */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {adminTab === "services" && (
          <div className="flex flex-col gap-6">

            {/* ── SFX Cache Panel ── */}
            <div className="rounded-2xl p-5"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex items-start justify-between mb-1">
                <div>
                  <p className="text-white font-bold text-fs-body">🔊 SFX Cache</p>
                  <p className="text-fs-body mt-0.5" style={{ color: "rgba(255,255,255,0.52)" }}>
                    Scans all story_elements for SFX clips and seeds the sfx_library table for cross-story reuse.
                  </p>
                </div>
              </div>

              <button
                onClick={handleUpdateSfxCache}
                disabled={sfxRunning}
                className="w-full mt-4 py-3 rounded-xl text-fs-body font-bold transition-all active:scale-[0.98] disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,rgba(167,139,250,0.2),rgba(79,195,247,0.2))", border: "1px solid rgba(167,139,250,0.4)", color: "#fff" }}>
                {sfxRunning ? "Updating…" : "Update SFXs"}
              </button>

              {/* Progress bar */}
              {(sfxRunning || sfxProgress > 0) && (
                <div className="mt-4">
                  <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${sfxProgress}%`,
                        background: sfxProgress === 100
                          ? "linear-gradient(90deg,#10b981,#4fc3f7)"
                          : "linear-gradient(90deg,#a78bfa,#4fc3f7)",
                      }}
                    />
                  </div>
                  <p className="text-fs-body mt-1 text-right" style={{ color: "rgba(255,255,255,0.48)" }}>
                    {sfxProgress}%
                  </p>
                </div>
              )}

              {/* Log output */}
              {sfxLog.length > 0 && (
                <div className="mt-4 rounded-xl px-3 py-3 flex flex-col gap-1.5"
                  style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  {sfxLog.map((entry, i) => (
                    <p key={i} className="text-fs-body leading-snug"
                      style={{
                        color: entry.type === "error" ? "#f87171"
                          : entry.type === "success" ? "#34d399"
                          : "rgba(255,255,255,0.45)",
                        fontFamily: "monospace",
                      }}>
                      {entry.text}
                    </p>
                  ))}
                </div>
              )}
            </div>

            {/* ── Reassign Cast Voices Panel ── */}
            <div className="rounded-2xl p-5"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex items-start justify-between mb-1">
                <div>
                  <p className="text-white font-bold text-fs-body">🎭 Reassign Cast Voices</p>
                  <p className="text-fs-body mt-0.5" style={{ color: "rgba(255,255,255,0.52)" }}>
                    Runs a fresh character analysis (type/appearance) for every speaking character, then
                    recomputes each one&apos;s assigned voice using nature-based matching (gender/style/age).
                    The Narrator is excluded from analysis and always gets this browser&apos;s own default
                    narrator voice instead. Only updates the voice id on each block — already-produced audio
                    is unaffected until the story is re-produced.
                  </p>
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <input
                  type="text"
                  value={reassignStoryId}
                  onChange={(e) => setReassignStoryId(e.target.value)}
                  placeholder="Story ID"
                  disabled={reassignRunning}
                  className="flex-1 rounded-xl px-3 py-2.5 text-fs-body outline-none text-white/80"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}
                />
                <button
                  onClick={handleReassignOneStory}
                  disabled={reassignRunning || !reassignStoryId.trim()}
                  className="px-4 py-2.5 rounded-xl text-fs-body font-bold transition-all active:scale-[0.98] disabled:opacity-40"
                  style={{ background: "rgba(79,195,247,0.15)", border: "1px solid rgba(79,195,247,0.4)", color: "#4fc3f7" }}>
                  Reassign This Story
                </button>
              </div>

              <button
                onClick={handleReassignAllStories}
                disabled={reassignRunning}
                className="w-full mt-3 py-3 rounded-xl text-fs-body font-bold transition-all active:scale-[0.98] disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,rgba(167,139,250,0.2),rgba(79,195,247,0.2))", border: "1px solid rgba(167,139,250,0.4)", color: "#fff" }}>
                {reassignRunning ? "Working…" : "Reassign ALL Stories"}
              </button>

              {/* Log output */}
              {reassignLog.length > 0 && (
                <div className="mt-4 rounded-xl px-3 py-3 flex flex-col gap-1.5 max-h-72 overflow-y-auto"
                  style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  {reassignLog.map((entry, i) => (
                    <p key={i} className="text-fs-body leading-snug"
                      style={{
                        color: entry.type === "error" ? "#f87171"
                          : entry.type === "success" ? "#34d399"
                          : "rgba(255,255,255,0.45)",
                        fontFamily: "monospace",
                      }}>
                      {entry.text}
                    </p>
                  ))}
                </div>
              )}
            </div>

            {/* ── Reassign Cast Avatars Panel ── */}
            <div className="rounded-2xl p-5"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex items-start justify-between mb-1">
                <div>
                  <p className="text-white font-bold text-fs-body">🖼️ Reassign Cast Avatars</p>
                  <p className="text-fs-body mt-0.5" style={{ color: "rgba(255,255,255,0.52)" }}>
                    Re-classifies every character from the script (type/gender/age/visual description —
                    same analysis as Reassign Cast Voices) and rematches their avatar-bank portrait against
                    it, with gender and age as hard/soft filters so a character doesn't end up with a
                    mismatched avatar. Works even on stories with no saved profile data yet. Only updates
                    character_profiles — no audio or script changes.
                  </p>
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <input
                  type="text"
                  value={reassignAvatarStoryId}
                  onChange={(e) => setReassignAvatarStoryId(e.target.value)}
                  placeholder="Story ID"
                  disabled={reassignAvatarRunning}
                  className="flex-1 rounded-xl px-3 py-2.5 text-fs-body outline-none text-white/80"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}
                />
                <button
                  onClick={handleReassignOneStoryAvatars}
                  disabled={reassignAvatarRunning || !reassignAvatarStoryId.trim()}
                  className="px-4 py-2.5 rounded-xl text-fs-body font-bold transition-all active:scale-[0.98] disabled:opacity-40"
                  style={{ background: "rgba(79,195,247,0.15)", border: "1px solid rgba(79,195,247,0.4)", color: "#4fc3f7" }}>
                  Reassign This Story
                </button>
              </div>

              <button
                onClick={handleReassignAllStoriesAvatars}
                disabled={reassignAvatarRunning}
                className="w-full mt-3 py-3 rounded-xl text-fs-body font-bold transition-all active:scale-[0.98] disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,rgba(167,139,250,0.2),rgba(79,195,247,0.2))", border: "1px solid rgba(167,139,250,0.4)", color: "#fff" }}>
                {reassignAvatarRunning ? "Working…" : "Reassign ALL Stories"}
              </button>

              {/* Log output */}
              {reassignAvatarLog.length > 0 && (
                <div className="mt-4 rounded-xl px-3 py-3 flex flex-col gap-1.5 max-h-72 overflow-y-auto"
                  style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  {reassignAvatarLog.map((entry, i) => (
                    <p key={i} className="text-fs-body leading-snug"
                      style={{
                        color: entry.type === "error" ? "#f87171"
                          : entry.type === "success" ? "#34d399"
                          : "rgba(255,255,255,0.45)",
                        fontFamily: "monospace",
                      }}>
                      {entry.text}
                    </p>
                  ))}
                </div>
              )}
            </div>

            {/* ── Backfill Character Profiles Panel ── */}
            <div className="rounded-2xl p-5"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex items-start justify-between mb-1">
                <div>
                  <p className="text-white font-bold text-fs-body">🧬 Backfill Character Profiles</p>
                  <p className="text-fs-body mt-0.5" style={{ color: "rgba(255,255,255,0.52)" }}>
                    Runs the same character classifier used for new stories (type + visual description)
                    against stories generated before that data was saved. Skips stories that already have
                    character profile data, and skips any story with no audio yet.
                  </p>
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <input
                  type="text"
                  value={backfillStoryId}
                  onChange={(e) => setBackfillStoryId(e.target.value)}
                  placeholder="Story ID"
                  disabled={backfillRunning}
                  className="flex-1 rounded-xl px-3 py-2.5 text-fs-body outline-none text-white/80"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}
                />
                <button
                  onClick={handleBackfillOneStory}
                  disabled={backfillRunning || !backfillStoryId.trim()}
                  className="px-4 py-2.5 rounded-xl text-fs-body font-bold transition-all active:scale-[0.98] disabled:opacity-40"
                  style={{ background: "rgba(79,195,247,0.15)", border: "1px solid rgba(79,195,247,0.4)", color: "#4fc3f7" }}>
                  Backfill This Story
                </button>
              </div>

              <button
                onClick={handleBackfillAllStories}
                disabled={backfillRunning}
                className="w-full mt-3 py-3 rounded-xl text-fs-body font-bold transition-all active:scale-[0.98] disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,rgba(167,139,250,0.2),rgba(79,195,247,0.2))", border: "1px solid rgba(167,139,250,0.4)", color: "#fff" }}>
                {backfillRunning ? "Working…" : "Backfill ALL Stories"}
              </button>

              {/* Log output */}
              {backfillLog.length > 0 && (
                <div className="mt-4 rounded-xl px-3 py-3 flex flex-col gap-1.5 max-h-72 overflow-y-auto"
                  style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  {backfillLog.map((entry, i) => (
                    <p key={i} className="text-fs-body leading-snug"
                      style={{
                        color: entry.type === "error" ? "#f87171"
                          : entry.type === "success" ? "#34d399"
                          : "rgba(255,255,255,0.45)",
                        fontFamily: "monospace",
                      }}>
                      {entry.text}
                    </p>
                  ))}
                </div>
              )}
            </div>

            {/* ── Regenerate Scene Maps Panel ── */}
            <div className="rounded-2xl p-5"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex items-start justify-between mb-1">
                <div>
                  <p className="text-white font-bold text-fs-body">🗺️ Regenerate Scene Maps</p>
                  <p className="text-fs-body mt-0.5" style={{ color: "rgba(255,255,255,0.52)" }}>
                    Re-runs the scene breakdown against the current policy in config/story-guidance.txt
                    (same-language summaries, no-spoiler teasing questions for the climax/resolution).
                    Only produced stories (with a script) can be regenerated; already-produced audio is
                    unaffected.
                  </p>
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <input
                  type="text"
                  value={regenSceneStoryId}
                  onChange={(e) => setRegenSceneStoryId(e.target.value)}
                  placeholder="Story ID"
                  disabled={regenSceneRunning}
                  className="flex-1 rounded-xl px-3 py-2.5 text-fs-body outline-none text-white/80"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}
                />
                <button
                  onClick={handleRegenerateOneStory}
                  disabled={regenSceneRunning || !regenSceneStoryId.trim()}
                  className="px-4 py-2.5 rounded-xl text-fs-body font-bold transition-all active:scale-[0.98] disabled:opacity-40"
                  style={{ background: "rgba(79,195,247,0.15)", border: "1px solid rgba(79,195,247,0.4)", color: "#4fc3f7" }}>
                  Regenerate This Story
                </button>
              </div>

              <button
                onClick={handleRegenerateAllStories}
                disabled={regenSceneRunning}
                className="w-full mt-3 py-3 rounded-xl text-fs-body font-bold transition-all active:scale-[0.98] disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,rgba(167,139,250,0.2),rgba(79,195,247,0.2))", border: "1px solid rgba(167,139,250,0.4)", color: "#fff" }}>
                {regenSceneRunning ? "Working…" : "Regenerate ALL Stories"}
              </button>

              {/* Log output */}
              {regenSceneLog.length > 0 && (
                <div className="mt-4 rounded-xl px-3 py-3 flex flex-col gap-1.5 max-h-72 overflow-y-auto"
                  style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  {regenSceneLog.map((entry, i) => (
                    <p key={i} className="text-fs-body leading-snug"
                      style={{
                        color: entry.type === "error" ? "#f87171"
                          : entry.type === "success" ? "#34d399"
                          : "rgba(255,255,255,0.45)",
                        fontFamily: "monospace",
                      }}>
                      {entry.text}
                    </p>
                  ))}
                </div>
              )}
            </div>

            {/* ── Refresh Story Policies Panel ── */}
            <div className="rounded-2xl p-5"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex items-start justify-between mb-1">
                <div>
                  <p className="text-white font-bold text-fs-body">🔄 Refresh Story Policies</p>
                  <p className="text-fs-body mt-0.5" style={{ color: "rgba(255,255,255,0.52)" }}>
                    Re-applies every generation-time rule to an already-produced story — cast/voice
                    assignment, moral-lesson analysis, scene breakdown, and the summary blurb — as if it
                    were being generated fresh today. Never touches the script text, cover image, or audio.
                    If a story fails (bad Gemini response, etc.) its error is logged and it&apos;s skipped;
                    the rest of the batch continues.
                  </p>
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <input
                  type="text"
                  value={refreshQuery}
                  onChange={(e) => setRefreshQuery(e.target.value)}
                  placeholder="Story ID or title"
                  disabled={refreshRunning}
                  className="flex-1 rounded-xl px-3 py-2.5 text-fs-body outline-none text-white/80"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}
                />
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleRefreshById}
                  disabled={refreshRunning || !refreshQuery.trim()}
                  className="flex-1 px-4 py-2.5 rounded-xl text-fs-body font-bold transition-all active:scale-[0.98] disabled:opacity-40"
                  style={{ background: "rgba(79,195,247,0.15)", border: "1px solid rgba(79,195,247,0.4)", color: "#4fc3f7" }}>
                  Refresh by ID
                </button>
                <button
                  onClick={handleRefreshByTitle}
                  disabled={refreshRunning || !refreshQuery.trim()}
                  className="flex-1 px-4 py-2.5 rounded-xl text-fs-body font-bold transition-all active:scale-[0.98] disabled:opacity-40"
                  style={{ background: "rgba(79,195,247,0.15)", border: "1px solid rgba(79,195,247,0.4)", color: "#4fc3f7" }}>
                  Refresh by Title
                </button>
              </div>

              <button
                onClick={handleRefreshAllStories}
                disabled={refreshRunning}
                className="w-full mt-3 py-3 rounded-xl text-fs-body font-bold transition-all active:scale-[0.98] disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,rgba(167,139,250,0.2),rgba(79,195,247,0.2))", border: "1px solid rgba(167,139,250,0.4)", color: "#fff" }}>
                {refreshRunning ? "Working…" : "Refresh ALL Stories"}
              </button>

              {/* Log output */}
              {refreshLog.length > 0 && (
                <div className="mt-4 rounded-xl px-3 py-3 flex flex-col gap-1.5 max-h-72 overflow-y-auto"
                  style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  {refreshLog.map((entry, i) => (
                    <p key={i} className="text-fs-body leading-snug"
                      style={{
                        color: entry.type === "error" ? "#f87171"
                          : entry.type === "success" ? "#34d399"
                          : "rgba(255,255,255,0.45)",
                        fontFamily: "monospace",
                      }}>
                      {entry.text}
                    </p>
                  ))}
                </div>
              )}
            </div>

            {/* ── Generate Voice Preview Samples Panel ── */}
            <div className="rounded-2xl p-5"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex items-start justify-between mb-1">
                <div>
                  <p className="text-white font-bold text-fs-body">🔊 Generate Voice Preview Samples</p>
                  <p className="text-fs-body mt-0.5" style={{ color: "rgba(255,255,255,0.52)" }}>
                    Synthesizes the sample line "Hello. This is my voice." for every voice (Gemini presets +
                    curated ElevenLabs Hebrew pool), in English and Hebrew, so the Studio voice picker can
                    preview a voice in the story's own language instead of one fixed generic clip.
                    Voice ID here is the preset name (e.g. "Charon") or the ElevenLabs voice id.
                  </p>
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <input
                  type="text"
                  value={previewVoiceId}
                  onChange={(e) => setPreviewVoiceId(e.target.value)}
                  placeholder="Voice ID"
                  disabled={previewRunning}
                  className="flex-1 rounded-xl px-3 py-2.5 text-fs-body outline-none text-white/80"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}
                />
                <button
                  onClick={handleGenerateOneVoice}
                  disabled={previewRunning || !previewVoiceId.trim()}
                  className="px-4 py-2.5 rounded-xl text-fs-body font-bold transition-all active:scale-[0.98] disabled:opacity-40"
                  style={{ background: "rgba(79,195,247,0.15)", border: "1px solid rgba(79,195,247,0.4)", color: "#4fc3f7" }}>
                  Generate This Voice
                </button>
              </div>

              <button
                onClick={handleGenerateAllVoices}
                disabled={previewRunning}
                className="w-full mt-3 py-3 rounded-xl text-fs-body font-bold transition-all active:scale-[0.98] disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,rgba(167,139,250,0.2),rgba(79,195,247,0.2))", border: "1px solid rgba(167,139,250,0.4)", color: "#fff" }}>
                {previewRunning ? "Working…" : "Generate ALL Voices × Languages"}
              </button>

              {/* Log output */}
              {previewLog.length > 0 && (
                <div className="mt-4 rounded-xl px-3 py-3 flex flex-col gap-1.5 max-h-72 overflow-y-auto"
                  style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  {previewLog.map((entry, i) => (
                    <p key={i} className="text-fs-body leading-snug"
                      style={{
                        color: entry.type === "error" ? "#f87171"
                          : entry.type === "success" ? "#34d399"
                          : "rgba(255,255,255,0.45)",
                        fontFamily: "monospace",
                      }}>
                      {entry.text}
                    </p>
                  ))}
                </div>
              )}
            </div>

            {/* ── Promote Story Panel ── */}
            <div className="rounded-2xl p-5"
              style={{ background: "rgba(79,195,247,0.04)", border: "1px solid rgba(79,195,247,0.18)" }}>
              <div className="flex items-start justify-between mb-1">
                <div>
                  <p className="text-white font-bold text-fs-body">🌟 Promote Story</p>
                  <p className="text-fs-body mt-0.5" style={{ color: "rgba(255,255,255,0.52)" }}>
                    Features a story on the home hero banner for every family, instead of it defaulting
                    to the most recently created story. Only one story can be promoted at a time —
                    promoting a new one automatically un-promotes the last.
                  </p>
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <input
                  type="text"
                  value={promoteStoryId}
                  onChange={(e) => setPromoteStoryId(e.target.value)}
                  placeholder="Story ID"
                  disabled={promoteRunning}
                  className="flex-1 rounded-xl px-3 py-2.5 text-fs-body outline-none text-white/80"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}
                />
                <button
                  onClick={() => handlePromoteStory(true)}
                  disabled={promoteRunning || !promoteStoryId.trim()}
                  className="px-4 py-2.5 rounded-xl text-fs-body font-bold transition-all active:scale-[0.98] disabled:opacity-40"
                  style={{ background: "rgba(79,195,247,0.15)", border: "1px solid rgba(79,195,247,0.4)", color: "#4fc3f7" }}>
                  Promote
                </button>
                <button
                  onClick={() => handlePromoteStory(false)}
                  disabled={promoteRunning || !promoteStoryId.trim()}
                  className="px-4 py-2.5 rounded-xl text-fs-body font-bold transition-all active:scale-[0.98] disabled:opacity-40"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }}>
                  Un-promote
                </button>
              </div>

              {/* Log output */}
              {promoteLog.length > 0 && (
                <div className="mt-4 rounded-xl px-3 py-3 flex flex-col gap-1.5 max-h-72 overflow-y-auto"
                  style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  {promoteLog.map((entry, i) => (
                    <p key={i} className="text-fs-body leading-snug"
                      style={{
                        color: entry.type === "error" ? "#f87171"
                          : entry.type === "success" ? "#34d399"
                          : "rgba(255,255,255,0.45)",
                        fontFamily: "monospace",
                      }}>
                      {entry.text}
                    </p>
                  ))}
                </div>
              )}
            </div>

            {/* ── Delete Story Panel ── */}
            <div className="rounded-2xl p-5"
              style={{ background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.18)" }}>
              <div className="flex items-start justify-between mb-1">
                <div>
                  <p className="text-white font-bold text-fs-body">🗑️ Delete Story</p>
                  <p className="text-fs-body mt-0.5" style={{ color: "rgba(255,255,255,0.52)" }}>
                    Moves a story to trash by its story ID — the same action a user gets from their own
                    story's card, just usable on any story regardless of owner. Recoverable from Trash for
                    30 days; this is not a permanent delete.
                  </p>
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <input
                  type="text"
                  value={deleteStoryId}
                  onChange={(e) => setDeleteStoryId(e.target.value)}
                  placeholder="Story ID"
                  disabled={deleteRunning}
                  className="flex-1 rounded-xl px-3 py-2.5 text-fs-body outline-none text-white/80"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}
                />
                <button
                  onClick={handleDeleteStory}
                  disabled={deleteRunning || !deleteStoryId.trim()}
                  className="px-4 py-2.5 rounded-xl text-fs-body font-bold transition-all active:scale-[0.98] disabled:opacity-40"
                  style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)", color: "#f87171" }}>
                  Delete This Story
                </button>
              </div>

              {/* Log output */}
              {deleteLog.length > 0 && (
                <div className="mt-4 rounded-xl px-3 py-3 flex flex-col gap-1.5 max-h-72 overflow-y-auto"
                  style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  {deleteLog.map((entry, i) => (
                    <p key={i} className="text-fs-body leading-snug"
                      style={{
                        color: entry.type === "error" ? "#f87171"
                          : entry.type === "success" ? "#34d399"
                          : "rgba(255,255,255,0.45)",
                        fontFamily: "monospace",
                      }}>
                      {entry.text}
                    </p>
                  ))}
                </div>
              )}
            </div>

            {/* ── Delete Audio Only Panel ── */}
            <div className="rounded-2xl p-5"
              style={{ background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.18)" }}>
              <div className="flex items-start justify-between mb-1">
                <div>
                  <p className="text-white font-bold text-fs-body">🔇 Delete Audio Only</p>
                  <p className="text-fs-body mt-0.5" style={{ color: "rgba(255,255,255,0.52)" }}>
                    Removes just the produced audio file and clears audio_url, by story ID — usable on any
                    story regardless of owner. Script, cover, scenes, and everything else stay untouched.
                    Not recoverable; re-produce the story to generate new audio.
                  </p>
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <input
                  type="text"
                  value={deleteAudioStoryId}
                  onChange={(e) => setDeleteAudioStoryId(e.target.value)}
                  placeholder="Story ID"
                  disabled={deleteAudioRunning}
                  className="flex-1 rounded-xl px-3 py-2.5 text-fs-body outline-none text-white/80"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}
                />
                <button
                  onClick={handleDeleteAudio}
                  disabled={deleteAudioRunning || !deleteAudioStoryId.trim()}
                  className="px-4 py-2.5 rounded-xl text-fs-body font-bold transition-all active:scale-[0.98] disabled:opacity-40"
                  style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)", color: "#f87171" }}>
                  Delete Audio
                </button>
              </div>

              {/* Log output */}
              {deleteAudioLog.length > 0 && (
                <div className="mt-4 rounded-xl px-3 py-3 flex flex-col gap-1.5 max-h-72 overflow-y-auto"
                  style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  {deleteAudioLog.map((entry, i) => (
                    <p key={i} className="text-fs-body leading-snug"
                      style={{
                        color: entry.type === "error" ? "#f87171"
                          : entry.type === "success" ? "#34d399"
                          : "rgba(255,255,255,0.45)",
                        fontFamily: "monospace",
                      }}>
                      {entry.text}
                    </p>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
