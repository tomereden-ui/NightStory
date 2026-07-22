"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { DBChildProfile } from "@/app/api/child-profiles/route";
import type { DraftState } from "@/lib/draftStore";
import type { ScriptBlock, StoryScene } from "@/types";
import { getNarratorVoiceId } from "@/lib/narratorPreference";
import Icon from "@/components/ui/Icon";
import LanguageToggle from "@/components/ui/LanguageToggle";
import OwlAvatar from "@/components/ui/OwlAvatar";
import { LunaWorkingBanner } from "@/components/studio/LunaWorkingCard";
import { getWizardUi } from "@/constants/wizardUi";
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

// Labels come from wizardUi at render time (language-dependent) — this only
// holds the language-independent value/icon pairing.
const CHAT_DURATION_PRESETS = [
  { value: 3, icon: "⚡", labelKey: "short" as const },
  { value: 5, icon: "🌙", labelKey: "medium" as const },
  { value: 8, icon: "✨", labelKey: "long" as const },
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

  const PROMPT_PLACEHOLDER_LABELS: Record<string, string> = {
    he: "ספרו ללונה על רעיון הסיפור שלכם… 🌟",
    ar: "أخبر لونا بفكرة قصتك… 🌟",
    fr: "Dis à Luna ton idée d'histoire… 🌟",
    es: "Cuéntale a Luna tu idea de historia… 🌟",
    de: "Erzähl Luna deine Geschichtsidee… 🌟",
    it: "Racconta a Luna la tua idea di storia… 🌟",
    pt: "Conte à Luna sua ideia de história… 🌟",
  };
  const promptPlaceholder = PROMPT_PLACEHOLDER_LABELS[language] ?? "Tell Luna your story idea… 🌟";

  const [messages, setMessages]             = useState<Message[]>([]);
  const [input, setInput]                   = useState("");
  const [loading, setLoading]               = useState(false);
  const [storyReady, setStoryReady]         = useState(false);
  const [storyParams, setStoryParams]       = useState<Record<string, string> | null>(null);
  const [creating, setCreating]             = useState(false);
  const [createError, setCreateError]       = useState<string | null>(null);
  // Populated only when generation was blocked by the safety filter -- an
  // AI-reworded version of the flagged fields that removes just the
  // ambiguity, offered as a one-tap "try this instead" the user approves,
  // never auto-retried silently (see suggestSaferRewrite in the API route).
  const [suggestedRewrite, setSuggestedRewrite] = useState<Record<string, string> | null>(null);
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
      // Resolves the child's confirmed pronunciation override server-side —
      // never changes the message text rendered in this chat, only what's
      // sent to the TTS engine.
      const activeChildId = typeof window !== "undefined" ? localStorage.getItem("ns-active-child-id") : null;
      const res = await fetch("/api/synthesize-speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, characterName: "Narrator", assignedVoiceId: getNarratorVoiceId(), childIds: activeChildId ? [activeChildId] : undefined }),
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
  // the SAME initial effect flush, off the same render's closure -- so a
  // state update here isn't visible to the greeting effect's guards yet
  // (state updates only apply on the next render). Without this ref,
  // reopening the Chat tab would restore the saved conversation and then
  // immediately overwrite it with a fresh greeting. A ref is mutated
  // synchronously, so it's visible right away -- same reasoning applies to
  // firstMsgSent and greetedLanguageRef below.
  const skipGreetingRef = useRef(false);
  // Tracks which language the currently-shown greeting was actually fetched
  // in -- see the full explanation on the greeting effect below. Declared
  // here (not next to that effect) because the restore-draft effect right
  // below needs to reset it too, and reading it before its declaration
  // would be a temporal-dead-zone error.
  const greetedLanguageRef = useRef<string | null>(null);

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
      firstMsgSent.current = false;
      greetedLanguageRef.current = null;
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
  // greetedLanguageRef tracks which language the currently-shown greeting
  // was actually fetched in (a ref, not a one-shot "greeted" boolean) --
  // because `language` (storyLang) can resolve asynchronously shortly
  // after mount (Studio loads a persisted story-language override from
  // localStorage in its own effect, after this component has already
  // mounted), a one-shot guard would let the greeting fire once in
  // whatever the default language happened to be at that instant and then
  // never correct itself, even though every later reply in the
  // conversation reads the current `language` value fresh and gets it
  // right. Reset in handleDiscard() and on the restore-draft "not
  // restored" path above so a fresh greeting is always forced then,
  // regardless of whether `language` happens to already match.

  useEffect(() => {
    // skipGreetingRef: a real saved conversation was restored -- never touch
    // its greeting, even if the app's language has since moved on.
    // firstMsgSent: the user has actually sent a message this session --
    // once that's true the language picker is hidden anyway, so nothing
    // should be pulling the rug out from under a real conversation. Both
    // are refs (not state) so they're accurate even within the same effect
    // flush as the restore-draft effect above, before its own state updates
    // have applied to a new render yet.
    if (skipGreetingRef.current || firstMsgSent.current) return;
    if (greetedLanguageRef.current === language) return;
    greetedLanguageRef.current = language;
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
  }, [activeChild, language]);

  // ─── Helpers ───────────────────────────────────────────────────────

  function getChildAgeGroup() {
    const age = activeChild?.age;
    if (age == null) return undefined;
    return age <= 4 ? "2-4" : age <= 6 ? "4-6" : age <= 8 ? "6-8" : age <= 10 ? "8-10" : "10-12";
  }

  // Every remaining field on the active child's profile — folded into every
  // generate-story call so the full profile (not just age/lessons) actually
  // reaches the story prompt, not just this panel's own /api/chat context.
  function getChildContext() {
    return {
      avoid: activeChild?.avoid,
      gender: activeChild?.gender,
      favoriteThemes: activeChild?.favorite_themes,
      favoriteAnimals: activeChild?.favorite_animals,
      preferredFigures: activeChild?.preferred_figures,
      interests: activeChild?.interests,
      notes: activeChild?.notes,
    };
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
          body: JSON.stringify({ mode: "prompt", promptText, durationMinutes, childAgeGroup: getChildAgeGroup(), language, narratorVoiceId: getNarratorVoiceId(), lessons: activeChild?.default_moral_lessons ?? [], ...getChildContext() }),
        });
        const data = await res.json() as { blocks: ScriptBlock[]; title?: string; summary?: string; coverPrompt?: string; scenes?: StoryScene[]; error?: string };
        if (!res.ok) throw new Error(data.error || "Generation failed");
        onScriptReady({ promptText, scriptBlocks: data.blocks ?? [], summary: data.summary ?? "", coverPrompt: data.coverPrompt ?? "", storyTitle: data.title ?? "", scenes: data.scenes ?? [] });
      } catch (err) {
        // The server already returns a clear, localized reason when there is
        // one (e.g. a safety-filter block) -- only fall back to the generic
        // line for genuinely unexpected failures (network drop, etc.).
        const serverMessage = err instanceof Error && err.message && err.message !== "Generation failed" ? err.message : null;
        setMessages((prev) => [...prev, { role: "model", content: serverMessage ?? "Oops! 🌙\nCouldn't create the story.\nTry describing it a little differently!" }]);
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
      // Always sync to the latest turn's actual readiness -- a prior turn may
      // have been storyReady (e.g. a restored draft), but if the user then
      // types something unclear, this turn correctly comes back with
      // storyReady:false + clarificationChips, and the "Let's go!" button
      // must not keep showing from the stale earlier state.
      if (data.storyReady && data.storyParams) {
        setStoryReady(true);
        setStoryParams(data.storyParams);
        // Typing an explicit go-ahead ("yes let's go", "start now", etc.)
        // counts the same as tapping the quick-reply chip -- skip straight
        // to the duration picker + Create button instead of showing it again.
        setReadyConfirmed(!!data.userConfirmedReady);
      } else {
        setStoryReady(false);
        setStoryParams(null);
        setReadyConfirmed(false);
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
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setStoryReady(false);
    setStoryParams(null);
    greetedLanguageRef.current = null;
    skipGreetingRef.current = false;
    setReadyConfirmed(false);
    setTopResetConfirm(false);
    setDurationMinutes(5);
    setCreateError(null);
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

  // overrideFields lets the "try this instead" button retry with the
  // AI-reworded hero/setting/plot without mutating storyParams itself --
  // if the reworded attempt ALSO fails for some unrelated reason, the
  // original wording is still there to fall back to.
  async function handleCreateStory(overrideFields?: Record<string, string>) {
    if (!storyParams || creating) return;
    setCreating(true);
    setCreateError(null);
    setSuggestedRewrite(null);
    onGenerating?.();
    try {
      const res = await fetch("/api/generate-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "wizard",
          hero: overrideFields?.hero ?? storyParams.hero ?? "",
          setting: overrideFields?.setting ?? storyParams.setting ?? "",
          plot: overrideFields?.plot ?? storyParams.plot ?? "",
          primaryVoiceId: storyParams.primaryVoiceId ?? "v1",
          durationMinutes,
          childAgeGroup: getChildAgeGroup(),
          language,
          narratorVoiceId: getNarratorVoiceId(),
          lessons: activeChild?.default_moral_lessons ?? [],
          ...getChildContext(),
        }),
      });
      const data = await res.json() as { blocks: ScriptBlock[]; title?: string; summary?: string; coverPrompt?: string; scenes?: StoryScene[]; error?: string; blocked?: boolean; suggestedRewrite?: Record<string, string> };
      if (!res.ok) {
        if (data.blocked && data.suggestedRewrite) setSuggestedRewrite(data.suggestedRewrite);
        throw new Error(data.error || "Generation failed");
      }
      onScriptReady({
        promptText: [overrideFields?.hero ?? storyParams.hero, overrideFields?.plot ?? storyParams.plot].filter(Boolean).join(" — "),
        scriptBlocks: data.blocks ?? [],
        summary: data.summary ?? "",
        coverPrompt: data.coverPrompt ?? "",
        storyTitle: data.title ?? "",
        scenes: data.scenes ?? [],
      }, durationMinutes);
    } catch (err) {
      // Surface the server's actual (already localized) reason when it gave
      // one -- e.g. a safety-filter block -- instead of always showing the
      // same generic line regardless of cause.
      const serverMessage = err instanceof Error && err.message && err.message !== "Generation failed" ? err.message : null;
      setCreateError(serverMessage ?? "Couldn't write the story — please try again! ✨");
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

  // The quick-reply CTA names the story piece Luna just gathered, reusing the
  // exact same localized strings as the step-by-step wizard's confirm buttons
  // ("This is my hero!" -> "This is the world!" -> "This is the companion!")
  // so both creation modes read consistently. storyParams only ever grows
  // (never loses a key once Luna has it), so this walks hero -> setting ->
  // everything-after-that in order, falling back to a generic label once all
  // three canonical pieces are already present.
  const wizardUi = useMemo(() => getWizardUi(language), [language]);
  const stepConfirmLabel = !storyParams?.hero
    ? wizardUi.thisIsMyHero
    : !storyParams?.setting
    ? wizardUi.thisIsTheWorld
    : !storyParams?.plot
    ? wizardUi.thisIsTheCompanion
    : letsGoLabel;

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

  // Shown only before the child's first message — once they've replied, Luna's
  // already asking follow-ups one at a time, so the tip no longer applies.
  // Reappears if they start over, since hasUserMessages resets to false too.
  const WRITE_IT_ALL_LABELS: Record<string, string> = {
    he: "💡 טיפ: אפשר גם פשוט לכתוב את כל הרעיון בבת אחת!",
    ar: "💡 نصيحة: يمكنك أيضًا كتابة فكرتك كاملة دفعة واحدة!",
    fr: "💡 Astuce : tu peux aussi écrire toute ton idée d'un coup !",
    es: "💡 Consejo: ¡también puedes escribir toda tu idea de una vez!",
    de: "💡 Tipp: Du kannst auch einfach deine ganze Idee auf einmal schreiben!",
    it: "💡 Suggerimento: puoi anche scrivere subito tutta la tua idea!",
    pt: "💡 Dica: você também pode escrever toda a sua ideia de uma vez!",
  };
  const writeItAllHint = WRITE_IT_ALL_LABELS[language] ?? "💡 Tip: you can also just write your whole idea at once!";

  const LUNA_NAME_LABELS: Record<string, string> = {
    he: "לונה",
    ar: "لونا",
    fr: "Luna",
    es: "Luna",
    de: "Luna",
    it: "Luna",
    pt: "Luna",
  };
  const lunaNameLabel = LUNA_NAME_LABELS[language] ?? "Luna";

  const LUNA_SUBTITLE_LABELS: Record<string, string> = {
    he: "מדריכת הסיפורים הקסומה שלך ✨",
    ar: "مرشدتك السحرية للقصص ✨",
    fr: "Ta guide magique des histoires ✨",
    es: "Tu guía mágica de historias ✨",
    de: "Deine magische Geschichtenführerin ✨",
    it: "La tua guida magica alle storie ✨",
    pt: "Sua guia mágica de histórias ✨",
  };
  const lunaSubtitleLabel = LUNA_SUBTITLE_LABELS[language] ?? "Your magical story guide ✨";

  // Shown only when a generation attempt was blocked by the safety filter
  // and the server sent back a reworded suggestion (see suggestSaferRewrite
  // in /api/generate-story) -- a caption above the suggested text, and the
  // button that retries with it.
  const TRY_THIS_INSTEAD_LABELS: Record<string, string> = {
    he: "אולי זה יעבוד יותר טוב:",
    ar: "قد يعمل هذا بشكل أفضل:",
    fr: "Ceci pourrait mieux fonctionner :",
    es: "Esto podría funcionar mejor:",
    de: "Das könnte besser funktionieren:",
    it: "Questo potrebbe funzionare meglio:",
    pt: "Isso pode funcionar melhor:",
  };
  const tryThisInsteadLabel = TRY_THIS_INSTEAD_LABELS[language] ?? "This might work better:";

  const TRY_THIS_BUTTON_LABELS: Record<string, string> = {
    he: "נסו את זה ✨",
    ar: "جرّب هذا ✨",
    fr: "Essayer ceci ✨",
    es: "Probar esto ✨",
    de: "Das versuchen ✨",
    it: "Prova questo ✨",
    pt: "Tentar isso ✨",
  };
  const tryThisButtonLabel = TRY_THIS_BUTTON_LABELS[language] ?? "Try this ✨";

  return (
    <div className="flex flex-col gap-4">

      {/* Reset + language — always visible, independent of chat progress */}
      <div className="flex items-center gap-2">
        {topResetConfirm ? (
          <div className="flex items-center gap-2 flex-1">
            <span className="text-fs-body" style={{ color: "rgba(255,255,255,0.55)" }}>Start over?</span>
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
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.55)" }}
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
          <p className="text-fs-body font-bold text-white">{lunaNameLabel}</p>
          <p className="text-fs-body" style={{ color: "rgba(167,139,250,0.8)" }}>{lunaSubtitleLabel}</p>
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
              className="flex items-center gap-2 py-2.5 px-6 rounded-full text-fs-body font-semibold transition-all active:scale-95"
              style={{
                background: "rgba(251,191,36,0.08)",
                border: "1px solid rgba(251,191,36,0.28)",
                color: "#fbd98a",
                boxShadow: "0 0 8px rgba(251,191,36,0.06)",
              }}
            >
              <span>✨</span>
              <span>{stepConfirmLabel}</span>
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
              <span className="text-fs-body font-bold uppercase tracking-widest" style={{ color: "rgba(79,195,247,0.5)" }}>{wizardUi.storyLength}</span>
              <span className="text-fs-body font-bold tabular-nums" style={{ color: "#4fc3f7" }}>{durationMinutes} {wizardUi.minutesUnit}</span>
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
                  <span className="text-fs-body font-bold" style={{ color: durationMinutes === p.value ? "#4fc3f7" : "rgba(255,255,255,0.45)" }}>{wizardUi[p.labelKey]}</span>
                  <span className="text-fs-body" style={{ color: durationMinutes === p.value ? "rgba(79,195,247,0.6)" : "rgba(255,255,255,0.2)" }}>~{p.value} {wizardUi.minutesUnit}</span>
                </button>
              ))}
            </div>
            <div className="mt-3">
              <input type="range" min={1} max={10} step={1} value={durationMinutes}
                onChange={(e) => setDurationMinutes(+e.target.value)}
                className="w-full cursor-pointer" style={{ accentColor: "#4fc3f7" }} />
              <div className="flex justify-between text-fs-body mt-0.5" style={{ color: "rgba(255,255,255,0.40)" }}>
                <span>1 {wizardUi.minutesUnit}</span>
                <span style={{ color: "rgba(255,255,255,0.35)" }}>· · · · · · · · ·</span>
                <span>10 {wizardUi.minutesUnit}</span>
              </div>
            </div>
          </div>

          {createError && (
            <p className="text-center text-fs-body" style={{ color: "#f87171" }}>{createError}</p>
          )}

          {/* A safety-filter block came with an AI-reworded version that
              removes just the ambiguity -- shown for the user to approve,
              never applied automatically. */}
          {suggestedRewrite && (
            <div className="rounded-2xl px-4 py-3 flex flex-col gap-2" style={{ background: "rgba(79,195,247,0.06)", border: "1px solid rgba(79,195,247,0.15)" }}>
              <p className="text-fs-body font-semibold" style={{ color: "rgba(79,195,247,0.75)" }}>{tryThisInsteadLabel}</p>
              <p className="text-fs-body italic" style={{ color: "rgba(255,255,255,0.7)" }}>
                {[suggestedRewrite.hero, suggestedRewrite.setting, suggestedRewrite.plot, suggestedRewrite.promptText].filter(Boolean).join(" — ")}
              </p>
              <button
                onClick={() => handleCreateStory(suggestedRewrite)}
                disabled={creating}
                className="self-start px-4 py-2 rounded-xl text-fs-body font-semibold transition-all active:scale-95 disabled:opacity-50"
                style={{ background: "rgba(79,195,247,0.18)", border: "1.5px solid #4fc3f7", color: "#4fc3f7" }}
              >
                {tryThisButtonLabel}
              </button>
            </div>
          )}

          {creating && <LunaWorkingBanner label={wizardUi.writingYourStory} />}

          <button
            onClick={() => handleCreateStory()}
            disabled={creating}
            className="w-full py-4 rounded-2xl font-bold text-white text-fs-heading transition-all active:scale-[0.98] disabled:opacity-70"
            style={{ background: "linear-gradient(135deg,#4fc3f7,#8B5CF6)", boxShadow: "0 0 28px rgba(139,92,246,0.4), 0 0 14px rgba(79,195,247,0.3)" }}
          >
            {creating ? `✨ ${wizardUi.writingYourStory}` : `🌟 ${wizardUi.createMyStoryButton}`}
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
            placeholder={listening ? "Listening… 🎤" : hasUserMessages ? "" : promptPlaceholder}
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

        {!hasUserMessages && !listening && (
          <p className="text-center mt-2 px-2 font-semibold" style={{ fontSize: "var(--fs-body)", lineHeight: 1.35, color: "rgba(167,139,250,0.95)" }}>
            {writeItAllHint}
          </p>
        )}

        {micSupported && (
          <p className="text-center mt-1.5" style={{ fontSize: "var(--fs-caption)", color: "rgba(255,255,255,0.35)" }}>
            {listening ? "🎤 Tap mic to stop" : "🎤 Tap mic to speak · Enter to send"}
          </p>
        )}
      </div>

    </div>
  );
}
