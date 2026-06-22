"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { DBChildProfile } from "@/app/api/child-profiles/route";
import type { DraftState } from "@/lib/draftStore";
import type { ScriptBlock } from "@/types";
import { getNarratorVoiceId } from "@/lib/narratorPreference";

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

function TypingDots() {
  return (
    <div className="flex justify-start gap-2.5 items-end">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-xs flex-shrink-0"
        style={{ background: "linear-gradient(135deg, #1a1a4e, #4fc3f7)" }}
      >
        🌙
      </div>
      <div
        className="px-3.5 py-3 rounded-2xl rounded-bl-md flex items-center gap-1.5"
        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)" }}
      >
        {[0, 1, 2].map((i) => (
          <span key={i} className="w-1.5 h-1.5 rounded-full animate-bounce"
            style={{ background: "#4fc3f7", animationDelay: `${i * 0.18}s`, animationDuration: "0.9s" }} />
        ))}
      </div>
    </div>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg, childEmoji }: { msg: Message; childEmoji?: string }) {
  const isLuna = msg.role === "model";
  return (
    <div className={`flex gap-2 items-end ${isLuna ? "justify-start" : "justify-end"}`}>
      {isLuna && (
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #1a1a4e, #4fc3f7)" }}>
          🌙
        </div>
      )}
      <div
        className="max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap"
        style={isLuna ? {
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.09)",
          color: "rgba(255,255,255,0.88)",
          borderBottomLeftRadius: 6,
        } : {
          background: "linear-gradient(135deg, #1E3A5F 0%, #2D5F8A 100%)",
          border: "1px solid rgba(79,195,247,0.2)",
          color: "#fff",
          borderBottomRightRadius: 6,
        }}
      >
        {msg.content}
      </div>
      {!isLuna && (
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-base flex-shrink-0"
          style={{ background: "rgba(79,195,247,0.12)", border: "1px solid rgba(79,195,247,0.2)", flexShrink: 0 }}>
          {childEmoji ?? "👤"}
        </div>
      )}
    </div>
  );
}

// ─── Luna chat panel ──────────────────────────────────────────────────────────

