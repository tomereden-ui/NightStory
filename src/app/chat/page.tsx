"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import ChildProfilePicker, { type DBChildProfile } from "@/components/studio/ChildProfilePicker";

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
        className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0"
        style={{ background: "linear-gradient(135deg, #1a1a4e, #4fc3f7)" }}
      >
        🌙
      </div>
      <div
        className="px-4 py-3.5 rounded-2xl rounded-bl-md flex items-center gap-1.5"
        style={{
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.09)",
        }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full animate-bounce"
            style={{
              background: "#4fc3f7",
              animationDelay: `${i * 0.18}s`,
              animationDuration: "0.9s",
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: Message }) {
  const isLuna = msg.role === "model";

  return (
    <div className={`flex gap-2.5 items-end ${isLuna ? "justify-start" : "justify-end"}`}>
      {isLuna && (
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #1a1a4e, #4fc3f7)" }}
        >
          🌙
        </div>
      )}

      <div
        className="max-w-[78%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap"
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

// ─── Chat page ────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [storyReady, setStoryReady] = useState(false);
  const [storyParams, setStoryParams] = useState<Record<string, string> | null>(null);
  const [greeted, setGreeted] = useState(false);
  const [activeChild, setActiveChild] = useState<DBChildProfile | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, loading, scrollToBottom]);

  // Fetch initial greeting on mount
  useEffect(() => {
    if (greeted) return;
    setGreeted(true);
    setLoading(true);

    fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [], childProfile: activeChild }),
    })
      .then((r) => r.json())
      .then((data: ChatResponse) => {
        setMessages([{ role: "model", content: data.reply }]);
      })
      .catch(() => {
        setMessages([{
          role: "model",
          content: "Hello! 🌙 I'm Luna, your story guide. Tonight we're going to dream up something magical together.\n\nSo — who's going to be the hero of our story?",
        }]);
      })
      .finally(() => setLoading(false));
  }, [greeted]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    const next: Message[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);

    // Auto-resize textarea back to 1 row
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, childProfile: activeChild }),
      });
      const data: ChatResponse = await res.json();
      setMessages((prev) => [...prev, { role: "model", content: data.reply }]);
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
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  }

  function handleCreateStory() {
    if (!storyParams) return;
    const qs = new URLSearchParams(storyParams).toString();
    router.push(`/studio${qs ? `?${qs}` : ""}`);
  }

  return (
    <div className="flex flex-col h-full" style={{ background: "transparent" }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 flex items-center gap-3 px-5 pt-10 pb-4"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0"
          style={{
            background: "linear-gradient(135deg, #1a1a4e, #4fc3f7)",
            boxShadow: "0 0 16px rgba(79,195,247,0.25)",
          }}
        >
          🌙
        </div>
        <div>
          <h1 className="text-white font-bold text-base leading-none">Luna</h1>
          <p className="text-white/30 text-xs mt-0.5">Your story guide</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ background: "#10D9A0" }}
          />
          <span className="text-[10px] font-medium" style={{ color: "#10D9A0" }}>Online</span>
        </div>
      </div>

      {/* ── Child profile picker ────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-5 pt-3 pb-1">
        <ChildProfilePicker selected={activeChild} onChange={setActiveChild} />
      </div>

      {/* ── Messages ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-4">
        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} />
        ))}

        {loading && <TypingDots />}
        <div ref={bottomRef} />
      </div>

      {/* ── Story ready CTA ─────────────────────────────────────────────── */}
      {storyReady && (
        <div className="flex-shrink-0 px-4 pb-3">
          <button
            onClick={handleCreateStory}
            className="w-full py-4 rounded-2xl font-bold text-white text-sm transition-all active:scale-[0.98]"
            style={{
              background: "linear-gradient(135deg, #4fc3f7, #8B5CF6)",
              boxShadow: "0 0 32px rgba(79,195,247,0.35), 0 0 8px rgba(139,92,246,0.2)",
            }}
          >
            ✨ Create my story
          </button>
        </div>
      )}

      {/* ── Input ───────────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 px-4 pt-2 pb-6"
        style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div
          className="flex items-end gap-3 px-4 py-3 rounded-2xl"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Tell Luna about your story…"
            rows={1}
            className="flex-1 bg-transparent text-white text-sm outline-none resize-none leading-relaxed"
            style={{
              color: "rgba(255,255,255,0.88)",
              caretColor: "#4fc3f7",
              maxHeight: 120,
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all active:scale-90 disabled:opacity-25"
            style={{
              background: input.trim() && !loading
                ? "linear-gradient(135deg, #4fc3f7, #8B5CF6)"
                : "rgba(255,255,255,0.08)",
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13" />
              <path d="M22 2L15 22l-4-9-9-4 20-7z" />
            </svg>
          </button>
        </div>
        <p className="text-center text-[10px] mt-2" style={{ color: "rgba(255,255,255,0.15)" }}>
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
