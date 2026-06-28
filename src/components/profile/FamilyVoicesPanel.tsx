"use client";

/**
 * FamilyVoicesPanel — embeds the full family-voice management experience
 * (list, play, delete, add new) as a self-contained section inside Profile.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "@/context/LanguageContext";
import { useViewMode } from "@/context/ViewModeContext";
import VoiceAvatar, { AVATAR_STYLES } from "@/components/ui/VoiceAvatar";
import Icon from "@/components/ui/Icon";

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

type AddMethod = "text" | "record";
type RecordState = "idle" | "recording" | "done";
type PreviewState = "idle" | "loading" | "ready";

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

function base64ToObjectUrl(base64: string, mimeType: string): string {
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
  const blob = new Blob([bytes], { type: mimeType });
  return URL.createObjectURL(blob);
}

function isAvatarUrl(v: string) {
  return v.startsWith("https://") || v.startsWith("http://");
}

// ─── Avatar Gallery Sheet ─────────────────────────────────────────────────────

type BankAvatar = { id: string; description: string; image_url: string };

function AvatarGallerySheet({
  currentValue,
  onSelect,
  onClose,
}: {
  currentValue: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}) {
  const { effective } = useViewMode();
  const sheetMaxWidth = effective === "mobile" ? 448 : 512;
  const [avatars, setAvatars] = useState<BankAvatar[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/avatar-bank-list")
      .then((r) => r.json())
      .then((d) => { setAvatars((d as { avatars: BankAvatar[] }).avatars ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return createPortal(
    <>
      <div className="fixed inset-0 z-[200]" style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }} onClick={onClose} />
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 z-[201] rounded-t-3xl overflow-hidden flex flex-col" style={{ width: "100%", maxWidth: sheetMaxWidth, maxHeight: "65vh", background: "#0D1120", border: "1px solid rgba(255,255,255,0.09)" }}>
        <div className="flex items-center justify-between px-5 py-4">
          <p className="text-fs-body font-semibold text-white">Choose Avatar</p>
          <button onClick={onClose} style={{ color: "rgba(255,255,255,0.4)" }}><Icon name="close" size={18} /></button>
        </div>
        {/* Colour swatches */}
        <div className="px-5 pb-3 flex flex-wrap gap-2">
          {AVATAR_STYLES.map(({ key, gradient }) => (
            <button key={key} onClick={() => onSelect(key)} className="rounded-full transition-all active:scale-90" style={{ width: 34, height: 34, background: gradient, border: currentValue === key ? "2.5px solid #4fc3f7" : "2px solid rgba(255,255,255,0.12)", boxShadow: currentValue === key ? "0 0 0 2px rgba(79,195,247,0.3)" : "none" }} />
          ))}
        </div>
        <div className="w-full h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
        {/* Bank avatars */}
        <div className="overflow-y-auto flex-1 px-5 py-3">
          {loading ? <p className="text-white/30 text-fs-body text-center py-6">Loading…</p> : (
            <div className="grid grid-cols-5 gap-2">
              {avatars.map((a) => (
                <button key={a.id} onClick={() => onSelect(a.image_url)} className="relative rounded-2xl overflow-hidden aspect-square transition-all active:scale-90" style={{ border: currentValue === a.image_url ? "2px solid #4fc3f7" : "2px solid transparent", boxShadow: currentValue === a.image_url ? "0 0 0 2px rgba(79,195,247,0.3)" : "none" }}>
                  <img src={a.image_url} alt={a.description} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
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
  onPlay,
  onDelete,
  onAvatarChange,
}: {
  voice: VoiceRecord;
  playingId: string | null;
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
    <div className="relative">
      <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="relative flex-shrink-0">
          <VoiceAvatar avatarUrl={avatarIsUrl ? voice.avatar_emoji : undefined} emoji={avatarIsUrl ? undefined : voice.avatar_emoji} name={voice.name} size={44} borderColor={galleryOpen ? "rgba(79,195,247,0.6)" : "rgba(79,195,247,0.25)"} onClick={() => setGalleryOpen((o) => !o)} />
          <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center pointer-events-none" style={{ background: "rgba(8,12,24,0.9)", border: "1px solid rgba(79,195,247,0.4)", fontSize: "var(--fs-micro)", color: "#4fc3f7" }}>✎</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-fs-body font-semibold truncate">{voice.name}</p>
          <p className="text-white/45 text-fs-body truncate mt-0.5">{voice.description ?? voice.gemini_voice_name ?? (voice.type === "recorded" ? "Cloned voice" : "AI voice")}</p>
        </div>
        <button disabled={!voice.sample_url} onClick={() => onPlay(voice)} className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all active:scale-95" style={{ background: isPlaying ? "rgba(79,195,247,0.15)" : "rgba(255,255,255,0.05)", color: isPlaying ? "#4fc3f7" : voice.sample_url ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.15)", border: isPlaying ? "1px solid rgba(79,195,247,0.4)" : "1px solid rgba(255,255,255,0.08)", cursor: voice.sample_url ? "pointer" : "not-allowed" }}>
          {isPlaying ? <Icon name="stop" size={14} /> : <Icon name="play" size={14} />}
        </button>
        <button onClick={() => onDelete(voice.id)} className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all active:scale-95" style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <Icon name="close" size={16} />
        </button>
      </div>
      {galleryOpen && mounted && (
        <AvatarGallerySheet currentValue={voice.avatar_emoji} onSelect={(v) => { onAvatarChange(voice.id, v); setGalleryOpen(false); }} onClose={() => setGalleryOpen(false)} />
      )}
    </div>
  );
}

// ─── Add Voice Sheet ──────────────────────────────────────────────────────────

function AddVoiceSheet({
  language,
  onClose,
  onSaved,
}: {
  language: string;
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
      if (previewAudioRef.current) { previewAudioRef.current.pause(); previewAudioRef.current = null; }
      if (previewUrlRef.current) { URL.revokeObjectURL(previewUrlRef.current); previewUrlRef.current = null; }
    };
  }, []);

  const stopPreviewAudio = useCallback(() => {
    if (previewAudioRef.current) { previewAudioRef.current.pause(); previewAudioRef.current = null; }
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
        reader.onloadend = () => { const result = reader.result as string; setRecordedAudioBase64(result.split(",")[1] ?? ""); setRecordState("done"); };
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
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") mediaRecorderRef.current.stop();
  };

  const handleGeneratePreview = async () => {
    setPreviewState("loading");
    setPreviewError(null);
    stopPreviewAudio();
    try {
      const body = method === "text"
        ? { type: "text", description, language }
        : { type: "recorded", audioBase64: recordedAudioBase64!, audioMimeType: recordedMimeType, name: name.trim() || "My Voice", language };
      const res = await fetch("/api/voices/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
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
      const body: Record<string, string> = { name: name.trim(), category: "family", type: method === "record" ? "recorded" : "text", avatarEmoji: avatarValue };
      if (description) body.description = description;
      if (previewGeminiVoiceName) body.geminiVoiceName = previewGeminiVoiceName;
      if (previewElVoiceId) body.elVoiceId = previewElVoiceId;
      if (previewBase64) { body.audioBase64 = previewBase64; body.mimeType = previewMimeType; }
      const res = await fetch("/api/voices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const saved = await res.json();
      if (!res.ok) throw new Error((saved as { error?: string }).error ?? `Save error ${res.status}`);
      onSaved(saved as VoiceRecord);
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const canPreview = method === "text" ? description.trim().length > 5 : recordState === "done";

  return createPortal(
    <>
      <div className="fixed inset-0 z-[100]" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }} onClick={onClose} />
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 z-[101] rounded-t-3xl overflow-hidden flex flex-col" style={{ width: "100%", maxWidth: sheetMaxWidth, maxHeight: "88vh", background: "#0D1120", border: "1px solid rgba(255,255,255,0.09)" }}>
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }} /></div>

        <div className="overflow-y-auto flex-1 px-5 pt-2 pb-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-white font-semibold text-fs-heading">Add a Family Voice</p>
              <p className="text-white/35 text-fs-body mt-0.5">Record or describe someone's voice to clone it</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}><Icon name="close" size={16} /></button>
          </div>

          {/* Avatar + Name */}
          <div className="flex items-center gap-3 mb-5">
            <VoiceAvatar avatarUrl={isAvatarUrl(avatarValue) ? avatarValue : undefined} emoji={isAvatarUrl(avatarValue) ? undefined : avatarValue} name={name || "?"} size={52} borderColor="rgba(79,195,247,0.4)" onClick={() => setAvatarPickerOpen(true)} />
            <div className="flex-1">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (e.g. Dad, Grandma…)" maxLength={32} className="w-full bg-transparent text-white text-fs-body font-medium outline-none placeholder:text-white/20 border-b pb-1" style={{ borderColor: "rgba(255,255,255,0.12)" }} />
              <p className="text-white/25 text-fs-body mt-1">Tap the avatar to change it</p>
            </div>
          </div>

          {/* Method toggle */}
          <div className="flex p-1 rounded-2xl gap-1 mb-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
            {(["text", "record"] as AddMethod[]).map((m) => (
              <button key={m} onClick={() => setMethod(m)} className="flex-1 py-2 rounded-xl text-fs-body font-semibold transition-all" style={{ background: method === m ? "rgba(79,195,247,0.12)" : "transparent", color: method === m ? "#4fc3f7" : "rgba(255,255,255,0.35)", border: method === m ? "1px solid rgba(79,195,247,0.25)" : "1px solid transparent" }}>
                {m === "text" ? "📝 Describe" : "🎙 Record"}
              </button>
            ))}
          </div>

          {/* Text method */}
          {method === "text" && (
            <div className="mb-4">
              <p className="text-white/50 text-fs-body mb-2">Describe the voice (age, tone, accent, character)</p>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Warm grandfather voice, deep and slow, with a slight Israeli accent…" rows={3} className="w-full rounded-2xl px-4 py-3 text-fs-body text-white outline-none resize-none placeholder:text-white/20" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)" }} />
            </div>
          )}

          {/* Record method */}
          {method === "record" && (
            <div className="mb-4">
              <div className="rounded-2xl px-4 py-3 mb-3 text-fs-body" style={{ background: "rgba(79,195,247,0.06)", border: "1px solid rgba(79,195,247,0.15)", color: "rgba(255,255,255,0.55)" }}>
                Read this aloud: <span className="text-white/80 italic">&ldquo;{sampleText}&rdquo;</span>
              </div>
              {recordState === "idle" && (
                <button onClick={handleStartRecording} className="w-full py-3 rounded-2xl text-fs-body font-semibold" style={{ background: "rgba(236,72,153,0.1)", color: "#EC4899", border: "1px solid rgba(236,72,153,0.25)" }}>🎙 Start Recording</button>
              )}
              {recordState === "recording" && (
                <button onClick={handleStopRecording} className="w-full py-3 rounded-2xl text-fs-body font-semibold" style={{ background: "rgba(236,72,153,0.15)", color: "#EC4899", border: "1px solid rgba(236,72,153,0.4)" }}>⏹ Stop ({recordingSeconds}s)</button>
              )}
              {recordState === "done" && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-2xl" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
                  <span style={{ color: "#10B981" }}>✓</span>
                  <p className="text-white/60 text-fs-body flex-1">Recording captured</p>
                  <button onClick={() => { setRecordState("idle"); setRecordedAudioBase64(null); setPreviewState("idle"); }} className="text-fs-body px-2 py-1 rounded-lg" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}>Redo</button>
                </div>
              )}
            </div>
          )}

          {/* Preview */}
          <button onClick={handleGeneratePreview} disabled={!canPreview || previewState === "loading"} className="w-full py-3 rounded-2xl text-fs-body font-semibold mb-3 transition-all" style={{ background: canPreview ? "rgba(139,92,246,0.15)" : "rgba(255,255,255,0.04)", color: canPreview ? "#a78bfa" : "rgba(255,255,255,0.2)", border: canPreview ? "1px solid rgba(139,92,246,0.3)" : "1px solid rgba(255,255,255,0.07)", cursor: canPreview ? "pointer" : "not-allowed" }}>
            {previewState === "loading" ? "Generating preview…" : "🔊 Preview Voice"}
          </button>

          {previewError && <p className="text-fs-body mb-3 px-4 py-2.5 rounded-2xl" style={{ background: "rgba(236,72,153,0.08)", color: "#EC4899", border: "1px solid rgba(236,72,153,0.2)" }}>⚠ {previewError}</p>}

          {previewState === "ready" && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl mb-3" style={{ background: "rgba(79,195,247,0.07)", border: "1px solid rgba(79,195,247,0.2)" }}>
              <button onClick={handlePlayPreview} className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: previewPlaying ? "rgba(79,195,247,0.2)" : "rgba(79,195,247,0.1)", color: "#4fc3f7", border: "1px solid rgba(79,195,247,0.35)" }}>
                {previewPlaying ? <Icon name="stop" size={14} /> : <Icon name="play" size={14} />}
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-[#4fc3f7] text-fs-body font-medium">Preview ready</p>
                {previewGeminiVoiceName && <p className="text-white/30 text-fs-body">Voice: {previewGeminiVoiceName}</p>}
              </div>
            </div>
          )}

          {saveError && <p className="text-fs-body mb-3 px-4 py-2.5 rounded-2xl" style={{ background: "rgba(236,72,153,0.1)", color: "#EC4899", border: "1px solid rgba(236,72,153,0.25)" }}>⚠ {saveError}</p>}

          <button onClick={handleSave} disabled={previewState !== "ready" || saving || !name.trim()} className="w-full py-3.5 rounded-2xl text-fs-body font-semibold transition-all active:scale-[0.98]" style={{ background: previewState === "ready" && !saving && name.trim() ? "linear-gradient(90deg,#8B5CF6,#6D28D9)" : "rgba(255,255,255,0.07)", color: previewState === "ready" && !saving && name.trim() ? "#fff" : "rgba(255,255,255,0.25)", cursor: previewState === "ready" && !saving && name.trim() ? "pointer" : "not-allowed" }}>
            {saving ? "Saving…" : "Save Voice"}
          </button>
        </div>

        {avatarPickerOpen && (
          <AvatarGallerySheet currentValue={avatarValue} onSelect={(v) => { setAvatarValue(v); setAvatarPickerOpen(false); }} onClose={() => setAvatarPickerOpen(false)} />
        )}
      </div>
    </>,
    document.body,
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export default function FamilyVoicesPanel() {
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [voices, setVoices] = useState<VoiceRecord[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    fetch("/api/voices")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setVoices((data as VoiceRecord[]).filter((v) => v.category === "family"));
      })
      .catch(() => {});
  }, []);

  const stopAudio = useCallback(() => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setPlayingId(null);
  }, []);

  const handlePlay = useCallback(async (voice: VoiceRecord) => {
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

  const handleDelete = useCallback(async (id: string) => {
    if (playingId === id) stopAudio();
    const res = await fetch(`/api/voices/${id}`, { method: "DELETE" });
    if (res.ok) setVoices((prev) => prev.filter((v) => v.id !== id));
  }, [playingId, stopAudio]);

  const handleAvatarChange = useCallback(async (id: string, value: string) => {
    setVoices((prev) => prev.map((v) => v.id === id ? { ...v, avatar_emoji: value } : v));
    await fetch(`/api/voices/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ avatarEmoji: value }) });
  }, []);

  return (
    <div className="mb-7">
      {/* Section header — tap to expand/collapse */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between mb-3"
      >
        <div className="text-left">
          <p className="text-fs-body font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.28)" }}>
            Family Voices
          </p>
          <p className="text-fs-body mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
            {open ? "Hear your stories in voices you love" : `${voices.length > 0 ? `${voices.length} voice${voices.length > 1 ? "s" : ""} saved` : "Tap to add voices"}`}
          </p>
        </div>
        <span
          className="text-white/30 text-fs-body transition-transform"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", display: "inline-block" }}
        >
          ▾
        </span>
      </button>

      {open && (
        <>
          {/* Empty state */}
          {voices.length === 0 && (
            <button
              onClick={() => setShowAdd(true)}
              className="w-full rounded-2xl flex flex-col items-center justify-center gap-3 py-8 transition-all active:scale-[0.98]"
              style={{ background: "rgba(167,139,250,0.05)", border: "1.5px dashed rgba(167,139,250,0.2)" }}
            >
              <span className="text-fs-display">🎙</span>
              <div className="text-center">
                <p className="text-white/50 text-fs-body font-medium">Add your family&apos;s voices</p>
                <p className="text-white/25 text-fs-body mt-1">Dad, Mom, Grandma — anyone can narrate</p>
              </div>
              <span className="px-4 py-1.5 rounded-full text-fs-body font-semibold" style={{ background: "rgba(167,139,250,0.15)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.3)" }}>
                Get started →
              </span>
            </button>
          )}

          {/* Voice list */}
          {voices.length > 0 && (
            <div className="flex flex-col gap-2 mb-3">
              {voices.map((v) => (
                <VoiceCard
                  key={v.id}
                  voice={v}
                  playingId={playingId}
                  onPlay={handlePlay}
                  onDelete={handleDelete}
                  onAvatarChange={handleAvatarChange}
                />
              ))}
              <button
                onClick={() => setShowAdd(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-fs-body font-semibold transition-all active:scale-95 self-start mt-1"
                style={{ background: "rgba(167,139,250,0.1)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.22)" }}
              >
                ＋ Add voice
              </button>
            </div>
          )}
        </>
      )}

      {/* Add sheet */}
      {showAdd && mounted && (
        <AddVoiceSheet
          language={language}
          onClose={() => setShowAdd(false)}
          onSaved={(v) => { setVoices((prev) => [v, ...prev]); }}
        />
      )}
    </div>
  );
}
