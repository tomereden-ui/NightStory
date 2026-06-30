"use client";

import { useState, useEffect } from "react";
import type { LibraryEntry } from "@/lib/libraryStore";
import type { DBChildProfile } from "@/app/api/child-profiles/route";

interface ShareSheetProps {
  story: LibraryEntry;
  children: DBChildProfile[];
  onClose: () => void;
  onMessageSaved?: (msg: string) => void;
}

function ChildBubble({ child }: { child: DBChildProfile }) {
  const isUrl = child.avatar_emoji?.startsWith("http");
  return (
    <div
      className="rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
      style={{
        width: 40, height: 40,
        background: "linear-gradient(135deg,#4fc3f7,#f59e0b,#a78bfa)",
        padding: 2,
      }}
    >
      <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center"
        style={{ background: "#0a1628" }}>
        {isUrl
          ? <img src={child.avatar_emoji} alt={child.name} className="w-full h-full object-cover" />
          : <span style={{ fontSize: 20, lineHeight: 1 }}>{child.avatar_emoji || "🧒"}</span>
        }
      </div>
    </div>
  );
}

export default function ShareSheet({ story, children, onClose, onMessageSaved }: ShareSheetProps) {
  const [message, setMessage] = useState(story.shareMessage ?? "");
  const [saving, setSaving]   = useState(false);
  const [copied, setCopied]   = useState(false);

  const assignedChildren = children.filter((c) => story.childIds?.includes(c.id));
  const childNames = assignedChildren.map((c) => c.name);
  const forLabel = childNames.length === 0 ? "" : childNames.join(" & ");

  const storyUrl = typeof window !== "undefined"
    ? `${window.location.origin}/story/${story.id}`
    : `/story/${story.id}`;

  const shareText = [
    forLabel ? `🌙 I made a bedtime story for ${forLabel}!` : "🌙 Check out this bedtime story!",
    message.trim() ? message.trim() : null,
    `Listen here: ${storyUrl}`,
  ].filter(Boolean).join(" ");

  const saveMessage = async () => {
    if (message === (story.shareMessage ?? "")) return;
    setSaving(true);
    try {
      await fetch(`/api/library/${story.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareMessage: message.trim() || null }),
      });
      onMessageSaved?.(message.trim());
    } finally {
      setSaving(false);
    }
  };

  const trackShare = (channel: string) => {
    fetch(`/api/story/${story.id}/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel }),
    }).catch(() => {});
  };

  const handleCopyLink = async () => {
    await saveMessage();
    await navigator.clipboard.writeText(storyUrl).catch(() => {});
    trackShare("copy");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = async () => {
    await saveMessage();
    trackShare("whatsapp");
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank");
  };

  const handleNativeShare = async () => {
    await saveMessage();
    if (navigator.share) {
      trackShare("native");
      navigator.share({ title: story.title, text: shareText, url: storyUrl }).catch(() => {});
    }
  };

  // Close on backdrop tap
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 flex flex-col justify-end"
      style={{ zIndex: 100, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full rounded-t-3xl px-5 pt-5 pb-10 flex flex-col gap-4"
        style={{ background: "#0d1120", border: "1px solid rgba(255,255,255,0.08)", borderBottom: "none", maxHeight: "85vh", overflowY: "auto" }}
      >
        {/* Handle */}
        <div className="mx-auto w-10 h-1 rounded-full mb-1" style={{ background: "rgba(255,255,255,0.12)" }} />

        {/* Story preview */}
        <div className="flex items-center gap-3">
          {story.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={story.coverUrl} alt={story.title}
              style={{ width: 56, height: 56, borderRadius: 12, objectFit: "cover", flexShrink: 0 }} />
          ) : (
            <div style={{ width: 56, height: 56, borderRadius: 12, background: "rgba(79,195,247,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontSize: 28 }}>🌙</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold truncate" style={{ fontSize: "var(--fs-body)" }}>{story.title}</p>
            {forLabel && (
              <div className="flex items-center gap-2 mt-1">
                <div className="flex" style={{ gap: -8 }}>
                  {assignedChildren.map((c) => <ChildBubble key={c.id} child={c} />)}
                </div>
                <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "var(--fs-body)" }}>for {forLabel}</span>
              </div>
            )}
          </div>
        </div>

        {/* Message field */}
        <div>
          <p className="mb-2" style={{ color: "rgba(255,255,255,0.35)", fontSize: "var(--fs-body)" }}>
            💌 Add a personal message
          </p>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={`Sweet dreams, ${childNames[0] ?? "little one"}! Made this just for you. Love you! 🌙`}
            rows={3}
            className="w-full rounded-2xl px-4 py-3 text-white resize-none outline-none"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              fontSize: "var(--fs-body)",
              lineHeight: 1.6,
            }}
          />
          <p style={{ color: "rgba(255,255,255,0.18)", fontSize: "var(--fs-label)", marginTop: 6 }}>
            Appears on the story page for everyone who opens the link
          </p>
        </div>

        {/* URL preview */}
        <div
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <span style={{ color: "rgba(79,195,247,0.5)", fontSize: "var(--fs-body)" }}>🔗</span>
          <span className="flex-1 truncate" style={{ color: "rgba(255,255,255,0.35)", fontSize: "var(--fs-body)" }}>{storyUrl}</span>
        </div>

        {/* Share buttons */}
        <button
          onClick={handleCopyLink}
          disabled={saving}
          className="w-full py-3.5 rounded-2xl font-bold transition-all active:scale-[0.98]"
          style={{
            background: copied ? "rgba(79,195,247,0.2)" : "rgba(79,195,247,0.12)",
            border: `1px solid ${copied ? "rgba(79,195,247,0.5)" : "rgba(79,195,247,0.3)"}`,
            color: "#4fc3f7",
            fontSize: "var(--fs-body)",
          }}
        >
          {copied ? "✓ Link copied!" : "Copy Link"}
        </button>

        <button
          onClick={handleWhatsApp}
          disabled={saving}
          className="w-full py-3.5 rounded-2xl font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          style={{
            background: "rgba(37,211,102,0.1)",
            border: "1px solid rgba(37,211,102,0.3)",
            color: "#25D366",
            fontSize: "var(--fs-body)",
          }}
        >
          <span>💬</span> Share via WhatsApp
        </button>

        {typeof navigator !== "undefined" && "share" in navigator && (
          <button
            onClick={handleNativeShare}
            className="w-full py-3.5 rounded-2xl font-bold transition-all active:scale-[0.98]"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.5)",
              fontSize: "var(--fs-body)",
            }}
          >
            More options…
          </button>
        )}

        <button onClick={onClose} className="text-center py-2" style={{ color: "rgba(255,255,255,0.2)", fontSize: "var(--fs-body)" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}
