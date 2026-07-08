"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { DBChildProfile } from "@/app/api/child-profiles/route";
import type { DraftState } from "@/lib/draftStore";
import type { ScriptBlock } from "@/types";
import { getNarratorVoiceId } from "@/lib/narratorPreference";
import Icon from "@/components/ui/Icon";
import LanguageToggle from "@/components/ui/LanguageToggle";
import type { Language } from "@/types";

interface Message {
  role: "user" | "model";
  content: string;
  /** Smart-chip word clarification (typo/invented-word guesses) attached to
   *  this specific model message — tapping one sends it as the next message,
   *  same as if the user had typed it themselves. */
  chips?: string[];
}

interface ChatResponse {
  reply: string;
  storyReady: boolean;
  storyParams?: Record<string, string>;
  /** True when the user's own last message already explicitly said to go
   *  ahead (e.g. "yes let's go") -- skips the redundant quick-reply chip tap. */
  userConfirmedReady?: boolean;
  /** Word-clarification options (typo/invented-word guesses) for the user to
   *  tap instead of retyping — present only while Luna is still resolving an
   *  unclear word, before the story concept is actually ready. */
  clarificationChips?: string[];
}

// ─── Typing dots ──────────────────────────────────────────────────────

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

// ─── Message bubble ────────────────────────────────────────────────────

