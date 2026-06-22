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

function MessageBubble({ msg }: { msg: Message }) {
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
    </div>
  );
}

// ─── Luna chat panel ──────────────────────────────────────────────────────────

export default function LunaChatPanel({
  activeChild,
  onScriptReady,
}: {
  activeChild: DBChildProfile | null;
  onScriptReady: (draft: Omit<DraftState, "coverUrl">) => void;
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
  const bottomRef   = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const audioRef    = useRef<HTMLAudioElement | null>(null);

  const speakLuna = useCallback(async (text: string) => {
    if (muted) return;
    audioRef.current?.pause();
    audioRef.current = null;
    try {
      const res = await fetch("/api/synthesize-speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, characterName: "Narrator", assignedVoiceId: getNarratorVoiceId() }),
      });
      if (!res.ok) return;
      const { audioData, mimeType } = await res.json() as { audioData: string; mimeType: string };
      if (!audioData) return;
      const audio = new Audio(`data:${mimeType};base64,${audioData}`);
      audioRef.current = audio;
      audio.play().catch(() => {});
    } catch { /* silent fail — TTS is best-effort */ }
  }, [muted]);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, loading, scrollToBottom]);

  // Fetch greeting on first render (reset when child changes)
  useEffect(() => {
    setMessages([]);
    setStoryReady(false);
    setStoryParams(null);
    setGreeted(false);
  }, [activeChild?.id]);

  useEffect(() => {
    if (greeted) return;
    setGreeted(true);
    setLoading(true);

    fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [], childProfile: activeChild }),
    })
      .then(async (r) => {
        const data: ChatResponse = await r.json();
        if (!r.ok || !data.reply) throw new Error("no reply");
        setMessages([{ role: "model", content: data.reply }]);
        speakLuna(data.reply);
      })
      .catch(() => {
        const fallback = "Hello! 🌙 I'm Luna, your story guide. Tonight we're going to dream up something magical together.\n\nSo — who's going to be the hero of our story?";
        setMessages([{ role: "model", content: fallback }]);
        speakLuna(fallback);
      })
      .finally(() => setLoading(false));
  }, [greeted, activeChild]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

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

  async function handleCreateStory() {
    if (!storyParams || creating) return;
    setCreating(true);
    setCreateError(null);

    const age = activeChild?.age;
    const childAgeGroup = age == null ? undefined
      : age <= 4 ? "2-4" : age <= 6 ? "4-6" : age <= 8 ? "6-8" : age <= 10 ? "8-10" : "10-12";

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
          childAgeGroup,
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

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 280px)", minHeight: 360 }}>

      {/* Luna status strip */}
      <div className="flex items-center gap-2 mb-3 flex-shrink-0">
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs"
          style={{ background: "linear-gradient(135deg,#1a1a4e,#4fc3f7)", boxShadow: "0 0 10px rgba(79,195,247,0.25)" }}>
          🌙
        </div>
        <span className="text-white/70 text-xs font-semibold">Luna · Story guide</span>
        <span className="w-1.5 h-1.5 rounded-full animate-pulse ml-1" style={{ background: "#10D9A0" }} />
        <button
          onClick={() => { setMuted((m) => { if (!m) { audioRef.current?.pause(); audioRef.current = null; } return !m; }); }}
          className="ml-auto w-7 h-7 rounded-lg flex items-center justify-center transition-all active:scale-90"
          style={{ background: muted ? "rgba(255,255,255,0.04)" : "rgba(79,195,247,0.1)", border: muted ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(79,195,247,0.3)" }}
          title={muted ? "Unmute Luna" : "Mute Luna"}
        >
          <span className="text-[11px]">{muted ? "🔇" : "🔊"}</span>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1">
        {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}
        {loading && <TypingDots />}
        <div ref={bottomRef} />
      </div>

      {/* Story ready CTA */}
      {storyReady && (
        <div className="flex-shrink-0 pt-3">
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
      <div className="flex-shrink-0 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
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
    </div>
  );
}
