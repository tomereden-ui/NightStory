"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "@/context/LanguageContext";

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

// ─── Preset voices ────────────────────────────────────────────────────────────

interface PresetVoice {
  name: string;
  emoji: string;
  desc: string;
  geminiVoiceName: string;
}

const PRESET_VOICES: PresetVoice[] = [
  { name: "Aoede",  emoji: "🌸", desc: "Warm & melodic feminine",   geminiVoiceName: "Aoede"  },
  { name: "Charon", emoji: "🌑", desc: "Deep & authoritative",       geminiVoiceName: "Charon" },
  { name: "Fenrir", emoji: "⚡", desc: "Strong & dynamic masculine", geminiVoiceName: "Fenrir" },
  { name: "Kore",   emoji: "🌿", desc: "Soft & gentle feminine",     geminiVoiceName: "Kore"   },
  { name: "Leda",   emoji: "✨", desc: "Clear & bright feminine",    geminiVoiceName: "Leda"   },
  { name: "Orus",   emoji: "🪨", desc: "Steady & rich masculine",    geminiVoiceName: "Orus"   },
  { name: "Puck",   emoji: "🎭", desc: "Playful & energetic",        geminiVoiceName: "Puck"   },
  { name: "Zephyr", emoji: "🌬", desc: "Bright & airy neutral",      geminiVoiceName: "Zephyr" },
];

const EMOJI_OPTIONS = ["🎙", "👩", "👨", "👴", "👵", "🧒", "🧑", "🎤", "🌟", "🦁"];

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

// ─── Voice Card (Family list) ─────────────────────────────────────────────────

function VoiceCard({
  voice,
  playingId,
  onPlay,
  onDelete,
}: {
  voice: VoiceRecord;
  playingId: string | null;
  onPlay: (v: VoiceRecord) => void;
  onDelete: (id: string) => void;
}) {
  const isPlaying = playingId === voice.id;

  return (
    <div
      className="flex items-center gap-3 px-4 py-3.5 rounded-2xl"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      {/* Emoji avatar */}
      <div
        className="w-11 h-11 rounded-full flex items-center justify-center text-2xl flex-shrink-0"
        style={{
          background: "rgba(255,255,255,0.06)",
          border: "1.5px solid rgba(79,195,247,0.25)",
        }}
      >
        {voice.avatar_emoji}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-semibold truncate">{voice.name}</p>
        <p className="text-white/35 text-[11px] truncate mt-0.5">
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
  );
}

// ─── Preset Voice Card (General tab) ─────────────────────────────────────────

function PresetCard({
  voice,
  isPlaying,
  onPlay,
}: {
  voice: PresetVoice;
  isPlaying: boolean;
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
      <div
        className="w-11 h-11 rounded-full flex items-center justify-center text-2xl flex-shrink-0"
        style={{
          background: "rgba(255,255,255,0.06)",
          border: "1.5px solid rgba(245,158,11,0.25)",
        }}
      >
        {voice.emoji}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-semibold">{voice.name}</p>
        <p className="text-white/35 text-[11px] mt-0.5">{voice.desc}</p>
      </div>

      <button
        onClick={() => onPlay(voice)}
        className="w-8 h-8 rounded-full flex items-center justify-center text-xs flex-shrink-0 transition-all active:scale-95"
        style={{
          background: isPlaying ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.05)",
          color: isPlaying ? "#F59E0B" : "rgba(255,255,255,0.45)",
          border: isPlaying ? "1px solid rgba(245,158,11,0.4)" : "1px solid rgba(255,255,255,0.08)",
        }}
        title={isPlaying ? "Stop" : "Play sample"}
      >
        {isPlaying ? "⏹" : "▶"}
      </button>
    </div>
  );
}

// ─── Add Voice Sheet ───────────────────────────────────────────────────────────

