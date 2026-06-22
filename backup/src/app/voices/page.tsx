"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "@/context/LanguageContext";
import { useViewMode } from "@/context/ViewModeContext";
import VoiceAvatar, { AVATAR_STYLES } from "@/components/ui/VoiceAvatar";
import { PRESET_VOICES, type PresetVoiceConfig } from "@/config/presetVoices";
import {
  SYSTEM_AVATARS,
  SYSTEM_AVATAR_CATEGORIES,
  CATEGORY_LABELS,
  type SystemAvatarCategory,
} from "@/config/systemAvatars";

// ─── Types ────────────────────────────────────────────────────────────────────

interface VoiceRecord {
  id: string;
  name: string;
  category: string;
  type: string;
  description?: string;
  gemini_voice_name?: string;
  el_voice_id?: string;
  sample_url?: string;
  avatar_emoji: string;
  created_at: number;
}

type Tab = "family" | "general";
type AddMethod = "text" | "record";
type RecordState = "idle" | "recording" | "done";
type PreviewState = "idle" | "loading" | "ready";

type PresetVoice = PresetVoiceConfig;

function isAvatarUrl(v: string): boolean {
  return v.startsWith("https://") || v.startsWith("http://");
}

const SAMPLE_TEXTS: Record<string, string> = {
  en: "This is me and I will be happy to join your story",
  he: "זה אני, ואשמח להצטרף לסיפור שלך",
  ar: "هذا أنا وسأكون سعيداً بالانضمام إلى قصتك",
  fr: "C'est moi et je serai heureux de rejoindre ton histoire",
  es: "Soy yo y estaré feliz de unirme a tu historia",
  de: "Das bin ich und ich würde mich freuen, an deiner Geschichte teilzunehmen",
  it: "Sono io e sarò felice di unirmi alla tua storia",
  pt: "Sou eu e ficaria feliz em me juntar à sua história",
  ru: "Это я, и я буду рад присоединиться к твоей истории",
  zh: "这是我，我将很乐意加入你的故事",
};

// ─── Audio helpers ────────────────────────────────────────────────────────────

function base64ToObjectUrl(base64: string, mimeType: string): string {
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
  const blob = new Blob([bytes], { type: mimeType });
  return URL.createObjectURL(blob);
}

// ─── Avatar Gallery Sheet ─────────────────────────────────────────────────────