export default function LunaChatPanel({
  activeChild,
  onScriptReady,
  onFirstMessage,
  onDiscard,
}: {
  activeChild: DBChildProfile | null;
  onScriptReady: (draft: Omit<DraftState, "coverUrl">) => void;
  onFirstMessage?: () => void;
  onDiscard?: () => void;
}) {
  const [messages, setMessages]         = useState<Message[]>([]);
  const [input, setInput]               = useState("");
  const [loading, setLoading]           = useState(false);
  const [storyReady, setStoryReady]     = useState(false);
  const [storyParams, setStoryParams]   = useState<Record<string, string> | null>(null);
  const [creating, setCreating]         = useState(false);
  const [createError, setCreateError]   = useState<string | null>(null);
  const [greeted, setGreeted]           = useState(false);
  const [muted, setMuted]               = useState(false);
  const [ttsLoading, setTtsLoading]     = useState(false);
  const [discardConfirm, setDiscardConfirm] = useState(false);
  const bottomRef    = useRef<HTMLDivElement>(null);
  const textareaRef  = useRef<HTMLTextAreaElement>(null);
  const audioRef     = useRef<HTMLAudioElement | null>(null);
  const ttsAbortRef   = useRef<AbortController | null>(null);
  const greetAbortRef = useRef<AbortController | null>(null);
  const firstMsgSent  = useRef(false);

  const speakLuna = useCallback(async (text: string) => {
    if (muted) return;
    ttsAbortRef.current?.abort();
    audioRef.current?.pause();
    audioRef.current = null;

    const ctrl = new AbortController();
    ttsAbortRef.current = ctrl;
    setTtsLoading(true);
    try {
      const res = await fetch("/api/synthesize-speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, characterName: "Narrator", assignedVoiceId: getNarratorVoiceId() }),
        signal: ctrl.signal,
      });
      if (!res.ok) return;
      const { audioData, mimeType } = await res.json() as { audioData: string; mimeType: string };
      if (!audioData || ctrl.signal.aborted) return;
      const audio = new Audio(`data:${mimeType};base64,${audioData}`);
      audioRef.current = audio;
      audio.play().catch(() => {});
    } catch { /* AbortError or network error — silent fail */ }
    finally { if (!ctrl.signal.aborted) setTtsLoading(false); }
  }, [muted]);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, loading, scrollToBottom]);

  // Reset when child changes — also aborts any in-flight greeting
  useEffect(() => {
    greetAbortRef.current?.abort();
    setMessages([]);
    setStoryReady(false);
    setStoryParams(null);
    setGreeted(false);
    firstMsgSent.current = false;
  }, [activeChild?.id]);

  // Greeting — no cleanup abort here (would break React Strict Mode dev double-invoke)
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
        speakLuna(data.reply);
      })
      .catch((err) => {
        if ((err as Error).name === "AbortError") return;
        const fallback = "Hello! 🌙 I'm Luna, your story guide. Tonight we're going to dream up something magical together.\n\nSo — who's going to be the hero of our story?";
        setMessages([{ role: "model", content: fallback }]);
        speakLuna(fallback);
      })
      .finally(() => setLoading(false));
  }, [greeted, activeChild]);

  function getChildAgeGroup() {
    const age = activeChild?.age;
    if (age == null) return undefined;
    return age <= 4 ? "2-4" : age <= 6 ? "4-6" : age <= 8 ? "6-8" : age <= 10 ? "8-10" : "10-12";
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    // Fire onFirstMessage once
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
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      try {
        const res = await fetch("/api/generate-story", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "prompt",
            promptText,
            durationMinutes: 3,
            childAgeGroup: getChildAgeGroup(),
            language: "en",
          }),
        });
        if (!res.ok) throw new Error("Generation failed");
        const data = await res.json() as {
          blocks: ScriptBlock[];
          title?: string;
          summary?: string;
          coverPrompt?: string;
        };
        onScriptReady({
          promptText,
          scriptBlocks: data.blocks ?? [],
          summary: data.summary ?? "",
          coverPrompt: data.coverPrompt ?? "",
          storyTitle: data.title ?? "",
        });
      } catch {
        setMessages((prev) => [...prev, {
          role: "model",
          content: "Couldn't generate the story — please try again or describe it differently.",
        }]);
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
      speakLuna(data.reply);
      if (data.storyReady && data.storyParams) {
        setStoryReady(true);
        setStoryParams(data.storyParams);
      }
    } catch {
      setMessages((prev) => [...prev, {
        role: "model",
        content: "Hmm, something went starry-eyed there 🌙 Could you say that again?",
      }]);
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
    ttsAbortRef.current?.abort();
    audioRef.current?.pause();
    audioRef.current = null;
    setTtsLoading(false);
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
          durationMinutes: 3,
          childAgeGroup: getChildAgeGroup(),
          language: "en",
        }),
      });

      if (!res.ok) throw new Error("Generation failed");
      const data = await res.json() as {
        blocks: ScriptBlock[];
        title?: string;
        summary?: string;
        coverPrompt?: string;
      };

      onScriptReady({
        promptText: [storyParams.hero, storyParams.plot].filter(Boolean).join(" — "),
        scriptBlocks: data.blocks ?? [],
        summary: data.summary ?? "",
        coverPrompt: data.coverPrompt ?? "",
        storyTitle: data.title ?? "",
      });
    } catch {
      setCreateError("Couldn't write the story — please try again.");
      setCreating(false);
    }
  }

  const childEmoji = activeChild?.avatar_emoji;
  const hasUserMessages = messages.some((m) => m.role === "user");

  return (
    <div className="flex flex-col gap-3">

      {/* Luna status strip */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs"
          style={{ background: "linear-gradient(135deg,#1a1a4e,#4fc3f7)", boxShadow: "0 0 10px rgba(79,195,247,0.25)" }}>
          🌙
        </div>
        <span className="text-white/70 text-xs font-semibold">Luna · Story guide</span>
        <span className="w-1.5 h-1.5 rounded-full animate-pulse ml-1" style={{ background: "#10D9A0" }} />
        {ttsLoading && !muted && (
          <span className="flex items-center gap-0.5 ml-1" title="Loading voice…">
            {[0, 1, 2].map((i) => (
              <span key={i} className="w-0.5 rounded-full animate-bounce"
                style={{ height: 8 + i * 3, background: "#4fc3f7", animationDelay: `${i * 0.12}s`, animationDuration: "0.7s", opacity: 0.7 }} />
            ))}
          </span>
        )}
        <button
          onClick={() => { setMuted((m) => { if (!m) { ttsAbortRef.current?.abort(); audioRef.current?.pause(); audioRef.current = null; setTtsLoading(false); } return !m; }); }}
          className="ml-auto w-7 h-7 rounded-lg flex items-center justify-center transition-all active:scale-90"
          style={{ background: muted ? "rgba(255,255,255,0.04)" : "rgba(79,195,247,0.1)", border: muted ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(79,195,247,0.3)" }}
          title={muted ? "Unmute Luna" : "Mute Luna"}
        >
          <span className="text-[11px]">{muted ? "🔇" : "🔊"}</span>
        </button>
      </div>

      {/* Messages */}
      <div className="flex flex-col gap-3">
        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} childEmoji={msg.role === "user" ? childEmoji : undefined} />
        ))}
        {loading && <TypingDots />}
        <div ref={bottomRef} />
      </div>

      {/* Story ready CTA */}
      {storyReady && (
        <div>
          {createError && (
            <p className="text-center text-xs mb-2" style={{ color: "#f87171" }}>{createError}</p>
          )}
          <button
            onClick={handleCreateStory}
            disabled={creating}
            className="w-full py-3.5 rounded-2xl font-bold text-white text-sm transition-all active:scale-[0.98] disabled:opacity-70"
            style={{
              background: "linear-gradient(135deg,#4fc3f7,#8B5CF6)",
              boxShadow: "0 0 24px rgba(79,195,247,0.3)",
            }}
          >
            {creating ? "Writing your story… ✨" : "✨ Create my story"}
          </button>
        </div>
      )}

      {/* Input */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 12 }}>
        <div className="flex items-end gap-2.5 px-3 py-2.5 rounded-2xl"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)" }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Tell Luna about your story…"
            rows={1}
            className="flex-1 bg-transparent text-sm outline-none resize-none leading-relaxed"
            style={{ color: "rgba(255,255,255,0.88)", caretColor: "#4fc3f7", maxHeight: 100 }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-all active:scale-90 disabled:opacity-25"
            style={{
              background: input.trim() && !loading
                ? "linear-gradient(135deg,#4fc3f7,#8B5CF6)"
                : "rgba(255,255,255,0.08)",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13" /><path d="M22 2L15 22l-4-9-9-4 20-7z" />
            </svg>
          </button>
        </div>
        <p className="text-center text-[9px] mt-1.5" style={{ color: "rgba(255,255,255,0.13)" }}>
          Enter to send · Shift+Enter for new line
        </p>
      </div>

      {/* Discard */}
      {hasUserMessages && (
        <div className="flex justify-center pt-1 pb-2">
          {discardConfirm ? (
            <div className="flex items-center gap-3">
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Discard this chat?</span>
              <button
                onClick={handleDiscard}
                className="text-xs px-3 py-1.5 rounded-xl font-semibold transition-all active:scale-95"
                style={{ background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.3)", color: "#f87171" }}
              >
                Yes, discard
              </button>
              <button
                onClick={() => setDiscardConfirm(false)}
                className="text-xs px-3 py-1.5 rounded-xl font-semibold transition-all active:scale-95"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)" }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setDiscardConfirm(true)}
              className="text-[11px] transition-all active:scale-95"
              style={{ color: "rgba(255,255,255,0.2)" }}
            >
              ✕ Discard chat
            </button>
          )}
        </div>
      )}

    </div>
  );
}