function MessageBubble({
  msg,
  childEmoji,
  isPlaying,
  isSpeechLoading,
  onTogglePlay,
  onSelectChip,
  chipsDisabled,
}: {
  msg: Message;
  childEmoji?: string;
  isPlaying?: boolean;
  isSpeechLoading?: boolean;
  onTogglePlay?: () => void;
  onSelectChip?: (chip: string) => void;
  chipsDisabled?: boolean;
}) {
  const isLuna = msg.role === "model";
  // Split Luna messages on newlines into separate visual bubbles
  const parts = isLuna
    ? msg.content.split("\n").map((s) => s.trim()).filter(Boolean)
    : [msg.content];

  return (
    <div className={`flex gap-3 items-end ${isLuna ? "justify-start" : "justify-end"}`}>
      {isLuna && <OwlAvatar size={44} />}
      <div className={`flex flex-col gap-1.5 ${isLuna ? "items-start" : "items-end"}`} style={{ maxWidth: "80%" }}>
        {parts.map((part, partIdx) => (
          <div
            key={partIdx}
            className="px-4 py-3.5 rounded-2xl leading-relaxed text-fs-body"
            style={{
              ...(isLuna ? {
                background: "linear-gradient(135deg,rgba(88,28,220,0.18) 0%,rgba(30,58,120,0.22) 100%)",
                border: "1.5px solid rgba(167,139,250,0.28)",
                color: "rgba(255,255,255,0.93)",
                borderBottomLeftRadius: partIdx === parts.length - 1 ? 6 : undefined,
              } : {
                background: "linear-gradient(135deg,#1a4a8a 0%,#1a6ab8 100%)",
                border: "1.5px solid rgba(79,195,247,0.35)",
                color: "#fff",
                borderBottomRightRadius: partIdx === parts.length - 1 ? 6 : undefined,
              }),
            }}
          >
            {part}
          </div>
        ))}

        {/* Smart-chip word clarification — tapping one sends it as the next
            message, same as typing it. */}
        {isLuna && msg.chips && msg.chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-0.5">
            {msg.chips.map((chip, i) => (
              <button
                key={i}
                disabled={chipsDisabled}
                onClick={() => onSelectChip?.(chip)}
                className="px-3 py-1.5 rounded-full text-fs-body font-semibold transition-all active:scale-95 disabled:opacity-50"
                style={{
                  background: "linear-gradient(135deg, rgba(251,191,36,0.16), rgba(245,158,11,0.1))",
                  border: "1.5px solid rgba(251,191,36,0.4)",
                  color: "#fcd34d",
                }}
              >
                {chip}
              </button>
            ))}
          </div>
        )}

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

// ─── Luna chat panel ───────────────────────────────────────────────────

const CHAT_DRAFT_KEY_PREFIX = "ns-chat-draft-v1";

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
  storyLanguage,
  onStoryLanguageChange,
}: {
  activeChild: DBChildProfile | null;
  onScriptReady: (draft: Omit<DraftState, "coverUrl">, durationMinutes?: number) => void;
  onFirstMessage?: () => void;
  onDiscard?: () => void;
  onGenerating?: () => void;
  /** The language this story is created in — independent of the app's
   *  global UI language (set via the picker in this panel's own header). */
  storyLanguage: string;
  onStoryLanguageChange: (lang: string) => void;
}) {
  const language = storyLanguage;

  const ERROR_REPLY_LABELS: Record<string, string> = {
    he: "אופס, משהו השתבש. ✨\nתוכלו לומר את זה שוב?",
    ar: "عذرًا، حدث خطأ ما. ✨\nهل يمكنك قول ذلك مرة أخرى؟",
    fr: "Oups, quelque chose a mal tourné. ✨\nPeux-tu redire ça ?",
    es: "Vaya, algo salió mal. ✨\n¿Puedes decirlo de nuevo?",
    de: "Hoppla, da ist etwas schiefgelaufen. ✨\nKannst du das noch einmal sagen?",
    it: "Ops, qualcosa è andato storto. ✨\nPuoi ripeterlo?",
    pt: "Ops, algo deu errado. ✨\nVocê pode dizer isso de novo?",
  };
  const errorReplyLabel = ERROR_REPLY_LABELS[language] ?? "Hmm, something went sideways. ✨\nCan you say that again?";

  const [messages, setMessages]             = useState<Message[]>([]);
  const [input, setInput]                   = useState("");
  const [loading, setLoading]               = useState(false);
  const [storyReady, setStoryReady]         = useState(false);
  const [storyParams, setStoryParams]       = useState<Record<string, string> | null>(null);
  const [creating, setCreating]             = useState(false);
  const [createError, setCreateError]       = useState<string | null>(null);
  const [greeted, setGreeted]               = useState(false);
  const [discardConfirm, setDiscardConfirm] = useState(false);
  const [topResetConfirm, setTopResetConfirm] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState(5);
  const [readyConfirmed, setReadyConfirmed] = useState(false);

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

  // ─── On-demand TTS per Luna message ────────────────────────────────────

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

  // ─── Mic toggle ───────────────────────────────────────────────────

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

  // ─── Scroll / reset ──────────────────────────────────────────────────

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, loading, scrollToBottom]);

  const chatDraftKey = `${CHAT_DRAFT_KEY_PREFIX}-${activeChild?.id ?? "no-child"}`;
  // On mount, this restore effect and the greeting effect below both run in
  // the SAME initial effect flush, off the same render's closure -- so
  // setGreeted(true) here isn't visible to the greeting effect's `if
  // (greeted) return` check yet (state updates only apply on the next
  // render). Without this ref, reopening the Chat tab would restore the
  // saved conversation and then immediately overwrite it with a fresh
  // greeting. A ref is mutated synchronously, so it's visible right away.
  const skipGreetingRef = useRef(false);

  useEffect(() => {
    greetAbortRef.current?.abort();
    stopSpeaking();
    // Try to restore saved chat state for this child
    let restored = false;
    try {
      const saved = localStorage.getItem(`${CHAT_DRAFT_KEY_PREFIX}-${activeChild?.id ?? "no-child"}`);
      if (saved) {
        const parsed = JSON.parse(saved) as {
          messages?: Message[];
          storyReady?: boolean;
          storyParams?: Record<string, string> | null;
          readyConfirmed?: boolean;
          durationMinutes?: number;
        };
        if (parsed.messages?.length) {
          setMessages(parsed.messages);
          if (parsed.storyReady) setStoryReady(parsed.storyReady);
          if (parsed.storyParams) setStoryParams(parsed.storyParams);
          // Deliberately never restore readyConfirmed=true — the Story Length
          // panel should only appear after the user re-confirms "let's go" in
          // this visit, not immediately on reopening a past conversation.
          if (parsed.durationMinutes) setDurationMinutes(parsed.durationMinutes);
          setGreeted(true);
          firstMsgSent.current = true;
          restored = true;
        }
      }
    } catch { /* ignore */ }

    skipGreetingRef.current = restored;
    if (!restored) {
      setMessages([]);
      setStoryReady(false);
      setStoryParams(null);
      setReadyConfirmed(false);
      setGreeted(false);
      firstMsgSent.current = false;
    }
  }, [activeChild?.id, stopSpeaking]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist chat state on every message change
  useEffect(() => {
    if (!messages.length) return;
    try {
      localStorage.setItem(chatDraftKey, JSON.stringify({ messages, storyReady, storyParams, readyConfirmed, durationMinutes }));
    } catch { /* ignore */ }
  }, [messages, storyReady, storyParams, readyConfirmed, durationMinutes, chatDraftKey]);

  // ─── Greeting ────────────────────────────────────────────────────────

  useEffect(() => {
    if (greeted || skipGreetingRef.current) return;
    setGreeted(true);
    setLoading(true);

    const ctrl = new AbortController();
    greetAbortRef.current = ctrl;

    // Retries once before falling back — transient failures (rate limiting,
    // a network blip) are common and shouldn't force an English fallback
    // greeting onto a chat that was just set to a different language.
    const attemptGreeting = async (isRetry = false): Promise<void> => {
      try {
        const r = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: [], childProfile: activeChild, language }),
          signal: ctrl.signal,
        });
        const data: ChatResponse & { error?: string } = await r.json();
        if (!r.ok || !data.reply) throw new Error(data.error ?? `Chat greeting failed (HTTP ${r.status})`);
        setMessages([{ role: "model", content: data.reply }]);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        console.error(`[Luna] Greeting fetch failed${isRetry ? " (after retry)" : " — retrying once"}:`, err);
        if (!isRetry) {
          await attemptGreeting(true);
          return;
        }
        setMessages([{
          role: "model",
          content: "Hello! 🌙 I'm Luna.\nYour magical story guide.\n\nWho's our hero tonight? 🌟",
        }]);
      }
    };

    attemptGreeting().finally(() => setLoading(false));
  }, [greeted, activeChild, language]);

  // ─── Helpers ───────────────────────────────────────────────────────

  function getChildAgeGroup() {
    const age = activeChild?.age;
    if (age == null) return undefined;
    return age <= 4 ? "2-4" : age <= 6 ? "4-6" : age <= 8 ? "6-8" : age <= 10 ? "8-10" : "10-12";
  }

  // ─── Send message ──────────────────────────────────────────────────

  async function sendMessage(overrideText?: string) {
    const text = (overrideText ?? input).trim();
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
          body: JSON.stringify({ mode: "prompt", promptText, durationMinutes, childAgeGroup: getChildAgeGroup(), language, narratorVoiceId: getNarratorVoiceId() }),
        });
        if (!res.ok) throw new Error("Generation failed");
        const data = await res.json() as { blocks: ScriptBlock[]; title?: string; summary?: string; coverPrompt?: string };
        onScriptReady({ promptText, scriptBlocks: data.blocks ?? [], summary: data.summary ?? "", coverPrompt: data.coverPrompt ?? "", storyTitle: data.title ?? "" });
      } catch {
        setMessages((prev) => [...prev, { role: "model", content: "Oops! 🌙\nCouldn't create the story.\nTry describing it a little differently!" }]);
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

    const sendOnce = async () => {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, childProfile: activeChild, language }),
      });
      const data: ChatResponse & { error?: string } = await res.json();
      if (!res.ok || !data.reply) throw new Error(data.error ?? `Chat reply failed (HTTP ${res.status})`);
      return data;
    };

    try {
      let data: ChatResponse;
      try {
        data = await sendOnce();
      } catch (err) {
        console.error("[Luna] Send failed — retrying once:", err);
        data = await sendOnce();
      }
      setMessages((prev) => [...prev, { role: "model", content: data.reply, chips: data.clarificationChips?.length ? data.clarificationChips : undefined }]);
      // Luna's own reply already ends with a language-correct "anything else
      // to add?" question per the STORY_READY prompt rule — no separate
      // synthetic follow-up needed (a leftover from before that rule existed
      // was both redundant and always hardcoded in English regardless of story language).
      if (data.storyReady && data.storyParams) {
        setStoryReady(true);
        setStoryParams(data.storyParams);
        // Typing an explicit go-ahead ("yes let's go", "start now", etc.)
        // counts the same as tapping the quick-reply chip -- skip straight
        // to the duration picker + Create button instead of showing it again.
        setReadyConfirmed(!!data.userConfirmedReady);
      }
    } catch (err) {
      console.error("[Luna] Send failed (after retry):", err);
      setMessages((prev) => [...prev, { role: "model", content: errorReplyLabel }]);
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
    try { localStorage.removeItem(chatDraftKey); } catch { /* ignore */ }
    stopSpeaking();
    recogRef.current?.stop();
    setListening(false);
    setMessages([]);
    setStoryReady(false);
    setStoryParams(null);
    setGreeted(false);
    setDiscardConfirm(false);
    setReadyConfirmed(false);
    setTopResetConfirm(false);
    firstMsgSent.current = false;
    onDiscard?.();
  }

  // Selecting a language mid-chat would leave old messages in one language
  // and new ones in another — restart fresh so the whole conversation (including
  // the greeting, which has no user text yet to "mirror") is in the new language.
  // This only affects this panel's story language, never the app's global UI
  // language (LanguageToggle is used here in controlled mode).
  function handleLanguageChange(lang: Language) {
    onStoryLanguageChange(lang);
    handleDiscard();
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
          narratorVoiceId: getNarratorVoiceId(),
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

  const LETS_GO_LABELS: Record<string, string> = {
    he: "בואו נתחיל!",
    ar: "هيا بنا!",
    fr: "C'est parti !",
    es: "¡Vamos!",
    de: "Los geht's!",
    it: "Andiamo!",
    pt: "Vamos lá!",
  };
  const letsGoLabel = LETS_GO_LABELS[language] ?? "Let's go !";

  const QUICK_REPLY_HINT_LABELS: Record<string, string> = {
    he: "תשובה מהירה",
    ar: "رد سريع",
    fr: "Réponse rapide",
    es: "Respuesta rápida",
    de: "Schnelle Antwort",
    it: "Risposta rapida",
    pt: "Resposta rápida",
  };
  const quickReplyHint = QUICK_REPLY_HINT_LABELS[language] ?? "Quick reply";

  return (
    <div className="flex flex-col gap-4">

      {/* Reset + language — always visible, independent of chat progress */}
      <div className="flex items-center gap-2">
        {topResetConfirm ? (
          <div className="flex items-center gap-2 flex-1">
            <span className="text-fs-body" style={{ color: "rgba(255,255,255,0.35)" }}>Start over?</span>
            <button
              onClick={handleDiscard}
              className="text-fs-body px-3 py-1.5 rounded-xl font-semibold transition-all active:scale-95"
              style={{ background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.3)", color: "#f87171" }}
            >
              Yes, start over
            </button>
            <button
              onClick={() => setTopResetConfirm(false)}
              className="text-fs-body px-3 py-1.5 rounded-xl font-semibold transition-all active:scale-95"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.35)" }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => hasUserMessages ? setTopResetConfirm(true) : handleDiscard()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-fs-body font-semibold transition-all active:scale-95"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.45)" }}
          >
            <Icon name="submit" size={12} />
            <span>Start over</span>
          </button>
        )}
        {/* Changing language mid-chat wipes the whole conversation (it
            restarts fresh so nothing ends up half in one language, half in
            another) -- only offer it before the chat has actually started. */}
        {!topResetConfirm && !hasUserMessages && (
          <LanguageToggle value={storyLanguage as Language} onLanguageChange={handleLanguageChange} />
        )}
      </div>

      {/* Luna header */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl"
        style={{ background: "linear-gradient(135deg,rgba(45,27,105,0.5) 0%,rgba(10,20,60,0.4) 100%)", border: "1.5px solid rgba(167,139,250,0.2)" }}>
        <div className="relative flex-shrink-0">
          <OwlAvatar size={52} />
          <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#0a0f1e] animate-pulse"
            style={{ background: "#10D9A0", zIndex:10 }} />
        </div>
        <div className="flex-1">
          <p className="text-fs-body font-bold text-white">Luna</p>
          <p className="text-fs-body" style={{ color: "rgba(167,139,250,0.8)" }}>Your magical story guide ✨</p>
        </div>
        {hasUserMessages && (
          <button
            onClick={handleDiscard}
            className="text-fs-body transition-all active:scale-95 flex-shrink-0"
            style={{ color: "rgba(255,255,255,0.22)" }}
          >
            Start over
          </button>
        )}
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
            onSelectChip={(chip) => sendMessage(chip)}
            chipsDisabled={loading}
          />
        ))}
        {loading && <TypingDots />}

        {/* Quick-reply chip answering Luna's "anything else to add?" question.
            Deliberately styled unlike a message bubble (centered, pill-shaped,
            warm accent color, glow, icon, hint caption) so it reads as a
            tappable action rather than another line of conversation.
            Guarded on hasUserMessages too: storyReady should only ever become
            true after a real user reply (never on the bare greeting), but
            this is a deterministic backstop in case that ever drifts. */}
        {storyReady && !readyConfirmed && hasUserMessages && (
          <div className="flex flex-col items-center gap-1.5 mt-1 mb-1">
            <span
              className="text-fs-caption font-bold uppercase tracking-widest"
              style={{ color: "rgba(252,211,77,0.55)" }}
            >
              {quickReplyHint}
            </span>
            <button
              onClick={() => setReadyConfirmed(true)}
              className="flex items-center gap-2 py-2.5 px-6 rounded-full text-fs-body font-bold transition-all active:scale-95"
              style={{
                background: "linear-gradient(135deg, rgba(251,191,36,0.22), rgba(245,158,11,0.15))",
                border: "1.5px solid rgba(251,191,36,0.6)",
                color: "#fcd34d",
                boxShadow: "0 0 20px rgba(251,191,36,0.25)",
              }}
            >
              <span>✨</span>
              <span>{letsGoLabel}</span>
            </button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Story ready CTA — only after user confirms */}
      {storyReady && readyConfirmed && (
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
            <div className="mt-3">
              <input type="range" min={1} max={10} step={1} value={durationMinutes}
                onChange={(e) => setDurationMinutes(+e.target.value)}
                className="w-full cursor-pointer" style={{ accentColor: "#4fc3f7" }} />
              <div className="flex justify-between text-fs-body mt-0.5" style={{ color: "rgba(255,255,255,0.2)" }}>
                <span>1 min</span>
                <span style={{ color: "rgba(255,255,255,0.12)" }}>· · · · · · · · ·</span>
                <span>10 min</span>
              </div>
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
            placeholder={listening ? "Listening… 🎤" : hasUserMessages ? "" : "Tell Luna your story idea… 🌟"}
            rows={1}
            className="flex-1 bg-transparent outline-none resize-none leading-relaxed"
            style={{ fontSize: "var(--fs-body)", color: "rgba(255,255,255,0.9)", caretColor: "#a78bfa", maxHeight: 120 }}
          />

          {/* Send button */}
          <button
            onClick={() => sendMessage()}
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
            {listening ? "🎤 Tap mic to stop" : "🎤 Tap mic to speak · Enter to send"}
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
