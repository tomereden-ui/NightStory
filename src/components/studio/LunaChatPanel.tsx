"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { DBChildProfile } from "@/app/api/child-profiles/route";
import type { DraftState } from "@/lib/draftStore";
import type { ScriptBlock } from "@/types";
import { getNarratorVoiceId } from "@/lib/narratorPreference";
import { useLanguage } from "@/context/LanguageContext";
import Icon from "@/components/ui/Icon";

interface Message {
  role: "user" | "model";
  content: string;
}

interface ChatResponse {
  reply: string;
  storyReady: boolean;
  storyParams?: Record<string, string>;
}

// ─── Typing dots ──────────────────────────────────────────────────────────────

function OwlAvatar({ size = 44 }: { size?: number }) {
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <style>{`
        @keyframes _lunaRing { 0%,100%{opacity:0.7;transform:scale(1) rotate(0deg);}50%{opacity:1;transform:scale(1.06) rotate(180deg);} }
        @keyframes _lunaFloat { 0%,100%{transform:translateY(0);}50%{transform:translateY(-3px);} }
      `}</style>
      {/* animated gradient ring */}
      <div style={{
        position:"absolute", inset:-3, borderRadius:"50%",
        background:"conic-gradient(from 0deg,#a78bfa,#4fc3f7,#e879f9,#a78bfa)",
        animation:"_lunaRing 4s linear infinite",
        filter:"blur(1px)",
      }}/>
      <div style={{
        position:"absolute", inset:1.5, borderRadius:"50%",
        background:"#060912",
        overflow:"hidden",
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/owl-avatar.png" alt="Luna" style={{ width:"100%", height:"100%", objectFit:"cover", animation:"_lunaFloat 4s ease-in-out infinite" }} />
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex justify-start gap-3 items-end">
      <OwlAvatar size={44} />
      <div className="px-4 py-3.5 rounded-2xl rounded-bl-sm flex items-center gap-2.5"
        style={{ background: "linear-gradient(135deg,rgba(88,28,220,0.18),rgba(30,58,120,0.2))", border: "1.5px solid rgba(167,139,250,0.25)" }}>
        {[0, 1, 2].map((i) => (
          <span key={i} className="w-2 h-2 rounded-full animate-bounce"
            style={{ background: "rgba(167,139,250,0.85)", animationDelay: `${i * 0.18}s`, animationDuration: "0.8s" }} />
        ))}
      </div>
    </div>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({
  msg,
  childEmoji,
  isPlaying,
  isSpeechLoading,
  onTogglePlay,
}: {
  msg: Message;
  childEmoji?: string;
  isPlaying?: boolean;
  isSpeechLoading?: boolean;
  onTogglePlay?: () => void;
}) {
  const isLuna = msg.role === "model";
  return (
    <div className={`flex gap-3 items-end ${isLuna ? "justify-start" : "justify-end"}`}>
      {isLuna && <OwlAvatar size={44} />}
      <div className={`flex flex-col gap-1.5 ${isLuna ? "items-start" : "items-end"}`} style={{ maxWidth: "80%" }}>
        <div
          className="px-4 py-3.5 rounded-2xl leading-relaxed whitespace-pre-wrap text-fs-body"
          style={{
            ...(isLuna ? {
              background: "linear-gradient(135deg,rgba(88,28,220,0.18) 0%,rgba(30,58,120,0.22) 100%)",
              border: "1.5px solid rgba(167,139,250,0.28)",
              color: "rgba(255,255,255,0.93)",
              borderBottomLeftRadius: 6,
            } : {
              background: "linear-gradient(135deg,#1a4a8a 0%,#1a6ab8 100%)",
              border: "1.5px solid rgba(79,195,247,0.35)",
              color: "#fff",
              borderBottomRightRadius: 6,
            }),
          }}
        >
          {msg.content}
        </div>

        {/* Per-message listen button — Luna messages only */}
        {isLuna && onTogglePlay && (
          <button
            onClick={onTogglePlay}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-fs-body font-semibold transition-all active:scale-95"
            style={{
              background: isPlaying || isSpeechLoading ? "rgba(167,139,250,0.15)" : "rgba(255,255,255,0.04)",
              border: isPlaying || isSpeechLoading ? "1px solid rgba(167,139,250,0.4)" : "1px solid rgba(255,255,255,0.1)",
              color: isPlaying || isSpeechLoading ? "#c4b5fd" : "rgba(255,255,255,0.28)",
            }}
          >
            {isSpeechLoading ? (
              <span className="w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <span style={{ fontSize: "var(--fs-caption)" }}>{isPlaying ? "⏹" : "🔊"}</span>
            )}
            <span>{isSpeechLoading ? "Loading…" : isPlaying ? "Stop" : "Listen"}</span>
          </button>
        )}
      </div>

      {!isLuna && (
        <div className="flex-shrink-0" style={{
          width:46, height:46, borderRadius:"50%", overflow:"hidden",
          border:"2px solid rgba(79,195,247,0.5)",
          boxShadow:"0 0 14px rgba(79,195,247,0.3), 0 2px 8px rgba(0,0,0,0.5)",
          background:"rgba(10,20,50,0.8)",
          display:"flex", alignItems:"center", justifyContent:"center", fontSize:22,
        }}>
          {childEmoji?.startsWith("http") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={childEmoji} alt="child" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
          ) : (
            childEmoji ?? "🧒"
          )}
        </div>
      )}
    </div>
  );
}

// ─── Luna chat panel ──────────────────────────────────────────────────────────

const CHAT_DURATION_PRESETS = [
  { value: 3, icon: "⚡", label: "Short",  desc: "~3 min" },
  { value: 5, icon: "🌙", label: "Medium", desc: "~5 min" },
  { value: 8, icon: "✨", label: "Long",   desc: "~8 min" },
];

export default function LunaChatPanel({
  activeChild,
  onScriptReady,
  onFirstMessage,
  onDiscard,
  onGenerating,
}: {
  activeChild: DBChildProfile | null;
  onScriptReady: (draft: Omit<DraftState, "coverUrl">, durationMinutes?: number) => void;
  onFirstMessage?: () => void;
  onDiscard?: () => void;
  onGenerating?: () => void;
}) {
  const { language } = useLanguage();
  const [messages, setMessages]             = useState<Message[]>([]);
  const [input, setInput]                   = useState("");
  const [loading, setLoading]               = useState(false);
  const [storyReady, setStoryReady]         = useState(false);
  const [storyParams, setStoryParams]       = useState<Record<string, string> | null>(null);
  const [creating, setCreating]             = useState(false);
  const [createError, setCreateError]       = useState<string | null>(null);
  const [greeted, setGreeted]               = useState(false);
  const [discardConfirm, setDiscardConfirm] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState(5);

  // Per-message TTS (on-demand)
  const [speakingIdx, setSpeakingIdx]       = useState<number | null>(null);
  const [speakLoading, setSpeakLoading]     = useState<number | null>(null);
  const speakAbortRef                       = useRef<AbortController | null>(null);
  const speakAudioRef                       = useRef<HTMLAudioElement | null>(null);

  // Mic / speech-to-text
  const [listening, setListening]           = useState(false);
  const [micSupported, setMicSupported]     = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recogRef                            = useRef<any>(null);

  const bottomRef    = useRef<HTMLDivElement>(null);
  const textareaRef  = useRef<HTMLTextAreaElement>(null);
  const greetAbortRef = useRef<AbortController | null>(null);
  const firstMsgSent  = useRef(false);

  // Detect mic support on mount (client-only)
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setMicSupported(!!SR);
  }, []);

  // ─── On-demand TTS per Luna message ────────────────────────────────────────

  const stopSpeaking = useCallback(() => {
    speakAbortRef.current?.abort();
    speakAudioRef.current?.pause();
    speakAudioRef.current = null;
    setSpeakingIdx(null);
    setSpeakLoading(null);
  }, []);

  const speakMessage = useCallback(async (text: string, idx: number) => {
    stopSpeaking();
    setSpeakLoading(idx);
    const ctrl = new AbortController();
    speakAbortRef.current = ctrl;
    try {
      const res = await fetch("/api/synthesize-speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, characterName: "Narrator", assignedVoiceId: getNarratorVoiceId() }),
        signal: ctrl.signal,
      });
      if (!res.ok || ctrl.signal.aborted) return;
      const { audioData, mimeType } = await res.json() as { audioData: string; mimeType: string };
      if (!audioData || ctrl.signal.aborted) return;
      const audio = new Audio(`data:${mimeType};base64,${audioData}`);
      speakAudioRef.current = audio;
      audio.onended = () => { setSpeakingIdx(null); speakAudioRef.current = null; };
      audio.onerror = () => { setSpeakingIdx(null); speakAudioRef.current = null; };
      setSpeakLoading(null);
      setSpeakingIdx(idx);
      audio.play().catch(() => setSpeakingIdx(null));
    } catch {
      setSpeakLoading(null);
      setSpeakingIdx(null);
    }
  }, [stopSpeaking]);

  // ─── Mic toggle ────────────────────────────────────────────────────────────

  const toggleMic = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    if (listening) {
      recogRef.current?.stop();
      setListening(false);
      return;
    }

    const recog = new SR();
    recog.continuous = false;
    recog.interimResults = false;
    recog.lang = "en-US";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recog.onresult = (e: any) => {
      const transcript = Array.from(e.results as SpeechRecognitionResultList)
        .map((r) => r[0].transcript)
        .join(" ")
        .trim();
      if (transcript) {
        setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
          }
        }, 0);
      }
    };
    recog.onend  = () => setListening(false);
    recog.onerror = () => setListening(false);
    recogRef.current = recog;
    recog.start();
    setListening(true);
  }, [listening]);

  // ─── Scroll / reset ────────────────────────────────────────────────────────

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, loading, scrollToBottom]);

  useEffect(() => {
    greetAbortRef.current?.abort();
    stopSpeaking();
    setMessages([]);
    setStoryReady(false);
    setStoryParams(null);
    setGreeted(false);
    firstMsgSent.current = false;
  }, [activeChild?.id, stopSpeaking]);

  // ─── Greeting ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (greeted) return;
    setGreeted(true);
    setLoading(true);

    const ctrl = new AbortController();
    greetAbortRef.current = ctrl;

    fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [], childProfile: activeChild }),
      signal: ctrl.signal,
    })
      .then(async (r) => {
        const data: ChatResponse = await r.json();
        if (!r.ok || !data.reply) throw new Error("no reply");
        setMessages([{ role: "model", content: data.reply }]);
      })
      .catch((err) => {
        if ((err as Error).name === "AbortError") return;
        setMessages([{
          role: "model",
          content: "Hello! 🌙 I'm Luna, your story guide. Tonight we're going to dream up something magical together!\n\nSo — who's going to be the hero of our story? 🌟",
        }]);
      })
      .finally(() => setLoading(false));
  }, [greeted, activeChild]);

  // ─── Helpers ───────────────────────────────────────────────────────────────

  function getChildAgeGroup() {
    const age = activeChild?.age;
    if (age == null) return undefined;
    return age <= 4 ? "2-4" : age <= 6 ? "4-6" : age <= 8 ? "6-8" : age <= 10 ? "8-10" : "10-12";
  }

  // ─── Send message ──────────────────────────────────────────────────────────

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    if (!firstMsgSent.current) {
      firstMsgSent.current = true;
      onFirstMessage?.();
    }

    // "prompt:" shortcut — bypass chat, generate story directly
    if (text.toLowerCase().startsWith("prompt:")) {
      const promptText = text.slice(7).trim();
      if (!promptText) return;
      setMessages((prev) => [...prev, { role: "user", content: text }]);
      setInput("");
      setLoading(true);
      onGenerating?.();
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      try {
        const res = await fetch("/api/generate-story", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "prompt", promptText, durationMinutes, childAgeGroup: getChildAgeGroup(), language }),
        });
        if (!res.ok) throw new Error("Generation failed");
        const data = await res.json() as { blocks: ScriptBlock[]; title?: string; summary?: string; coverPrompt?: string };
        onScriptReady({ promptText, scriptBlocks: data.blocks ?? [], summary: data.summary ?? "", coverPrompt: data.coverPrompt ?? "", storyTitle: data.title ?? "" });
      } catch {
        setMessages((prev) => [...prev, { role: "model", content: "Oops! 🌙 I couldn't create the story — try describing it a little differently!" }]);
        setLoading(false);
      }
      return;
    }

    // Normal chat flow
    const next: Message[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, childProfile: activeChild }),
      });
      const data: ChatResponse = await res.json();
      if (!res.ok || !data.reply) throw new Error((data as { error?: string }).error ?? "no reply");
      setMessages((prev) => [...prev, { role: "model", content: data.reply }]);
      if (data.storyReady && data.storyParams) {
        setStoryReady(true);
        setStoryParams(data.storyParams);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "model", content: "Hmm, something got a little starry-eyed there ✨ Can you say that again?" }]);
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  }

  function handleDiscard() {
    stopSpeaking();
    recogRef.current?.stop();
    setListening(false);
    setMessages([]);
    setStoryReady(false);
    setStoryParams(null);
    setGreeted(false);
    setDiscardConfirm(false);
    firstMsgSent.current = false;
    onDiscard?.();
  }

  async function handleCreateStory() {
    if (!storyParams || creating) return;
    setCreating(true);
    setCreateError(null);
    onGenerating?.();
    try {
      const res = await fetch("/api/generate-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "wizard",
          hero: storyParams.hero ?? "",
          setting: storyParams.setting ?? "",
          plot: storyParams.plot ?? "",
          primaryVoiceId: storyParams.primaryVoiceId ?? "v1",
          durationMinutes,
          childAgeGroup: getChildAgeGroup(),
          language,
        }),
      });
      if (!res.ok) throw new Error("Generation failed");
      const data = await res.json() as { blocks: ScriptBlock[]; title?: string; summary?: string; coverPrompt?: string };
      onScriptReady({
        promptText: [storyParams.hero, storyParams.plot].filter(Boolean).join(" — "),
        scriptBlocks: data.blocks ?? [],
        summary: data.summary ?? "",
        coverPrompt: data.coverPrompt ?? "",
        storyTitle: data.title ?? "",
      }, durationMinutes);
    } catch {
      setCreateError("Couldn't write the story — please try again! ✨");
      setCreating(false);
    }
  }

  const childEmoji = activeChild?.avatar_emoji;
  const hasUserMessages = messages.some((m) => m.role === "user");

  return (
    <div className="flex flex-col gap-4">

      {/* Luna header */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl"
        style={{ background: "linear-gradient(135deg,rgba(45,27,105,0.5) 0%,rgba(10,20,60,0.4) 100%)", border: "1.5px solid rgba(167,139,250,0.2)" }}>
        <div className="relative flex-shrink-0">
          <OwlAvatar size={52} />
          <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#0a0f1e] animate-pulse"
            style={{ background: "#10D9A0", zIndex:10 }} />
        </div>
        <div>
          <p className="text-fs-body font-bold text-white">Luna</p>
          <p className="text-fs-body" style={{ color: "rgba(167,139,250,0.8)" }}>Your magical story guide ✨</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex flex-col gap-4">
        {messages.map((msg, i) => (
          <MessageBubble
            key={i}
            msg={msg}
            childEmoji={msg.role === "user" ? childEmoji : undefined}
            isPlaying={speakingIdx === i}
            isSpeechLoading={speakLoading === i}
            onTogglePlay={msg.role === "model" ? () => {
              if (speakingIdx === i) stopSpeaking();
              else speakMessage(msg.content, i);
            } : undefined}
          />
        ))}
        {loading && <TypingDots />}
        <div ref={bottomRef} />
      </div>

      {/* Story ready CTA */}
      {storyReady && (
        <div className="pt-1 flex flex-col gap-3">
          {/* Duration picker */}
          <div className="rounded-2xl px-4 py-3" style={{ background: "rgba(79,195,247,0.04)", border: "1px solid rgba(79,195,247,0.12)" }}>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-fs-body font-bold uppercase tracking-widest" style={{ color: "rgba(79,195,247,0.5)" }}>Story length</span>
              <span className="text-fs-body font-bold tabular-nums" style={{ color: "#4fc3f7" }}>{durationMinutes} min</span>
            </div>
            <div className="flex gap-2">
              {CHAT_DURATION_PRESETS.map((p) => (
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
          </div>

          {createError && (
            <p className="text-center text-fs-body" style={{ color: "#f87171" }}>{createError}</p>
          )}
          <button
            onClick={handleCreateStory}
            disabled={creating}
            className="w-full py-4 rounded-2xl font-bold text-white text-fs-heading transition-all active:scale-[0.98] disabled:opacity-70"
            style={{ background: "linear-gradient(135deg,#4fc3f7,#8B5CF6)", boxShadow: "0 0 28px rgba(139,92,246,0.4), 0 0 14px rgba(79,195,247,0.3)" }}
          >
            {creating ? "✨ Writing your story…" : "🌟 Create my story!"}
          </button>
        </div>
      )}

      {/* Input row */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 14 }}>
        <div className="flex items-end gap-2 px-3 py-3 rounded-2xl"
          style={{ background: "rgba(255,255,255,0.04)", border: "1.5px solid rgba(255,255,255,0.09)" }}>

          {/* Mic button — only if browser supports it */}
          {micSupported && (
            <button
              onClick={toggleMic}
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all active:scale-90"
              title={listening ? "Stop listening" : "Speak your idea"}
              style={listening ? {
                background: "rgba(248,113,113,0.2)",
                border: "1.5px solid rgba(248,113,113,0.5)",
                boxShadow: "0 0 12px rgba(248,113,113,0.3)",
              } : {
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              {listening ? (
                <span className="flex gap-0.5 items-end h-4">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="w-0.5 rounded-full animate-bounce"
                      style={{ height: 6 + i * 4, background: "#f87171", animationDelay: `${i * 0.15}s`, animationDuration: "0.6s" }} />
                  ))}
                </span>
              ) : (
                <Icon name="mic" size={14} className="text-white/50" />
              )}
            </button>
          )}

          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={listening ? "Listening… 🎙️" : "Tell Luna your story idea… 🌟"}
            rows={1}
            className="flex-1 bg-transparent outline-none resize-none leading-relaxed"
            style={{ fontSize: "var(--fs-body)", color: "rgba(255,255,255,0.9)", caretColor: "#a78bfa", maxHeight: 120 }}
          />

          {/* Send button */}
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all active:scale-90 disabled:opacity-20"
            style={{
              background: input.trim() && !loading
                ? "linear-gradient(135deg,#8B5CF6,#4fc3f7)"
                : "rgba(255,255,255,0.07)",
            }}
          >
            <Icon name="send" size={14} className="text-white" />
          </button>
        </div>

        {micSupported && (
          <p className="text-center mt-1.5" style={{ fontSize: "var(--fs-caption)", color: "rgba(255,255,255,0.13)" }}>
            {listening ? "🎙️ Tap mic to stop" : "🎙️ Tap mic to speak · Enter to send"}
          </p>
        )}
      </div>

      {/* Discard */}
      {hasUserMessages && (
        <div className="flex justify-center pb-1">
          {discardConfirm ? (
            <div className="flex items-center gap-3">
              <span className="text-fs-body" style={{ color: "rgba(255,255,255,0.35)" }}>Start over?</span>
              <button
                onClick={handleDiscard}
                className="text-fs-body px-3 py-1.5 rounded-xl font-semibold transition-all active:scale-95"
                style={{ background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.3)", color: "#f87171" }}
              >
                Yes, start over
              </button>
              <button
                onClick={() => setDiscardConfirm(false)}
                className="text-fs-body px-3 py-1.5 rounded-xl font-semibold transition-all active:scale-95"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.35)" }}
              >
                Keep going
              </button>
            </div>
          ) : (
            <button
              onClick={() => setDiscardConfirm(true)}
              className="text-fs-body transition-all active:scale-95"
              style={{ color: "rgba(255,255,255,0.18)" }}
            >
              <Icon name="submit" size={12} className="inline-block align-middle mr-1" /> Start over
            </button>
          )}
        </div>
      )}

    </div>
  );
}
