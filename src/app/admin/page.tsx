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

function TextInput({ value, onChange, placeholder, rows }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  if (rows) {
    return <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows}
      className={baseInput + " resize-none"} style={baseStyle} />;
  }
  return <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
    className={baseInput} style={baseStyle} />;
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
      <span className="text-fs-body font-bold uppercase tracking-widest flex-shrink-0" style={{ color: "rgba(255,255,255,0.25)" }}>{title}</span>
      <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
    </div>
  );
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
              : { color: "rgba(255,255,255,0.25)", border: "1px solid transparent" }}>
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
          <p className="text-center py-6 text-fs-body" style={{ color: "rgba(255,255,255,0.2)" }}>No avatars yet</p>
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

function DirectionSheet({ characterName, voice, voicePool, avatarUrl, characterType, onAvatarChange, onVoiceChange, onClose }: {
  characterName: string;
  voice: Voice | undefined;
  voicePool: Voice[];
  avatarUrl?: string;
  characterType: CharacterType;
  onAvatarChange: (url: string, type: CharacterType) => void;
  onVoiceChange: (voiceId: string) => void;
  onClose: () => void;
}) {
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showVoicePicker, setShowVoicePicker]   = useState(false);

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
                  <span style={{ fontSize: "var(--fs-caption)", color: "rgba(255,255,255,0.35)" }}>🎙</span>
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

function CharacterCards({ blocks, voicePool, avatars, characterTypes, openCharacter, onOpen, onClose, onAvatarChange, onVoiceChange }: {
  blocks: ScriptBlock[];
  voicePool: Voice[];
  avatars: Record<string, string>;
  characterTypes: Record<string, CharacterType>;
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
}

interface StoryCost {
  id: string; title: string; isPublic: boolean;
  durationSeconds: number; blockCount: number;
  geminiChars: number; elChars: number;
  estimatedSfx: number; estimatedTokens: number; hasCover: boolean;
  costs: { geminiTextGen: number; geminiTts: number; geminiImage: number; elTts: number; elSfx: number; total: number };
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
          <p className="text-fs-body" style={{ color: "rgba(255,255,255,0.35)" }}>{item.label}</p>
          <p className="text-white font-bold text-fs-subtitle">{item.value}</p>
          <p className="text-fs-body" style={{ color: "rgba(255,255,255,0.25)" }}>{item.sub}</p>
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
        {sub && <p className="text-fs-body" style={{ color: "rgba(255,255,255,0.3)" }}>{sub}</p>}
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
        <span className="flex-1 text-fs-body font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.3)" }}>Service</span>
        <span className="text-fs-body font-bold uppercase tracking-widest flex-shrink-0" style={{ color: "rgba(255,255,255,0.3)", minWidth: 80, textAlign: "right" }}>Usage</span>
        <span className="text-fs-body font-bold uppercase tracking-widest flex-shrink-0" style={{ color: "rgba(255,255,255,0.3)", minWidth: 70, textAlign: "right" }}>Cost</span>
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