function AddVoiceSheet({
  language,
  onClose,
  onSaved,
}: {
  language: string;
  onClose: () => void;
  onSaved: (voice: VoiceRecord) => void;
}) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🎙");
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

  // Cleanup on unmount
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

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const mimeType = mr.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setRecordedMimeType(mimeType);
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          const base64 = result.split(",")[1] ?? "";
          setRecordedAudioBase64(base64);
          setRecordState("done");
        };
        reader.readAsDataURL(blob);
      };

      mr.start();
      setRecordState("recording");
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch (err) {
      console.error("MediaRecorder error:", err);
      setPreviewError("Microphone access denied. Please allow microphone use.");
    }
  };

  const handleStopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  };

  const handleGeneratePreview = async () => {
    setPreviewState("loading");
    setPreviewError(null);
    stopPreviewAudio();

    try {
      let body: Record<string, string>;

      if (method === "text") {
        body = { type: "text", description, language };
      } else {
        if (!recordedAudioBase64) throw new Error("No recording available.");
        body = {
          type: "recorded",
          audioBase64: recordedAudioBase64,
          audioMimeType: recordedMimeType,
          name: name.trim() || "My Voice",
          language,
        };
      }

      const res = await fetch("/api/voices/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error ?? `Server error ${res.status}`);

      const respData = data as {
        audioBase64: string;
        mimeType: string;
        geminiVoiceName?: string;
        elVoiceId?: string;
      };

      setPreviewBase64(respData.audioBase64);
      setPreviewMimeType(respData.mimeType);
      if (respData.geminiVoiceName) setPreviewGeminiVoiceName(respData.geminiVoiceName);
      if (respData.elVoiceId) setPreviewElVoiceId(respData.elVoiceId);

      const url = base64ToObjectUrl(respData.audioBase64, respData.mimeType);
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = url;
      setPreviewAudioUrl(url);
      setPreviewState("ready");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Preview failed";
      setPreviewError(message);
      setPreviewState("idle");
    }
  };

  const handlePlayPreview = () => {
    if (previewPlaying) {
      stopPreviewAudio();
      return;
    }
    if (!previewAudioUrl) return;
    const audio = new Audio(previewAudioUrl);
    previewAudioRef.current = audio;
    audio.onended = () => setPreviewPlaying(false);
    audio.onerror = () => {
      setPreviewError("Playback failed");
      setPreviewPlaying(false);
    };
    audio.play().catch(() => setPreviewError("Playback failed"));
    setPreviewPlaying(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setSaveError("Please enter a name.");
      return;
    }
    if (previewState !== "ready") return;

    setSaving(true);
    setSaveError(null);

    try {
      const body: Record<string, string> = {
        name: name.trim(),
        category: "family",
        type: method === "record" ? "recorded" : "text",
        avatarEmoji: emoji,
      };

      if (description) body.description = description;
      if (previewGeminiVoiceName) body.geminiVoiceName = previewGeminiVoiceName;
      if (previewElVoiceId) body.elVoiceId = previewElVoiceId;
      if (previewBase64) {
        body.audioBase64 = previewBase64;
        body.mimeType = previewMimeType;
      }

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
      const message = err instanceof Error ? err.message : "Save failed";
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  };

  const canGeneratePreview =
    method === "text" ? description.trim().length > 0 : recordState === "done";

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0"
        style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)", zIndex: 9998 }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md rounded-t-3xl overflow-hidden flex flex-col"
        style={{
          background: "rgba(8,12,24,0.97)",
          border: "1px solid rgba(255,255,255,0.09)",
          zIndex: 9999,
          maxHeight: "92vh",
        }}
      >
        {/* Top accent line */}
        <div className="h-0.5 w-full flex-shrink-0" style={{ background: "linear-gradient(90deg,#4fc3f7,#8B5CF6)" }} />

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-5 pt-5 pb-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-white font-bold text-base">Add Voice</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:text-white/70 transition-colors"
              style={{ background: "rgba(255,255,255,0.06)" }}
            >
              ×
            </button>
          </div>

          {/* Name input */}
          <div className="mb-4">
            <label className="text-white/50 text-xs mb-1.5 block">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Grandma Ruth"
              className="w-full px-4 py-3 rounded-2xl text-sm text-white placeholder-white/25 outline-none"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            />
          </div>

          {/* Emoji selector */}
          <div className="mb-5">
            <label className="text-white/50 text-xs mb-2 block">Avatar</label>
            <div className="flex gap-2 flex-wrap">
              {EMOJI_OPTIONS.map((e) => (
                <button
                  key={e}
                  onClick={() => setEmoji(e)}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-xl transition-all active:scale-90"
                  style={{
                    background: emoji === e ? "rgba(79,195,247,0.15)" : "rgba(255,255,255,0.05)",
                    border: emoji === e ? "1.5px solid rgba(79,195,247,0.5)" : "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Method toggle */}
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

          {/* Describe method */}
          {method === "text" && (
            <div className="mb-5">
              <label className="text-white/50 text-xs mb-1.5 block">Voice description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the voice character, tone, accent..."
                rows={3}
                className="w-full px-4 py-3 rounded-2xl text-sm text-white placeholder-white/25 outline-none resize-none"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
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
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "rgba(255,255,255,0.65)",
                  }}
                >
                  &ldquo;{sampleText}&rdquo;
                </div>
              </div>

              {/* Waveform animation while recording */}
              {recordState === "recording" && (
                <div className="flex items-center gap-1 h-10">
                  {Array.from({ length: 20 }).map((_, i) => (
                    <span
                      key={i}
                      className="w-1 rounded-full flex-shrink-0"
                      style={{
                        background: "#4fc3f7",
                        height: `${10 + ((i * 7 + 13) % 28)}px`,
                        animation: `bounce 0.4s ease-in-out ${(i % 5) * 0.08}s infinite`,
                        opacity: 0.6,
                      }}
                    />
                  ))}
                </div>
              )}

              {/* Timer */}
              {recordState === "recording" && (
                <p className="text-white/40 text-sm">
                  Recording… {recordingSeconds}s
                </p>
              )}

              {recordState === "done" && (
                <p className="text-[#10D9A0] text-sm font-medium">
                  ✓ Recording complete ({recordingSeconds}s)
                </p>
              )}

              {/* Record / Stop button */}
              <button
                onClick={recordState === "recording" ? handleStopRecording : handleStartRecording}
                className="w-20 h-20 rounded-full flex items-center justify-center text-3xl active:scale-95 transition-transform"
                style={{
                  background:
                    recordState === "recording"
                      ? "linear-gradient(135deg,#EC4899,#8B1A4A)"
                      : "linear-gradient(135deg,#4fc3f7,#0088AA)",
                  boxShadow:
                    recordState === "recording"
                      ? "0 4px 24px rgba(236,72,153,0.4)"
                      : "0 4px 24px rgba(79,195,247,0.3)",
                }}
              >
                {recordState === "recording" ? "⏹" : "🎤"}
              </button>

              {recordState === "done" && (
                <button
                  onClick={() => {
                    setRecordState("idle");
                    setRecordedAudioBase64(null);
                    setRecordingSeconds(0);
                    setPreviewState("idle");
                    setPreviewAudioUrl(null);
                    stopPreviewAudio();
                  }}
                  className="text-white/30 text-xs"
                >
                  Re-record
                </button>
              )}
            </div>
          )}

          {/* Preview error */}
          {previewError && (
            <div
              className="mb-4 px-4 py-2.5 rounded-2xl text-xs"
              style={{
                background: "rgba(236,72,153,0.1)",
                border: "1px solid rgba(236,72,153,0.25)",
                color: "#EC4899",
              }}
            >
              ⚠ {previewError}
            </div>
          )}

          {/* Generate Preview button */}
          <button
            onClick={handleGeneratePreview}
            disabled={!canGeneratePreview || previewState === "loading"}
            className="w-full py-3.5 rounded-2xl text-sm font-semibold mb-3 transition-all active:scale-[0.98]"
            style={{
              background:
                canGeneratePreview && previewState !== "loading"
                  ? "linear-gradient(90deg,#4fc3f7,#0088AA)"
                  : "rgba(255,255,255,0.07)",
              color:
                canGeneratePreview && previewState !== "loading"
                  ? "#05080F"
                  : "rgba(255,255,255,0.25)",
              cursor: canGeneratePreview && previewState !== "loading" ? "pointer" : "not-allowed",
            }}
          >
            {previewState === "loading" ? "Generating…" : "Generate Preview"}
          </button>

          {/* Preview player */}
          {previewState === "ready" && previewAudioUrl && (
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-2xl mb-4"
              style={{
                background: "rgba(79,195,247,0.06)",
                border: "1px solid rgba(79,195,247,0.2)",
              }}
            >
              <button
                onClick={handlePlayPreview}
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                style={{
                  background: previewPlaying ? "rgba(79,195,247,0.25)" : "rgba(79,195,247,0.15)",
                  color: "#4fc3f7",
                  border: "1px solid rgba(79,195,247,0.35)",
                }}
              >
                {previewPlaying ? "⏹" : "▶"}
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-[#4fc3f7] text-xs font-medium">Preview ready</p>
                {previewGeminiVoiceName && (
                  <p className="text-white/30 text-[10px]">Voice: {previewGeminiVoiceName}</p>
                )}
              </div>
            </div>
          )}

          {/* Save error */}
          {saveError && (
            <div
              className="mb-3 px-4 py-2.5 rounded-2xl text-xs"
              style={{
                background: "rgba(236,72,153,0.1)",
                border: "1px solid rgba(236,72,153,0.25)",
                color: "#EC4899",
              }}
            >
              ⚠ {saveError}
            </div>
          )}

          {/* Save Voice button */}
          <button
            onClick={handleSave}
            disabled={previewState !== "ready" || saving || !name.trim()}
            className="w-full py-3.5 rounded-2xl text-sm font-semibold transition-all active:scale-[0.98]"
            style={{
              background:
                previewState === "ready" && !saving && name.trim()
                  ? "linear-gradient(90deg,#8B5CF6,#6D28D9)"
                  : "rgba(255,255,255,0.07)",
              color:
                previewState === "ready" && !saving && name.trim()
                  ? "#fff"
                  : "rgba(255,255,255,0.25)",
              cursor:
                previewState === "ready" && !saving && name.trim() ? "pointer" : "not-allowed",
            }}
          >
            {saving ? "Saving…" : "Save Voice"}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

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

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Load voices
  useEffect(() => {
    fetch("/api/voices")
      .then((r) => r.json())
      .then((data: unknown) => {
        if (Array.isArray(data)) {
          setVoices(data as VoiceRecord[]);
        } else {
          setLoadError("Failed to load voices.");
        }
      })
      .catch(() => setLoadError("Network error loading voices."));
  }, []);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setPlayingId(null);
    setPlayingPreset(null);
  }, []);

  // Play a family voice from its sample_url
  const handlePlayVoice = useCallback(
    async (voice: VoiceRecord) => {
      if (playingId === voice.id) {
        stopAudio();
        return;
      }
      stopAudio();
      if (!voice.sample_url) return;

      setPlayingId(voice.id);
      const audio = new Audio(voice.sample_url);
      audioRef.current = audio;
      audio.onended = () => {
        setPlayingId(null);
        audioRef.current = null;
      };
      audio.onerror = () => {
        setPlayingId(null);
        audioRef.current = null;
      };
      try {
        await audio.play();
      } catch {
        setPlayingId(null);
      }
    },
    [playingId, stopAudio],
  );

  // Play a preset voice via /api/voices/preview
  const handlePlayPreset = useCallback(
    async (voice: PresetVoice) => {
      if (playingPreset === voice.geminiVoiceName) {
        stopAudio();
        return;
      }
      stopAudio();
      setPresetError(null);
      setPlayingPreset(voice.geminiVoiceName);

      try {
        const res = await fetch("/api/voices/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "preset",
            geminiVoiceName: voice.geminiVoiceName,
            language,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error((data as { error?: string }).error ?? `Error ${res.status}`);

        const respData = data as { audioBase64: string; mimeType: string };
        const url = base64ToObjectUrl(respData.audioBase64, respData.mimeType);
        blobUrlRef.current = url;

        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => {
          stopAudio();
        };
        audio.onerror = () => {
          setPresetError("Playback failed");
          stopAudio();
        };
        await audio.play();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Preview failed";
        setPresetError(message);
        setPlayingPreset(null);
      }
    },
    [playingPreset, stopAudio, language],
  );

  const handleDeleteVoice = useCallback(
    async (id: string) => {
      if (playingId === id) stopAudio();

      const res = await fetch(`/api/voices/${id}`, { method: "DELETE" });
      if (res.ok) {
        setVoices((prev) => prev.filter((v) => v.id !== id));
      }
    },
    [playingId, stopAudio],
  );

  const handleVoiceSaved = useCallback((voice: VoiceRecord) => {
    setVoices((prev) => [voice, ...prev]);
  }, []);

  const familyVoices = voices.filter((v) => v.category === "family");

  return (
    <div className="min-h-full" style={{ background: "transparent" }}>
      {/* Header */}
      <div className="px-5 pt-12 pb-4">
        <h1 className="text-base font-semibold text-white tracking-wide mb-0.5">Voices</h1>
        <p className="text-white/30 text-xs">Manage narrators for your stories</p>
      </div>

      {/* Tab bar */}
      <div className="px-5 mb-5">
        <div
          className="flex p-1 rounded-2xl gap-1"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
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
            <div
              className="px-4 py-2.5 rounded-2xl text-xs"
              style={{
                background: "rgba(236,72,153,0.1)",
                border: "1px solid rgba(236,72,153,0.25)",
                color: "#EC4899",
              }}
            >
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
              onPlay={handlePlayVoice}
              onDelete={handleDeleteVoice}
            />
          ))}

          {/* Add voice button */}
          <button
            onClick={() => setShowAddSheet(true)}
            className="flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-medium transition-all active:scale-[0.98]"
            style={{ border: "1.5px dashed rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.35)" }}
          >
            ＋ Add Voice
          </button>
        </div>
      )}

      {/* General tab */}
      {tab === "general" && (
        <div className="px-5 flex flex-col gap-3 pb-6">
          {presetError && (
            <div
              className="px-4 py-2.5 rounded-2xl text-xs mb-1"
              style={{
                background: "rgba(236,72,153,0.1)",
                border: "1px solid rgba(236,72,153,0.25)",
                color: "#EC4899",
              }}
            >
              ⚠ {presetError}
            </div>
          )}
          {PRESET_VOICES.map((pv) => (
            <PresetCard
              key={pv.geminiVoiceName}
              voice={pv}
              isPlaying={playingPreset === pv.geminiVoiceName}
              onPlay={handlePlayPreset}
            />
          ))}
        </div>
      )}

      {/* Add Voice sheet (portal) */}
      {showAddSheet && mounted && (
        <AddVoiceSheet
          language={language}
          onClose={() => setShowAddSheet(false)}
          onSaved={handleVoiceSaved}
        />
      )}
    </div>
  );
}