function AvatarGallerySheet({
  currentValue,
  systemAvatarUrls,
  portraitsReady,
  portraitsTotal,
  onSelect,
  onClose,
}: {
  currentValue: string;
  systemAvatarUrls: Record<string, string>;
  portraitsReady: number;
  portraitsTotal: number;
  onSelect: (value: string) => void;
  onClose: () => void;
}) {
  const { effective } = useViewMode();
  const sheetMaxWidth = effective === "mobile" ? 448 : 512;
  const [activeCategory, setActiveCategory] = useState<SystemAvatarCategory | "all">("all");

  const filtered =
    activeCategory === "all"
      ? SYSTEM_AVATARS
      : SYSTEM_AVATARS.filter((a) => a.category === activeCategory);

  return createPortal(
    <>
      <div
        className="fixed inset-0"
        style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(6px)", zIndex: 9998 }}
        onClick={onClose}
      />
      <div
        className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full rounded-t-3xl flex flex-col overflow-hidden"
        style={{
          maxWidth: sheetMaxWidth,
          background: "rgba(8,12,24,0.97)",
          border: "1px solid rgba(255,255,255,0.09)",
          zIndex: 9999,
          maxHeight: "88vh",
        }}
      >
        {/* Top accent */}
        <div className="h-0.5 w-full flex-shrink-0" style={{ background: "linear-gradient(90deg,#4fc3f7,#8B5CF6)" }} />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 flex-shrink-0">
          <div>
            <h2 className="text-white font-bold text-sm">Choose Avatar</h2>
            {portraitsTotal > 0 && portraitsReady < portraitsTotal ? (
              <p className="text-[11px] mt-0.5 flex items-center gap-1.5" style={{ color: "rgba(79,195,247,0.6)" }}>
                <span className="w-1.5 h-1.5 rounded-full inline-block animate-pulse" style={{ background: "#4fc3f7" }} />
                Painting portraits… {portraitsReady}/{portraitsTotal}
              </p>
            ) : (
              <p className="text-white/30 text-[11px] mt-0.5">{SYSTEM_AVATARS.length} avatars</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:text-white/70 transition-colors"
            style={{ background: "rgba(255,255,255,0.06)" }}
          >
            ×
          </button>
        </div>

        {/* Category filter */}
        <div className="px-5 pb-3 flex-shrink-0">
          <div className="flex gap-1.5 overflow-x-auto hide-scrollbar">
            <button
              onClick={() => setActiveCategory("all")}
              className="flex-shrink-0 px-3 py-1 rounded-full text-[11px] font-semibold transition-all"
              style={
                activeCategory === "all"
                  ? { background: "rgba(79,195,247,0.18)", border: "1px solid rgba(79,195,247,0.4)", color: "#4fc3f7" }
                  : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)" }
              }
            >
              All
            </button>
            {SYSTEM_AVATAR_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className="flex-shrink-0 px-3 py-1 rounded-full text-[11px] font-semibold transition-all"
                style={
                  activeCategory === cat
                    ? { background: "rgba(79,195,247,0.18)", border: "1px solid rgba(79,195,247,0.4)", color: "#4fc3f7" }
                    : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)" }
                }
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable avatar grid */}
        <div className="flex-1 overflow-y-auto px-4 pb-2">
          <div className="grid grid-cols-4 gap-2.5">
            {filtered.map((avatar) => {
              // Use AI portrait if seeded, else DiceBear fallback
              const displayUrl = systemAvatarUrls[avatar.id] ?? avatar.url;
              const isPortrait = !!systemAvatarUrls[avatar.id];
              const isSelected = currentValue === displayUrl || currentValue === avatar.url;
              return (
                <button
                  key={avatar.id}
                  onClick={() => { onSelect(displayUrl); onClose(); }}
                  className="flex flex-col items-center gap-1 p-2 rounded-2xl transition-all active:scale-95"
                  style={{
                    background: isSelected ? "rgba(79,195,247,0.12)" : "rgba(255,255,255,0.03)",
                    border: isSelected
                      ? "1.5px solid rgba(79,195,247,0.5)"
                      : "1.5px solid rgba(255,255,255,0.06)",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={displayUrl}
                    alt={avatar.label}
                    className="w-14 h-14 rounded-xl object-cover"
                    style={{ imageRendering: isPortrait ? "auto" : "crisp-edges" }}
                  />
                  <span className="text-[9px] text-white/50 truncate w-full text-center leading-none">
                    {avatar.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Divider + Color section */}
        <div className="flex-shrink-0 px-5 pt-3 pb-6" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-white/30 text-[10px] uppercase tracking-widest mb-2.5 font-semibold">Color style</p>
          <div className="flex gap-2.5 flex-wrap">
            {AVATAR_STYLES.map(({ key, gradient, label }) => (
              <button
                key={key}
                onClick={() => { onSelect(key); onClose(); }}
                title={label}
                className="rounded-full transition-all active:scale-90"
                style={{
                  width: 34,
                  height: 34,
                  background: gradient,
                  border: currentValue === key ? "2.5px solid #4fc3f7" : "2px solid rgba(255,255,255,0.12)",
                  boxShadow: currentValue === key ? "0 0 0 2px rgba(79,195,247,0.3)" : "none",
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}

// ─── Voice Card ───────────────────────────────────────────────────────────────

function VoiceCard({
  voice,
  playingId,
  systemAvatarUrls,
  portraitsReady,
  portraitsTotal,
  onPlay,
  onDelete,
  onAvatarChange,
}: {
  voice: VoiceRecord;
  playingId: string | null;
  systemAvatarUrls: Record<string, string>;
  portraitsReady: number;
  portraitsTotal: number;
  onPlay: (v: VoiceRecord) => void;
  onDelete: (id: string) => void;
  onAvatarChange: (id: string, value: string) => void;
}) {
  const isPlaying = playingId === voice.id;
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const avatarIsUrl = isAvatarUrl(voice.avatar_emoji);

  return (
    <div className="flex flex-col gap-0">
      <div
        className="flex items-center gap-3 px-4 py-3.5 rounded-2xl"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        {/* Clickable avatar — opens gallery */}
        <div className="relative flex-shrink-0">
          <VoiceAvatar
            avatarUrl={avatarIsUrl ? voice.avatar_emoji : undefined}
            emoji={avatarIsUrl ? undefined : voice.avatar_emoji}
            name={voice.name}
            size={44}
            borderColor={galleryOpen ? "rgba(79,195,247,0.6)" : "rgba(79,195,247,0.25)"}
            onClick={() => setGalleryOpen((o) => !o)}
          />
          <span
            className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center pointer-events-none"
            style={{
              background: "rgba(8,12,24,0.9)",
              border: "1px solid rgba(79,195,247,0.4)",
              fontSize: 8,
              color: "#4fc3f7",
            }}
          >
            ✎
          </span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold truncate">{voice.name}</p>
          <p className="text-white/45 text-xs truncate mt-0.5">
            {voice.description ?? voice.gemini_voice_name ?? (voice.type === "recorded" ? "Cloned voice" : "AI voice")}
          </p>
        </div>

        {/* Play */}
        <button
          disabled={!voice.sample_url}
          onClick={() => onPlay(voice)}
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs flex-shrink-0 transition-all active:scale-95"
          style={{
            background: isPlaying ? "rgba(79,195,247,0.15)" : "rgba(255,255,255,0.05)",
            color: isPlaying ? "#4fc3f7" : voice.sample_url ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.15)",
            border: isPlaying ? "1px solid rgba(79,195,247,0.4)" : "1px solid rgba(255,255,255,0.08)",
            cursor: voice.sample_url ? "pointer" : "not-allowed",
          }}
          title={voice.sample_url ? (isPlaying ? "Stop" : "Play sample") : "No sample available"}
        >
          {isPlaying ? "⏹" : "▶"}
        </button>

        {/* Delete */}
        <button
          onClick={() => onDelete(voice.id)}
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs flex-shrink-0 transition-all active:scale-95"
          style={{
            background: "rgba(255,255,255,0.04)",
            color: "rgba(255,255,255,0.3)",
            border: "1px solid rgba(255,255,255,0.07)",
          }}
          title="Delete voice"
        >
          ×
        </button>
      </div>

      {/* Avatar gallery sheet portal */}
      {galleryOpen && mounted && (
        <AvatarGallerySheet
          currentValue={voice.avatar_emoji}
          systemAvatarUrls={systemAvatarUrls}
          portraitsReady={portraitsReady}
          portraitsTotal={portraitsTotal}
          onSelect={(value) => {
            onAvatarChange(voice.id, value);
            setGalleryOpen(false);
          }}
          onClose={() => setGalleryOpen(false)}
        />
      )}
    </div>
  );
}

// ─── Preset Voice Card ────────────────────────────────────────────────────────

function PresetCard({
  voice,
  avatarUrl,
  isPlaying,
  isCached,
  onPlay,
}: {
  voice: PresetVoice;
  avatarUrl?: string;
  isPlaying: boolean;
  isCached: boolean;
  onPlay: (v: PresetVoice) => void;
}) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3.5 rounded-2xl"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      <VoiceAvatar avatarUrl={avatarUrl} emoji={voice.emoji} size={44} borderColor="rgba(245,158,11,0.25)" />

      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-semibold">{voice.name}</p>
        <p className="text-white/45 text-[13px] mt-0.5">{voice.desc}</p>
      </div>

      {isCached && !isPlaying && (
        <span
          className="text-[9px] px-1.5 py-0.5 rounded-md flex-shrink-0"
          style={{
            background: "rgba(79,195,247,0.08)",
            color: "rgba(79,195,247,0.5)",
            border: "1px solid rgba(79,195,247,0.15)",
          }}
        >
          ready
        </span>
      )}

      <button
        onClick={() => onPlay(voice)}
        className="w-8 h-8 rounded-full flex items-center justify-center text-xs flex-shrink-0 transition-all active:scale-95"
        style={{
          background: isPlaying ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.05)",
          color: isPlaying ? "#F59E0B" : "rgba(255,255,255,0.45)",
          border: isPlaying ? "1px solid rgba(245,158,11,0.4)" : "1px solid rgba(255,255,255,0.08)",
        }}
        title={isPlaying ? "Stop" : isCached ? "Play cached sample" : "Generate & play sample"}
      >
        {isPlaying ? "⏹" : "▶"}
      </button>
    </div>
  );
}

// ─── Add Voice Sheet ──────────────────────────────────────────────────────────

function AddVoiceSheet({
  language,
  systemAvatarUrls,
  portraitsReady,
  portraitsTotal,
  onClose,
  onSaved,
}: {
  language: string;
  systemAvatarUrls: Record<string, string>;
  portraitsReady: number;
  portraitsTotal: number;
  onClose: () => void;
  onSaved: (voice: VoiceRecord) => void;
}) {
  const { effective } = useViewMode();
  const sheetMaxWidth = effective === "mobile" ? 448 : 512;
  const [name, setName] = useState("");
  const [avatarValue, setAvatarValue] = useState("azure");
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [method, setMethod] = useState<AddMethod>("text");
  const [description, setDescription] = useState("");
  const [recordState, setRecordState] = useState<RecordState>("idle");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedAudioBase64, setRecordedAudioBase64] = useState<string | null>(null);
  const [recordedMimeType, setRecordedMimeType] = useState("audio/webm");
  const [previewState, setPreviewState] = useState<PreviewState>("idle");
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null);
  const [previewGeminiVoiceName, setPreviewGeminiVoiceName] = useState<string | null>(null);
  const [previewElVoiceId, setPreviewElVoiceId] = useState<string | null>(null);
  const [previewMimeType, setPreviewMimeType] = useState("audio/wav");
  const [previewBase64, setPreviewBase64] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const sampleText = SAMPLE_TEXTS[language] ?? SAMPLE_TEXTS.en;

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, []);

  const stopPreviewAudio = useCallback(() => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    setPreviewPlaying(false);
  }, []);

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const mimeType = mr.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setRecordedMimeType(mimeType);
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          setRecordedAudioBase64(result.split(",")[1] ?? "");
          setRecordState("done");
        };
        reader.readAsDataURL(blob);
      };
      mr.start();
      setRecordState("recording");
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    } catch {
      setPreviewError("Microphone access denied. Please allow microphone use.");
    }
  };

  const handleStopRecording = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  };

  const handleGeneratePreview = async () => {
    setPreviewState("loading");
    setPreviewError(null);
    stopPreviewAudio();
    try {
      const body =
        method === "text"
          ? { type: "text", description, language }
          : { type: "recorded", audioBase64: recordedAudioBase64!, audioMimeType: recordedMimeType, name: name.trim() || "My Voice", language };

      const res = await fetch("/api/voices/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error ?? `Server error ${res.status}`);

      const rd = data as { audioBase64: string; mimeType: string; geminiVoiceName?: string; elVoiceId?: string };
      setPreviewBase64(rd.audioBase64);
      setPreviewMimeType(rd.mimeType);
      if (rd.geminiVoiceName) setPreviewGeminiVoiceName(rd.geminiVoiceName);
      if (rd.elVoiceId) setPreviewElVoiceId(rd.elVoiceId);
      const url = base64ToObjectUrl(rd.audioBase64, rd.mimeType);
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = url;
      setPreviewAudioUrl(url);
      setPreviewState("ready");
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Preview failed");
      setPreviewState("idle");
    }
  };

  const handlePlayPreview = () => {
    if (previewPlaying) { stopPreviewAudio(); return; }
    if (!previewAudioUrl) return;
    const audio = new Audio(previewAudioUrl);
    previewAudioRef.current = audio;
    audio.onended = () => setPreviewPlaying(false);
    audio.onerror = () => { setPreviewError("Playback failed"); setPreviewPlaying(false); };
    audio.play().catch(() => setPreviewError("Playback failed"));
    setPreviewPlaying(true);
  };

  const handleSave = async () => {
    if (!name.trim()) { setSaveError("Please enter a name."); return; }
    if (previewState !== "ready") return;
    setSaving(true);
    setSaveError(null);
    try {
      const body: Record<string, string> = {
        name: name.trim(),
        category: "family",
        type: method === "record" ? "recorded" : "text",
        avatarEmoji: avatarValue,
      };
      if (description) body.description = description;
      if (previewGeminiVoiceName) body.geminiVoiceName = previewGeminiVoiceName;
      if (previewElVoiceId) body.elVoiceId = previewElVoiceId;
      if (previewBase64) { body.audioBase64 = previewBase64; body.mimeType = previewMimeType; }

      const res = await fetch("/api/voices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error ?? `Server error ${res.status}`);
      onSaved(data as VoiceRecord);
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const canGeneratePreview = method === "text" ? description.trim().length > 0 : recordState === "done";
  const currentAvatarIsUrl = isAvatarUrl(avatarValue);

  return createPortal(
    <>
      <div
        className="fixed inset-0"
        style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)", zIndex: avatarPickerOpen ? 9996 : 9998 }}
        onClick={onClose}
      />
      <div
        className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full rounded-t-3xl overflow-hidden flex flex-col"
        style={{
          maxWidth: sheetMaxWidth,
          background: "rgba(8,12,24,0.97)",
          border: "1px solid rgba(255,255,255,0.09)",
          zIndex: avatarPickerOpen ? 9997 : 9999,
          maxHeight: "92vh",
        }}
      >
        <div className="h-0.5 w-full flex-shrink-0" style={{ background: "linear-gradient(90deg,#4fc3f7,#8B5CF6)" }} />

        <div className="overflow-y-auto flex-1 px-5 pt-5 pb-8">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-white font-bold text-base">Add Voice</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-white/40"
              style={{ background: "rgba(255,255,255,0.06)" }}
            >
              ×
            </button>
          </div>

          {/* Name */}
          <div className="mb-4">
            <label className="text-white/50 text-xs mb-1.5 block">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Grandma Ruth"
              className="w-full px-4 py-3 rounded-2xl text-sm text-white placeholder-white/25 outline-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
            />
          </div>

          {/* Avatar picker */}
          <div className="mb-5">
            <label className="text-white/50 text-xs mb-2 block">Avatar</label>
            <button
              onClick={() => setAvatarPickerOpen(true)}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-2xl transition-all active:scale-[0.98]"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <VoiceAvatar
                avatarUrl={currentAvatarIsUrl ? avatarValue : undefined}
                emoji={currentAvatarIsUrl ? undefined : avatarValue}
                name={name || "?"}
                size={36}
                borderColor="rgba(79,195,247,0.3)"
              />
              <span className="text-white/50 text-xs flex-1 text-left">
                {currentAvatarIsUrl ? "Custom avatar selected" : "Choose from gallery…"}
              </span>
              <span className="text-white/30 text-xs">›</span>
            </button>
          </div>

          {/* Method */}
          <div className="mb-5">
            <label className="text-white/50 text-xs mb-2 block">Method</label>
            <div
              className="flex gap-2 p-1 rounded-2xl"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              {(["text", "record"] as AddMethod[]).map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setMethod(m);
                    setPreviewState("idle");
                    setPreviewAudioUrl(null);
                    setPreviewError(null);
                    stopPreviewAudio();
                  }}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all"
                  style={{
                    background: method === m ? "rgba(79,195,247,0.15)" : "transparent",
                    color: method === m ? "#4fc3f7" : "rgba(255,255,255,0.35)",
                    border: method === m ? "1px solid rgba(79,195,247,0.3)" : "1px solid transparent",
                  }}
                >
                  {m === "text" ? "📝 Describe" : "🎤 Record"}
                </button>
              ))}
            </div>
          </div>

          {/* Text method */}
          {method === "text" && (
            <div className="mb-5">
              <label className="text-white/50 text-xs mb-1.5 block">Voice description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the voice character, tone, accent…"
                rows={3}
                className="w-full px-4 py-3 rounded-2xl text-sm text-white placeholder-white/25 outline-none resize-none"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
              />
            </div>
          )}

          {/* Record method */}
          {method === "record" && (
            <div className="mb-5 flex flex-col items-center gap-4">
              <div className="w-full">
                <p className="text-white/50 text-xs mb-2">Read this text aloud for at least 30 seconds:</p>
                <div
                  className="px-4 py-3 rounded-2xl text-sm leading-relaxed"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.65)" }}
                >
                  &ldquo;{sampleText}&rdquo;
                </div>
              </div>
              {recordState === "recording" && (
                <div className="flex items-center gap-1 h-10">
                  {Array.from({ length: 20 }).map((_, i) => (
                    <span key={i} className="w-1 rounded-full flex-shrink-0" style={{ background: "#4fc3f7", height: `${10 + ((i * 7 + 13) % 28)}px`, animation: `bounce 0.4s ease-in-out ${(i % 5) * 0.08}s infinite`, opacity: 0.6 }} />
                  ))}
                </div>
              )}
              {recordState === "recording" && <p className="text-white/40 text-sm">Recording… {recordingSeconds}s</p>}
              {recordState === "done" && <p className="text-[#10D9A0] text-sm font-medium">✓ Recording complete ({recordingSeconds}s)</p>}
              <button
                onClick={recordState === "recording" ? handleStopRecording : handleStartRecording}
                className="w-20 h-20 rounded-full flex items-center justify-center text-3xl active:scale-95 transition-transform"
                style={{
                  background: recordState === "recording" ? "linear-gradient(135deg,#EC4899,#8B1A4A)" : "linear-gradient(135deg,#4fc3f7,#0088AA)",
                  boxShadow: recordState === "recording" ? "0 4px 24px rgba(236,72,153,0.4)" : "0 4px 24px rgba(79,195,247,0.3)",
                }}
              >
                {recordState === "recording" ? "⏹" : "🎤"}
              </button>
              {recordState === "done" && (
                <button onClick={() => { setRecordState("idle"); setRecordedAudioBase64(null); setRecordingSeconds(0); setPreviewState("idle"); setPreviewAudioUrl(null); stopPreviewAudio(); }} className="text-white/30 text-xs">
                  Re-record
                </button>
              )}
            </div>
          )}

          {previewError && (
            <div className="mb-4 px-4 py-2.5 rounded-2xl text-xs" style={{ background: "rgba(236,72,153,0.1)", border: "1px solid rgba(236,72,153,0.25)", color: "#EC4899" }}>
              ⚠ {previewError}
            </div>
          )}

          <button
            onClick={handleGeneratePreview}
            disabled={!canGeneratePreview || previewState === "loading"}
            className="w-full py-3.5 rounded-2xl text-sm font-semibold mb-3 transition-all active:scale-[0.98]"
            style={{
              background: canGeneratePreview && previewState !== "loading" ? "linear-gradient(90deg,#4fc3f7,#0088AA)" : "rgba(255,255,255,0.07)",
              color: canGeneratePreview && previewState !== "loading" ? "#05080F" : "rgba(255,255,255,0.25)",
              cursor: canGeneratePreview && previewState !== "loading" ? "pointer" : "not-allowed",
            }}
          >
            {previewState === "loading" ? "Generating…" : "Generate Preview"}
          </button>

          {previewState === "ready" && previewAudioUrl && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl mb-4" style={{ background: "rgba(79,195,247,0.06)", border: "1px solid rgba(79,195,247,0.2)" }}>
              <button
                onClick={handlePlayPreview}
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                style={{ background: previewPlaying ? "rgba(79,195,247,0.25)" : "rgba(79,195,247,0.15)", color: "#4fc3f7", border: "1px solid rgba(79,195,247,0.35)" }}
              >
                {previewPlaying ? "⏹" : "▶"}
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-[#4fc3f7] text-xs font-medium">Preview ready</p>
                {previewGeminiVoiceName && <p className="text-white/30 text-[10px]">Voice: {previewGeminiVoiceName}</p>}
              </div>
            </div>
          )}

          {saveError && (
            <div className="mb-3 px-4 py-2.5 rounded-2xl text-xs" style={{ background: "rgba(236,72,153,0.1)", border: "1px solid rgba(236,72,153,0.25)", color: "#EC4899" }}>
              ⚠ {saveError}
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={previewState !== "ready" || saving || !name.trim()}
            className="w-full py-3.5 rounded-2xl text-sm font-semibold transition-all active:scale-[0.98]"
            style={{
              background: previewState === "ready" && !saving && name.trim() ? "linear-gradient(90deg,#8B5CF6,#6D28D9)" : "rgba(255,255,255,0.07)",
              color: previewState === "ready" && !saving && name.trim() ? "#fff" : "rgba(255,255,255,0.25)",
              cursor: previewState === "ready" && !saving && name.trim() ? "pointer" : "not-allowed",
            }}
          >
            {saving ? "Saving…" : "Save Voice"}
          </button>
        </div>
      </div>

      {/* Avatar gallery rendered on top of this sheet */}
      {avatarPickerOpen && (
        <AvatarGallerySheet
          currentValue={avatarValue}
          systemAvatarUrls={systemAvatarUrls}
          portraitsReady={portraitsReady}
          portraitsTotal={portraitsTotal}
          onSelect={(v) => { setAvatarValue(v); setAvatarPickerOpen(false); }}
          onClose={() => setAvatarPickerOpen(false)}
        />
      )}
    </>,
    document.body,
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function VoicesPage() {
  const { language } = useLanguage();
  const [tab, setTab] = useState<Tab>("family");
  const [voices, setVoices] = useState<VoiceRecord[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playingPreset, setPlayingPreset] = useState<string | null>(null);
  const [presetError, setPresetError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [voiceSamples, setVoiceSamples] = useState<Record<string, string>>({});
  const [avatarUrls, setAvatarUrls] = useState<Record<string, string>>({});
  const [systemAvatarUrls, setSystemAvatarUrls] = useState<Record<string, string>>({});
  const [portraitsReady, setPortraitsReady] = useState(0);
  const [portraitsTotal, setPortraitsTotal] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const seedingRef = useRef(false);
  const portraitSeedingRef = useRef(false);

  useEffect(() => { setMounted(true); }, []);

  // Seed preset voice avatars (8 Gemini voices)
  useEffect(() => {
    let cancelled = false;
    async function seedAvatars() {
      try {
        const res = await fetch("/api/admin/seed-avatars");
        if (!res.ok) return;
        const { missing, existingAvatarUrls } = await res.json() as {
          missing: { id: string; prompt: string }[];
          existingAvatarUrls: Record<string, string>;
        };
        if (existingAvatarUrls) setAvatarUrls((prev) => ({ ...prev, ...existingAvatarUrls }));
        if (!missing?.length) return;
        for (const { id, prompt } of missing) {
          if (cancelled || !prompt) continue;
          try {
            const seed = Math.floor(Math.random() * 999999);
            const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt.slice(0, 1500))}?model=flux&width=384&height=384&seed=${seed}`;
            const imgRes = await fetch(url);
            if (!imgRes.ok || !imgRes.headers.get("content-type")?.startsWith("image/")) continue;
            if (cancelled) return;
            const blob = await imgRes.blob();
            const cacheRes = await fetch(`/api/admin/seed-avatars?voiceId=${id}`, { method: "POST", body: blob, headers: { "Content-Type": blob.type } });
            if (cacheRes.ok) {
              const { url: cachedUrl } = await cacheRes.json() as { url: string };
              if (cachedUrl) setAvatarUrls((prev) => ({ ...prev, [id]: cachedUrl }));
            }
          } catch { /* ignore individual failures */ }
        }
      } catch { /* ignore */ }
    }
    seedAvatars();
    return () => { cancelled = true; };
  }, []);

  // Portrait-seed system avatars (28 human/fantasy characters) — sequential, DiceBear fallback
  useEffect(() => {
    if (portraitSeedingRef.current) return;
    portraitSeedingRef.current = true;
    let cancelled = false;

    async function seedPortraits() {
      try {
        const res = await fetch("/api/admin/seed-system-avatars");
        if (!res.ok) return;
        const { missing, existingUrls } = await res.json() as {
          missing: { id: string; prompt: string }[];
          existingUrls: Record<string, string>;
        };
        if (existingUrls) {
          setSystemAvatarUrls((prev) => ({ ...prev, ...existingUrls }));
          setPortraitsReady(Object.keys(existingUrls).length);
        }
        if (!missing?.length) {
          setPortraitsTotal(Object.keys(existingUrls ?? {}).length);
          return;
        }
        const total = Object.keys(existingUrls ?? {}).length + missing.length;
        setPortraitsTotal(total);

        for (const { id, prompt } of missing) {
          if (cancelled) return;
          // Two attempts per portrait before giving up
          let succeeded = false;
          for (let attempt = 0; attempt < 2 && !succeeded; attempt++) {
            try {
              const seed = Math.floor(Math.random() * 999999);
              const imgUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?model=flux&width=512&height=512&seed=${seed}&nologo=true`;
              const imgRes = await fetch(imgUrl, { signal: AbortSignal.timeout(25000) });
              const ct = imgRes.headers.get("content-type") ?? "";
              if (!imgRes.ok || !ct.startsWith("image/")) continue;
              if (cancelled) return;
              const blob = await imgRes.blob();
              const cacheRes = await fetch(`/api/admin/seed-system-avatars?avatarId=${id}`, {
                method: "POST", body: blob, headers: { "Content-Type": blob.type },
              });
              if (cacheRes.ok) {
                const { url: cachedUrl } = await cacheRes.json() as { url: string };
                if (cachedUrl && !cancelled) {
                  setSystemAvatarUrls((prev) => ({ ...prev, [id]: cachedUrl }));
                  setPortraitsReady((n) => n + 1);
                  succeeded = true;
                }
              }
            } catch { /* retry or skip */ }
            if (!succeeded && attempt === 0) await new Promise((r) => setTimeout(r, 2000));
          }
          // 2-second gap between portraits to stay under Pollinations rate limit
          if (!cancelled) await new Promise((r) => setTimeout(r, 2000));
        }
      } catch { /* ignore */ }
    }
    seedPortraits();
    return () => { cancelled = true; };
  }, []);

  // Load and seed preset voice samples
  useEffect(() => {
    let cancelled = false;
    fetch("/api/voice-samples")
      .then((r) => r.json())
      .then(async (data) => {
        const cached: Record<string, string> = data.samples ?? {};
        setVoiceSamples(cached);
        const missing = PRESET_VOICES.filter((pv) => !cached[pv.geminiVoiceName]);
        if (missing.length === 0 || seedingRef.current) return;
        seedingRef.current = true;
        for (const pv of missing) {
          if (cancelled) return;
          try {
            const res = await fetch("/api/voice-samples", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ voice: pv.geminiVoiceName }) });
            if (res.ok) {
              const { url } = await res.json() as { url: string };
              if (url && !cancelled) setVoiceSamples((prev) => ({ ...prev, [pv.geminiVoiceName]: url }));
            }
          } catch { /* ignore */ }
        }
        seedingRef.current = false;
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Load voices
  useEffect(() => {
    fetch("/api/voices")
      .then(async (r) => {
        const data: unknown = await r.json();
        if (!r.ok) {
          setLoadError(`${(data as { error?: string })?.error ?? `Server error ${r.status}`} — run the voices table SQL in Supabase if not yet done.`);
          return;
        }
        if (Array.isArray(data)) setVoices(data as VoiceRecord[]);
        else setLoadError("Unexpected response from server.");
      })
      .catch((err: unknown) => setLoadError(`Load failed: ${err instanceof Error ? err.message : String(err)}`));
  }, []);

  const stopAudio = useCallback(() => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null; }
    setPlayingId(null);
    setPlayingPreset(null);
  }, []);

  const handlePlayVoice = useCallback(async (voice: VoiceRecord) => {
    if (playingId === voice.id) { stopAudio(); return; }
    stopAudio();
    if (!voice.sample_url) return;
    setPlayingId(voice.id);
    const audio = new Audio(voice.sample_url);
    audioRef.current = audio;
    audio.onended = () => { setPlayingId(null); audioRef.current = null; };
    audio.onerror = () => { setPlayingId(null); audioRef.current = null; };
    try { await audio.play(); } catch { setPlayingId(null); }
  }, [playingId, stopAudio]);

  const handlePlayPreset = useCallback(async (voice: PresetVoice) => {
    if (playingPreset === voice.geminiVoiceName) { stopAudio(); return; }
    stopAudio();
    setPresetError(null);
    setPlayingPreset(voice.geminiVoiceName);
    const cachedUrl = voiceSamples[voice.geminiVoiceName];
    try {
      let playUrl: string;
      if (cachedUrl) {
        playUrl = cachedUrl;
      } else {
        const res = await fetch("/api/voices/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "preset", geminiVoiceName: voice.geminiVoiceName, language }) });
        const data = await res.json();
        if (!res.ok) throw new Error((data as { error?: string }).error ?? `Error ${res.status}`);
        const url = base64ToObjectUrl((data as { audioBase64: string; mimeType: string }).audioBase64, (data as { audioBase64: string; mimeType: string }).mimeType);
        blobUrlRef.current = url;
        playUrl = url;
      }
      const audio = new Audio(playUrl);
      audioRef.current = audio;
      audio.onended = () => { stopAudio(); };
      audio.onerror = () => { setPresetError("Playback failed"); stopAudio(); };
      await audio.play();
    } catch (err) {
      setPresetError(err instanceof Error ? err.message : "Preview failed");
      setPlayingPreset(null);
    }
  }, [playingPreset, stopAudio, language, voiceSamples]);

  const handleDeleteVoice = useCallback(async (id: string) => {
    if (playingId === id) stopAudio();
    const res = await fetch(`/api/voices/${id}`, { method: "DELETE" });
    if (res.ok) setVoices((prev) => prev.filter((v) => v.id !== id));
  }, [playingId, stopAudio]);

  const handleVoiceSaved = useCallback((voice: VoiceRecord) => {
    setVoices((prev) => [voice, ...prev]);
  }, []);

  const handleAvatarChange = useCallback(async (id: string, value: string) => {
    setVoices((prev) => prev.map((v) => v.id === id ? { ...v, avatar_emoji: value } : v));
    await fetch(`/api/voices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avatarEmoji: value }),
    });
  }, []);

  const familyVoices = voices.filter((v) => v.category === "family");

  return (
    <div className="min-h-full" style={{ background: "transparent" }}>
      {/* Header */}
      <div className="px-5 pt-12 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-white tracking-wide mb-0.5">Voices</h1>
          <p className="text-white/30 text-xs">Manage narrators for your stories</p>
        </div>
        <button
          onClick={() => setShowAddSheet(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95"
          style={{ background: "rgba(79,195,247,0.1)", color: "#4fc3f7", border: "1px solid rgba(79,195,247,0.25)" }}
        >
          ＋ Add Voice
        </button>
      </div>

      {/* Tab bar */}
      <div className="px-5 mb-5">
        <div className="flex p-1 rounded-2xl gap-1" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
          {(["family", "general"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: tab === t ? "rgba(79,195,247,0.12)" : "transparent",
                color: tab === t ? "#4fc3f7" : "rgba(255,255,255,0.35)",
                border: tab === t ? "1px solid rgba(79,195,247,0.25)" : "1px solid transparent",
              }}
            >
              {t === "family" ? "Family & Friends" : "General"}
            </button>
          ))}
        </div>
      </div>

      {/* Family & Friends tab */}
      {tab === "family" && (
        <div className="px-5 flex flex-col gap-3 pb-6">
          {loadError && (
            <div className="px-4 py-2.5 rounded-2xl text-xs" style={{ background: "rgba(236,72,153,0.1)", border: "1px solid rgba(236,72,153,0.25)", color: "#EC4899" }}>
              ⚠ {loadError}
            </div>
          )}
          {familyVoices.length === 0 && !loadError && (
            <div className="py-10 flex flex-col items-center gap-2">
              <p className="text-4xl">🎙</p>
              <p className="text-white/30 text-sm text-center">No family voices yet.</p>
              <p className="text-white/20 text-xs text-center">Add a voice to personalize your stories.</p>
            </div>
          )}
          {familyVoices.map((v) => (
            <VoiceCard
              key={v.id}
              voice={v}
              playingId={playingId}
              systemAvatarUrls={systemAvatarUrls}
              portraitsReady={portraitsReady}
              portraitsTotal={portraitsTotal}
              onPlay={handlePlayVoice}
              onDelete={handleDeleteVoice}
              onAvatarChange={handleAvatarChange}
            />
          ))}
        </div>
      )}

      {/* General tab */}
      {tab === "general" && (
        <div className="px-5 flex flex-col gap-3 pb-6">
          {presetError && (
            <div className="px-4 py-2.5 rounded-2xl text-xs mb-1" style={{ background: "rgba(236,72,153,0.1)", border: "1px solid rgba(236,72,153,0.25)", color: "#EC4899" }}>
              ⚠ {presetError}
            </div>
          )}
          {PRESET_VOICES.map((pv) => (
            <PresetCard
              key={pv.geminiVoiceName}
              voice={pv}
              avatarUrl={avatarUrls[pv.id]}
              isPlaying={playingPreset === pv.geminiVoiceName}
              isCached={!!voiceSamples[pv.geminiVoiceName]}
              onPlay={handlePlayPreset}
            />
          ))}
        </div>
      )}

      {/* Add Voice sheet */}
      {showAddSheet && mounted && (
        <AddVoiceSheet
          language={language}
          systemAvatarUrls={systemAvatarUrls}
          portraitsReady={portraitsReady}
          portraitsTotal={portraitsTotal}
          onClose={() => setShowAddSheet(false)}
          onSaved={handleVoiceSaved}
        />
      )}
    </div>
  );
}