// ── Mode A: API usage tracker (cumulative) ────────────────────────────────────
function UsageMode({ data, onRefresh }: { data: CostData; onRefresh: () => void }) {
  const { totals, storyCount, publicCount, privateCount, totalDurationSec } = data;
  const totalMinutes = totalDurationSec / 60;
  const costs = {
    gemini_text:  totals.gemini_tokens      * PRICING.gemini_token,
    gemini_tts:   totals.gemini_tts_chars   * PRICING.gemini_tts_char,
    gemini_image: totals.gemini_image_calls * PRICING.gemini_image,
    el_tts:       totals.el_tts_chars       * PRICING.el_tts_char,
    el_sfx:       totals.el_sfx_calls       * PRICING.el_sfx_call,
  };
  const totalCost   = Object.values(costs).reduce((s, c) => s + c, 0);
  const totalTts    = totals.gemini_tts_chars + totals.el_tts_chars;
  const elPct       = totalTts > 0 ? Math.round((totals.el_tts_chars / totalTts) * 100) : 0;

  return (
    <div className="flex flex-col gap-4">
      <SummaryChips items={[
        { label: "Total stories",  value: storyCount,                            sub: `${publicCount} public · ${privateCount} private` },
        { label: "Total audio",    value: fmtDuration(totalDurationSec),          sub: `${totalMinutes.toFixed(1)} min` },
        { label: "Cost / minute",  value: fmtCost(totalCost / (totalMinutes||1)), sub: "cumulative average" },
        { label: "Cost / story",   value: fmtCost(totalCost / (storyCount||1)),   sub: "cumulative average" },
      ]} />

      <div className="rounded-xl px-3 py-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <p className="text-fs-body font-bold mb-2" style={{ color: "rgba(255,255,255,0.35)" }}>TTS Voice Split</p>
        <div className="flex rounded-full overflow-hidden mb-2" style={{ height: 8 }}>
          <div style={{ width: `${100 - elPct}%`, background: "linear-gradient(90deg,#4fc3f7,#a78bfa)" }} />
          <div style={{ width: `${elPct}%`, background: "linear-gradient(90deg,#f59e0b,#EC4899)" }} />
        </div>
        <div className="flex justify-between">
          <span className="text-fs-body" style={{ color: "#4fc3f7" }}>Gemini {100-elPct}% — {fmtNum(totals.gemini_tts_chars)} chars</span>
          <span className="text-fs-body" style={{ color: "#f59e0b" }}>EL {elPct}% — {fmtNum(totals.el_tts_chars)} chars</span>
        </div>
      </div>

      <BreakdownTable total={totalCost} rows={[
        { label: "Gemini Text Gen",  usage: `${fmtNum(totals.gemini_tokens)} tokens`, cost: costs.gemini_text,  sub: `${totals.gemini_calls} calls · $0.40/1M tokens` },
        { label: "Gemini TTS",       usage: `${fmtNum(totals.gemini_tts_chars)} chars`, cost: costs.gemini_tts, sub: `${totals.gemini_tts_calls} calls · $0.10/1M chars` },
        { label: "Gemini Images",    usage: `${totals.gemini_image_calls} images`,    cost: costs.gemini_image, sub: "$0.04/image (Imagen)" },
        { label: "ElevenLabs TTS",   usage: `${fmtNum(totals.el_tts_chars)} chars`,   cost: costs.el_tts,       sub: `${totals.el_tts_calls} calls · $0.20/1K chars` },
        { label: "ElevenLabs SFX",   usage: `${totals.el_sfx_calls} effects`,         cost: costs.el_sfx,       sub: `${fmtNum(totals.el_sfx_chars)} prompt chars · $0.08/effect` },
      ]} />

      <p className="text-center text-fs-body" style={{ color: "rgba(255,255,255,0.2)" }}>
        Includes test runs, retries, voice previews — not just produced stories
      </p>
      <button onClick={onRefresh} className="text-fs-body px-4 py-2 rounded-xl transition-all active:scale-95 self-center"
        style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.08)" }}>
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
        <p className="text-fs-body font-bold mb-2" style={{ color: "rgba(255,255,255,0.35)" }}>TTS Voice Split (from blocks)</p>
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
      <p className="text-fs-body font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.28)" }}>Per Story</p>
      <div className="flex flex-col gap-1.5">
        {[...stories].sort((a, b) => b.costs.total - a.costs.total).map((s) => (
          <div key={s.id}>
            <button
              onClick={() => setExpanded(expanded === s.id ? null : s.id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
              style={{ background: expanded === s.id ? "rgba(79,195,247,0.07)" : "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <span className="text-fs-body flex-shrink-0" style={{ color: "rgba(255,255,255,0.25)" }}>
                {s.isPublic ? "🌍" : "🔒"}
              </span>
              <span className="flex-1 text-white text-fs-body truncate">{s.title}</span>
              <span className="text-fs-body flex-shrink-0" style={{ color: "rgba(255,255,255,0.35)" }}>
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
                    <span className="text-fs-body" style={{ color: "rgba(255,255,255,0.25)" }}>{usage as string}</span>
                    <span className="text-fs-body font-bold" style={{ color: "#4fc3f7", minWidth: 60, textAlign: "right" }}>{fmtCost(cost as number)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <p className="text-center text-fs-body" style={{ color: "rgba(255,255,255,0.2)" }}>
        Derived from script blocks · SFX & text-gen are estimated
      </p>
      <button onClick={onRefresh} className="text-fs-body px-4 py-2 rounded-xl transition-all active:scale-95 self-center"
        style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.08)" }}>
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
              : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.35)" }}>
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
    return <p className="text-fs-body" style={{ color: "rgba(255,255,255,0.2)" }}>No public stories yet.</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      {classics.map((c) => (
        <div key={c.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <span className="text-fs-subtitle flex-shrink-0">{c.emoji}</span>
          <div className="flex-1 min-w-0">
            <p className="text-white text-fs-body font-medium truncate">{c.title}</p>
            <p className="text-fs-body truncate" style={{ color: "rgba(255,255,255,0.28)" }}>{c.tagline}</p>
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
      <p className="text-fs-body" style={{ color: "rgba(255,255,255,0.35)" }}>
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

  // ── Add Story fields ──────────────────────────────────────────────────────
  const [addTitle, setAddTitle]           = useState("");
  const [addScript, setAddScript]         = useState("");
  const [addIsPublic, setAddIsPublic]     = useState(true);
  const [addCategory, setAddCategory]     = useState<"classics" | "community">("classics");
  const [parsedBlocks, setParsedBlocks]   = useState<ScriptBlock[]>([]);
  const [validationIssues, setValidationIssues] = useState<string[]>([]);
  const [processState, setProcessState]   = useState<"idle" | "processing" | "done" | "error">("idle");
  const [processPhase, setProcessPhase]   = useState("");
  const [validationChanges, setValidationChanges] = useState(0);
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
  const [storeCoverUrl, setStoreCoverUrl]         = useState(""); // base64 data URL from generate-cover
  const [storeCoverLoading, setStoreCoverLoading] = useState(false);
  const [storeCoverPrompt, setStoreCoverPrompt]   = useState("");
  const [storeSummary, setStoreSummary]           = useState("");

  // ── Explicit DB save (after production) ──────────────────────────────────
  const [addSaving, setAddSaving]       = useState(false);
  const [addSaveError, setAddSaveError] = useState("");
  const [addSaved, setAddSaved]         = useState(false);

  // ── Cast / voice pool ─────────────────────────────────────────────────────
  const [voicePool, setVoicePool]               = useState<Voice[]>(PRESET_VOICE_POOL);
  const [bankAvatars, setBankAvatars]           = useState<BankAvatar[]>([]);
  const [characterAvatars, setCharacterAvatars] = useState<Record<string, string>>({});
  const [openDirectSheet, setOpenDirectSheet]   = useState<string | null>(null);
  const [characterTypes, setCharacterTypes]     = useState<Record<string, CharacterType>>({});

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
      if (!m) continue;
      const charName = m[1].trim();
      const rest = m[2].trim();
      if (charName.startsWith("SFX")) {
        // Store entire original bracket as textPayload so validate-script sees the full SFX block
        const textPayload = `[${charName}]${rest ? " " + rest : ""}`;
        out.push({ id: uid(), blockOrder: out.length, characterName: "SFX", assignedVoiceId: "", textPayload });
      } else {
        if (!voiceMap[charName]) {
          voiceMap[charName] = charName.toLowerCase() === "narrator"
            ? "Aoede"
            : CHAR_VOICE_POOL[voiceIdx++ % CHAR_VOICE_POOL.length];
        }
        if (rest) {
          out.push({ id: uid(), blockOrder: out.length, characterName: charName, assignedVoiceId: voiceMap[charName], textPayload: rest });
        }
      }
    }
    return out;
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

    // Auto-assign avatars from bank for all cast members
    const uniqueChars = Array.from(new Set(blocks.filter((b) => b.characterName !== "SFX").map((b) => b.characterName)));
    const autoAvatars: Record<string, string> = {};
    const autoTypes: Record<string, CharacterType> = {};
    for (const char of uniqueChars) {
      const type: CharacterType = char.toLowerCase() === "narrator" ? "narrator" : "adult";
      autoTypes[char] = type;
      autoAvatars[char] = pickBankAvatar(char, type, bankAvatars);
    }
    setCharacterAvatars(autoAvatars);
    setCharacterTypes(autoTypes);

    const rawBlocks = blocks.map((b) => ({ characterName: b.characterName, textPayload: b.textPayload }));

    // Same two-pass verification the normal generation flow (studio2's
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

    // Round 2.5 — per-block age-appropriateness + typo/grammar check.
    setProcessPhase("Checking grammar & typos…");
    let finalBlocks = policyBlocks;
    try {
      const gramRes = await fetch("/api/validate-blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks: policyBlocks, age, summary }),
      });
      const gramData = await gramRes.json() as { blocks?: ScriptBlock[]; changes?: number };
      if (gramData.blocks?.length === policyBlocks.length) {
        finalBlocks = gramData.blocks;
        setValidationChanges(gramData.changes ?? 0);
      }
    } catch (err) {
      console.warn("[Admin][Validation] Grammar/age check failed, using policy-checked script:", err);
    }
    // Strip a redundant "CharacterName:" prefix some pasted/generated scripts
    // bake into the line itself — same cleanup the normal flow applies.
    finalBlocks = finalBlocks.map((b) => ({ ...b, textPayload: stripNamePrefix(b.characterName, b.textPayload) }));
    setParsedBlocks(finalBlocks);

    setProcessPhase("");
    setProcessState("done");

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
      // 1. Classify characters
      log("Classifying characters…");
      const charNames = Array.from(new Set(blocks.map((b) => b.characterName)));
      const classifyRes = await fetch("/api/classify-characters", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characters: charNames, summary: storeSummary || addTitle }),
      });
      const classifyData = await classifyRes.json() as { types?: Record<string, string> };
      const characterTypes = classifyData.types ?? {};

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
        durationMinutes: 5,
        skipLibrarySave: true,
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
    setAddSaving(true); setAddSaveError("");
    try {
      const res = await fetch("/api/admin/save-story", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      const d = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(d.error ?? "Save failed");
      setAddSaved(true);
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
    if (!confirm("Generate preview samples for EVERY voice × English + Hebrew (~66 TTS calls across Gemini + ElevenLabs)? This will take a while and use real API quota.")) return;
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
            <p className="text-fs-body mt-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>{user.email}</p>
          </div>
          {adminTab === "factory" && (
            <button onClick={resetAddStory}
              className="text-fs-body px-3 py-1.5 rounded-lg transition-all active:scale-95"
              style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.08)" }}>
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
                : { background: "transparent", border: "1px solid transparent", color: "rgba(255,255,255,0.35)" }}>
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
                    : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.3)" }}>
                  {cat === "classics" ? "✨ Classics" : "🌍 Community"}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Script ── */}
        <Divider title="Script" />
        <p className="text-fs-body mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>
          Use <span style={{ color: "#4fc3f7" }}>[Character Name]</span> to mark each speaker. Example:
        </p>
        <div className="rounded-xl px-3 py-2.5 mb-3 text-fs-body leading-relaxed"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.35)", fontFamily: "monospace", fontSize: 12 }}>
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
        <TextInput value={addTitle} onChange={setAddTitle} placeholder="Maya the Bee" />

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
              characterAvatars={characterAvatars}
              belowCover={
                <CharacterCards
                  blocks={parsedBlocks}
                  voicePool={voicePool}
                  avatars={characterAvatars}
                  characterTypes={characterTypes}
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
                    <p className="text-fs-body mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>
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
                <button
                  onClick={handleSaveStory}
                  disabled={addSaving}
                  className="w-full py-4 rounded-2xl text-fs-subtitle font-bold transition-all active:scale-[0.98] disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg,rgba(79,195,247,0.35),rgba(16,185,129,0.35))", border: "1px solid rgba(79,195,247,0.5)", color: "#fff", boxShadow: "0 4px 24px rgba(79,195,247,0.22)" }}>
                  {addSaving ? "Saving…" : "✅ Add Story to Library"}
                </button>
              </div>
            ) : (
              <div className="rounded-xl px-4 py-3 text-center" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.3)" }}>
                <p className="text-fs-body font-bold" style={{ color: "#34d399" }}>✓ Story saved to library!</p>
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
                  <p className="text-fs-body mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
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
                  <p className="text-fs-body mt-1 text-right" style={{ color: "rgba(255,255,255,0.25)" }}>
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
                  <p className="text-fs-body mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
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

            {/* ── Backfill Character Profiles Panel ── */}
            <div className="rounded-2xl p-5"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex items-start justify-between mb-1">
                <div>
                  <p className="text-white font-bold text-fs-body">🧬 Backfill Character Profiles</p>
                  <p className="text-fs-body mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
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
                  <p className="text-fs-body mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
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
                  <p className="text-fs-body mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
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
                  <p className="text-fs-body mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
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

            {/* ── Delete Story Panel ── */}
            <div className="rounded-2xl p-5"
              style={{ background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.18)" }}>
              <div className="flex items-start justify-between mb-1">
                <div>
                  <p className="text-white font-bold text-fs-body">🗑️ Delete Story</p>
                  <p className="text-fs-body mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
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
                  <p className="text-fs-body mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
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
