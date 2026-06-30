"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import type { LibraryEntry } from "@/lib/libraryStore";
import type { DBChildProfile } from "@/app/api/child-profiles/route";

interface ShareSheetProps {
  story: LibraryEntry;
  children: DBChildProfile[];
  onClose: () => void;
  onMessageSaved?: (msg: string) => void;
}

function ChildAvatar({ child }: { child: DBChildProfile }) {
  const isUrl = child.avatar_emoji?.startsWith("http");
  return (
    <div
      className="rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
      style={{
        width: 36, height: 36,
        background: "linear-gradient(135deg,#4fc3f7,#f59e0b,#a78bfa)",
        padding: 2,
      }}
    >
      <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center"
        style={{ background: "#0a1628" }}>
        {isUrl
          ? <img src={child.avatar_emoji} alt={child.name} className="w-full h-full object-cover" />
          : <span style={{ fontSize: 18, lineHeight: 1 }}>{child.avatar_emoji || "🧒"}</span>
        }
      </div>
    </div>
  );
}

function ShareSheetInner({ story, children, onClose, onMessageSaved }: ShareSheetProps) {
  const [message, setMessage] = useState(story.shareMessage ?? "");
  const [saving, setSaving]   = useState(false);
  const [copied, setCopied]   = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Trigger slide-in animation
    requestAnimationFrame(() => setMounted(true));
  }, []);

  const assignedChildren = children.filter((c) => story.childIds?.includes(c.id));
  const childNames = assignedChildren.map((c) => c.name);
  const forLabel = childNames.length === 0 ? ""
    : childNames.length === 1 ? childNames[0]
    : childNames.slice(0, -1).join(", ") + " & " + childNames[childNames.length - 1];

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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 flex items-end justify-center"
      style={{ zIndex: 9999, background: mounted ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0)", backdropFilter: "blur(6px)", transition: "background 0.25s ease" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          borderRadius: "24px 24px 0 0",
          background: "linear-gradient(180deg, #0d1225 0%, #080d1a 100%)",
          border: "1px solid rgba(255,255,255,0.09)",
          borderBottom: "none",
          maxHeight: "88vh",
          overflowY: "auto",
          transform: mounted ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.35s cubic-bezier(0.32,0.72,0,1)",
          boxShadow: "0 -8px 48px rgba(0,0,0,0.6), 0 -1px 0 rgba(255,255,255,0.06)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.15)" }} />
        </div>

        <div className="px-5 pt-2 pb-10 flex flex-col gap-4">

          {/* Story preview row */}
          <div
            className="flex items-center gap-3 p-3 rounded-2xl"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            {story.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={story.coverUrl} alt={story.title}
                style={{ width: 52, height: 52, borderRadius: 12, objectFit: "cover", flexShrink: 0, border: "1px solid rgba(255,255,255,0.1)" }} />
            ) : (
              <div style={{ width: 52, height: 52, borderRadius: 12, background: "rgba(79,195,247,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 26 }}>🌙</div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-bold truncate text-white" style={{ fontSize: "var(--fs-body)", marginBottom: 4 }}>{story.title}</p>
              {forLabel && (
                <div className="flex items-center gap-1.5">
                  <div className="flex" style={{ gap: -6 }}>
                    {assignedChildren.slice(0, 3).map((c) => <ChildAvatar key={c.id} child={c} />)}
                  </div>
                  <span style={{ color: "rgba(255,255,255,0.35)", fontSize: "var(--fs-body)" }}>for {forLabel}</span>
                </div>
              )}
            </div>
          </div>

          {/* Message field */}
          <div>
            <p className="mb-2" style={{ color: "rgba(255,255,255,0.4)", fontSize: "var(--fs-body)" }}>
              💌 Personal message
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
                transition: "border-color 0.2s",
              }}
              onFocus={(e) => (e.target.style.borderColor = "rgba(79,195,247,0.4)")}
              onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
            />
            <p style={{ color: "rgba(255,255,255,0.18)", fontSize: "var(--fs-label)", marginTop: 6 }}>
              Shown on the story page for everyone who opens the link
            </p>
          </div>

          {/* URL chip */}
          <div
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
            style={{ background: "rgba(79,195,247,0.05)", border: "1px solid rgba(79,195,247,0.12)" }}
          >
            <span style={{ fontSize: 14, flexShrink: 0 }}>🔗</span>
            <span className="flex-1 truncate" style={{ color: "rgba(255,255,255,0.3)", fontSize: "var(--fs-body)" }}>{storyUrl}</span>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "0 -4px" }} />

          {/* Copy link — primary */}
          <button
            onClick={handleCopyLink}
            disabled={saving}
            className="w-full py-3.5 rounded-2xl font-bold transition-all active:scale-[0.98]"
            style={{
              background: copied
                ? "linear-gradient(135deg, rgba(79,195,247,0.25), rgba(167,139,250,0.25))"
                : "linear-gradient(135deg, rgba(79,195,247,0.15), rgba(167,139,250,0.15))",
              border: `1px solid ${copied ? "rgba(79,195,247,0.55)" : "rgba(79,195,247,0.3)"}`,
              color: "#4fc3f7",
              fontSize: "var(--fs-body)",
              boxShadow: copied ? "0 0 24px rgba(79,195,247,0.2)" : "none",
              transition: "all 0.2s",
            }}
          >
            {copied ? "✓ Link Copied!" : "🔗 Copy Link"}
          </button>

          {/* WhatsApp */}
          <button
            onClick={handleWhatsApp}
            disabled={saving}
            className="w-full py-3.5 rounded-2xl font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            style={{
              background: "rgba(37,211,102,0.08)",
              border: "1px solid rgba(37,211,102,0.25)",
              color: "#25D366",
              fontSize: "var(--fs-body)",
            }}
          >
            <span>💬</span> Share via WhatsApp
          </button>

          {/* Native share */}
          {typeof navigator !== "undefined" && "share" in navigator && (
            <button
              onClick={handleNativeShare}
              className="w-full py-3 rounded-2xl font-semibold transition-all active:scale-[0.98]"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.09)",
                color: "rgba(255,255,255,0.4)",
                fontSize: "var(--fs-body)",
              }}
            >
              More options…
            </button>
          )}

          {/* Cancel */}
          <button
            onClick={onClose}
            className="text-center py-1"
            style={{ color: "rgba(255,255,255,0.2)", fontSize: "var(--fs-body)" }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ShareSheet(props: ShareSheetProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  return createPortal(<ShareSheetInner {...props} />, document.body);
}
