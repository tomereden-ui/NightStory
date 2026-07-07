"use client";

import React, { useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import type { TranslationKey } from "@/lib/i18n";
import Icon from "@/components/ui/Icon";
import type { IconName } from "@/lib/icons";

// ── Mock data — replace with real Supabase queries once story_plays table exists ──

const MOCK_CHILDREN = [
  {
    id: "maya",
    name: "Maya",
    emoji: "🧒",
    streak: 14,
    storiesThisMonth: 12,
    totalMinutes: 84,
    topTheme: "Adventure",
    topThemeCount: 7,
    lessons: [
      { label: "Kindness", count: 4, color: "#f472b6" },
      { label: "Courage", count: 3, color: "#fbbf24" },
      { label: "Friendship", count: 2, color: "#4fc3f7" },
    ],
    // last 28 nights: 0 = quiet night, 1 = cozy listening (passive), 2 = active creation
    calendar: [1,0,2,1,0,1,1,2,0,0,1,1,2,0,1,1,1,2,0,1,2,0,1,1,1,2,1,1],
  },
  {
    id: "lior",
    name: "Lior",
    emoji: "👦",
    streak: 5,
    storiesThisMonth: 6,
    totalMinutes: 42,
    topTheme: "Space",
    topThemeCount: 4,
    lessons: [
      { label: "Courage", count: 3, color: "#fbbf24" },
      { label: "Curiosity", count: 2, color: "#a78bfa" },
    ],
    calendar: [0,0,1,0,0,1,1,0,0,0,1,0,1,0,0,1,1,0,0,1,1,0,0,1,1,2,1,1],
  },
];

// Exported for the home screen snippet
export const MOCK_JOURNEY = MOCK_CHILDREN;

// ── Calendar heatmap ─────────────────────────────────────────────────────────

const GAP = 14;    // px gap between day nodes -- generous breathing room
const NODE = 22;   // px diameter of each day node

// "Twilight Sky" tones, pared back to minimal/high-end: a hollow ring for a
// quiet night, a small solid pastel dot for a passive listening night
// ("Cozy Listening"), and a solid gold dot with a soft diffused glow for a
// night the child actively created a story ("Active Creation").
function cellStyle(count: number): React.CSSProperties {
  if (count === 0) return { background: "transparent", border: "1px solid rgba(255,255,255,0.16)" };
  if (count === 1) return { background: "rgba(165,180,252,0.9)" };
  return { background: "rgba(251,191,36,0.95)", boxShadow: "0 0 12px rgba(251,191,36,0.45)" };
}

function CalendarLegend() {
  const { t } = useLanguage();
  const items: { key: TranslationKey; style: React.CSSProperties }[] = [
    { key: "calNone" as TranslationKey, style: cellStyle(0) },
    { key: "cal1Story" as TranslationKey, style: cellStyle(1) },
    { key: "cal2Plus" as TranslationKey, style: cellStyle(2) },
  ];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
      {items.map(({ key, style }) => (
        <div key={key} style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", ...style }} />
          <span style={{ fontSize: "var(--fs-micro)", color: "rgba(255,255,255,0.3)" }}>{t(key)}</span>
        </div>
      ))}
    </div>
  );
}

function CalendarHeatmap({ days }: { days: number[] }) {
  const DAY_LABELS = ["S","M","T","W","T","F","S"];
  const todayIndex = days.length - 1;
  return (
    <div style={{ width: "100%" }}>
      {/* directional hint: oldest night starts top-left */}
      <p style={{ fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,255,255,0.22)", marginBottom: 4 }}>
        Older
      </p>
      {/* day-of-week labels */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: GAP, marginBottom: 8 }}>
        {DAY_LABELS.map((d, i) => (
          <div key={i} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.4)" }}>{d}</div>
        ))}
      </div>
      {/* nodes -- small, fixed-size circles centered in a responsive, roomy grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: GAP }}>
        {days.map((count, i) => {
          const isToday = i === todayIndex;
          const isCreation = count >= 2;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
              {isToday && (
                <span
                  className="animate-ping"
                  style={{
                    position: "absolute", width: NODE + 8, height: NODE + 8, borderRadius: "50%",
                    border: "1px solid rgba(251,191,36,0.55)",
                  }}
                />
              )}
              <div
                title={isToday ? "Tonight" : isCreation ? "Active Creation" : count === 1 ? "Cozy Listening" : undefined}
                style={{
                  width: NODE, height: NODE, borderRadius: "50%", position: "relative", ...cellStyle(count),
                  ...(isToday ? { boxShadow: "0 0 0 2px rgba(251,191,36,0.7), 0 0 10px rgba(251,191,36,0.45)" } : {}),
                }}
              >
                {/* Sparkle marks an "Active Creation" night -- purely decorative
                    overlay, positioned outside the node's own box so it never
                    grows the node's width/height or the grid's row height. */}
                {isCreation && (
                  <Icon
                    name="sparkles"
                    size={9}
                    strokeWidth={1.2}
                    style={{ position: "absolute", top: -3, right: -3, color: "#fff7d6", filter: "drop-shadow(0 0 2px rgba(251,191,36,0.9))" }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
      {/* directional hint: today's slot lands bottom-right */}
      <p style={{ fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,255,255,0.22)", textAlign: "right", marginTop: 6 }}>
        Today
      </p>
      {/* legend */}
      <CalendarLegend />
    </div>
  );
}

// ── Share Maya's month ─────────────────────────────────────────────────────────
// Compiles the child's monthly summary into a short share line plus a
// generated image card, then hands off to whatever the platform supports —
// native share sheet (with the image attached where possible), or a WhatsApp
// deep link + clipboard copy as a fallback, matching the pattern already
// used for sharing individual stories in ShareSheet.tsx.

function buildMonthShareText(child: typeof MOCK_CHILDREN[0]): string {
  const topThemes = [...child.lessons].sort((a, b) => b.count - a.count).slice(0, 2).map((l) => l.label);
  const themePart = topThemes.length === 2 ? `${topThemes[0]} & ${topThemes[1]}`
    : topThemes.length === 1 ? topThemes[0]
    : child.topTheme;
  return `${child.name} listened to ${child.storiesThisMonth} screen-free bedtime stories this month exploring ${themePart}. 🌙`;
}

async function buildMonthShareImage(child: typeof MOCK_CHILDREN[0], text: string): Promise<Blob | null> {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  const W = 1080, H = 1350;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0d1225");
  bg.addColorStop(1, "#080d1a");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Soft glow accents
  const glow = ctx.createRadialGradient(W * 0.5, H * 0.28, 40, W * 0.5, H * 0.28, 520);
  glow.addColorStop(0, "rgba(167,139,250,0.28)");
  glow.addColorStop(1, "rgba(167,139,250,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = "center";

  // Moon + child initial bubble
  ctx.font = "700 120px system-ui, sans-serif";
  ctx.fillStyle = "#fbbf24";
  ctx.fillText("🌙", W / 2, 300);

  ctx.font = "800 64px system-ui, sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(child.name, W / 2, 430);

  ctx.font = "600 44px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  wrapText(ctx, text.replace(" 🌙", ""), W / 2, 540, 860, 60);

  // Top themes
  const topThemes = [...child.lessons].sort((a, b) => b.count - a.count).slice(0, 2);
  const pillY = 900;
  const pillColors = ["#4fc3f7", "#f472b6"];
  const offsets = topThemes.length > 1 ? [-220, 220] : [0];
  topThemes.forEach((theme, i) => {
    ctx.font = "700 40px system-ui, sans-serif";
    ctx.fillStyle = pillColors[i] ?? theme.color;
    ctx.fillText(theme.label, W / 2 + offsets[i], pillY);
  });

  ctx.font = "700 40px system-ui, sans-serif";
  ctx.fillStyle = "#fbbf24";
  ctx.fillText(`${child.storiesThisMonth} stories · ${child.streak}-night streak`, W / 2, 1020);

  ctx.font = "600 32px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.fillText("NightStory — screen-free bedtime stories", W / 2, H - 80);

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(" ");
  let line = "";
  let cursorY = y;
  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, cursorY);
      line = word;
      cursorY += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line) ctx.fillText(line, x, cursorY);
}

async function shareChildMonth(child: typeof MOCK_CHILDREN[0]): Promise<"shared" | "copied" | "opened-whatsapp"> {
  const text = buildMonthShareText(child);
  const imageBlob = await buildMonthShareImage(child, text).catch(() => null);
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  if (imageBlob && canNativeShare) {
    const file = new File([imageBlob], `${child.name}-month.png`, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title: "NightStory", text, files: [file] });
      return "shared";
    }
  }
  if (canNativeShare) {
    await navigator.share({ title: "NightStory", text });
    return "shared";
  }

  // No native share sheet available — copy the summary and hand off to
  // WhatsApp's own deep link, same fallback used for individual story shares.
  await navigator.clipboard?.writeText(text).catch(() => {});
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  return "opened-whatsapp";
}

// ── Value badges ("Themes & Values Explored") ──────────────────────────────────

const VALUE_BADGE_STYLES: Record<string, { bg: string; border: string; icon: IconName; accent: string }> = {
  Courage:    { bg: "rgba(79,195,247,0.14)",  border: "rgba(79,195,247,0.35)",  icon: "flame",           accent: "#4fc3f7" },
  Bravery:    { bg: "rgba(79,195,247,0.14)",  border: "rgba(79,195,247,0.35)",  icon: "flame",           accent: "#4fc3f7" },
  Friendship: { bg: "rgba(251,191,36,0.14)",  border: "rgba(251,191,36,0.35)",  icon: "friendshipRings", accent: "#fbbf24" },
  Kindness:   { bg: "rgba(167,139,250,0.14)", border: "rgba(167,139,250,0.35)", icon: "heartSparkle",    accent: "#a78bfa" },
};
const DEFAULT_VALUE_BADGE = { bg: "rgba(255,255,255,0.05)", border: "rgba(255,255,255,0.16)", icon: "sparkles" as IconName, accent: "rgba(255,255,255,0.55)" };

function valueBadgeStyle(label: string) {
  return VALUE_BADGE_STYLES[label] ?? DEFAULT_VALUE_BADGE;
}

function ValueBadge({ label, count }: { label: string; count: number }) {
  const { bg, border, icon, accent } = valueBadgeStyle(label);
  return (
    <div className="flex flex-col items-center flex-shrink-0">
      <div style={{ position: "relative" }}>
        <div
          style={{ width: 52, height: 52, borderRadius: 16, background: bg, border: `1px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <Icon name={icon} size={26} strokeWidth={1.4} style={{ color: accent }} />
        </div>
        <span
          className="font-bold"
          style={{
            position: "absolute", top: -6, right: -6,
            fontSize: "var(--fs-micro)", color: "#080d1a", background: accent,
            borderRadius: 999, padding: "1.5px 5px", boxShadow: "0 0 0 2px #0d1225",
            whiteSpace: "nowrap",
          }}
        >
          {count}×
        </span>
      </div>
      <p className="text-fs-body font-semibold text-center" style={{ color: "rgba(255,255,255,0.65)", marginTop: 8, whiteSpace: "nowrap" }}>{label}</p>
    </div>
  );
}

// ── Pillow Talk Starter (mock, based on the month's most-explored value) ──────

const PILLOW_TALK_QUESTIONS: Record<string, string> = {
  Kindness: "What's a small, secret nice thing we can do for someone tomorrow?",
  Courage: "What's one brave thing you did today, even if it felt small?",
  Bravery: "What's one brave thing you did today, even if it felt small?",
  Friendship: "What made you feel like a good friend today?",
  Curiosity: "What's something you wondered about today that you'd love to find the answer to?",
  Adventure: "If we could go on one adventure this weekend, what would it be?",
};
const DEFAULT_PILLOW_TALK_QUESTION = "What part of tonight's story do you think about the most?";

function buildPillowTalkPrompt(child: typeof MOCK_CHILDREN[0]): string {
  const topValue = [...child.lessons].sort((a, b) => b.count - a.count)[0];
  if (!topValue) return DEFAULT_PILLOW_TALK_QUESTION;
  const question = PILLOW_TALK_QUESTIONS[topValue.label] ?? DEFAULT_PILLOW_TALK_QUESTION;
  return `Since ${child.name} explored a lot of ${topValue.label} stories this week, here's a starter for your next walk together: "${question}"`;
}

function PillowTalkCard({ child }: { child: typeof MOCK_CHILDREN[0] }) {
  return (
    <div
      className="rounded-2xl px-4 py-3.5"
      style={{
        background: "rgba(255,255,255,0.04)",
        backdropFilter: "blur(10px)",
        border: "1px solid rgba(167,139,250,0.25)",
        boxShadow: "0 0 22px rgba(79,195,247,0.1), 0 0 36px rgba(167,139,250,0.08)",
      }}
    >
      <p className="text-fs-body font-bold mb-1.5" style={{ color: "#c4b5fd" }}>
        ✨ Tonight&apos;s Pillow Talk Starter
      </p>
      <p className="text-fs-body" style={{ color: "rgba(255,255,255,0.55)", lineHeight: 1.55 }}>
        {buildPillowTalkPrompt(child)}
      </p>
    </div>
  );
}

// ── Single child journey card ─────────────────────────────────────────────────

function ChildJourneyCard({ child }: { child: typeof MOCK_CHILDREN[0] }) {
  const [open, setOpen] = useState(false);
  const [shareState, setShareState] = useState<"idle" | "sharing" | "done">("idle");
  const { t } = useLanguage();
  const hours = Math.floor(child.totalMinutes / 60);
  const mins  = child.totalMinutes % 60;
  const timeLabel = hours > 0 ? `${hours}h ${mins}m` : `${mins} min`;

  return (
    <div
      className="rounded-3xl overflow-hidden mb-3"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      {/* Header — always visible, tap to expand */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 pt-4 pb-3 flex items-center justify-between transition-colors"
        style={{ borderBottom: open ? "1px solid rgba(255,255,255,0.06)" : "none" }}
      >
        <div className="flex items-center gap-2">
          {/* Child initial bubble */}
          <div style={{
            width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
            background: "linear-gradient(135deg,rgba(79,195,247,0.18),rgba(167,139,250,0.22))",
            border: "1px solid rgba(167,139,250,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "var(--fs-body)", fontWeight: 700, color: "#a78bfa",
          }}>
            {child.name.charAt(0).toUpperCase()}
          </div>
          <div className="text-left">
            <p className="text-white text-fs-body font-bold">{child.name}&apos;s {t("storyJourneyTitle" as TranslationKey).replace(" ✨", "")}</p>
            <p className="text-white/30 text-fs-body">{t(open ? ("thisMonthClose" as TranslationKey) : ("thisMonthExpand" as TranslationKey))}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Streak pill */}
          <div
            className="flex items-center gap-1 px-2.5 py-1 rounded-full"
            style={{
              background: "rgba(251,191,36,0.12)",
              border: "1px solid rgba(251,191,36,0.3)",
            }}
          >
            <span className="text-fs-body">🌙</span>
            <span className="text-fs-body font-bold" style={{ color: "#fbbf24" }}>
              {child.streak}
            </span>
          </div>
          {/* Chevron */}
          <span
            className="text-white/25 text-fs-body transition-transform"
            style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", display: "inline-block" }}
          >
            ▾
          </span>
        </div>
      </button>

      {open && <div className="px-4 pt-3 pb-4 flex flex-col gap-4">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: t("statsStories" as TranslationKey), value: child.storiesThisMonth, color: "#4fc3f7" },
            { label: t("statsListened" as TranslationKey), value: timeLabel, color: "#a78bfa" },
            { label: child.topTheme, value: `${child.topThemeCount}×`, color: "#10b981" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl px-2 py-2.5 flex flex-col items-center gap-0.5"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <p className="text-fs-body font-bold" style={{ color: stat.color }}>{stat.value}</p>
              <p className="text-fs-body font-semibold tracking-wide uppercase" style={{ color: "rgba(255,255,255,0.3)" }}>
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        {/* Lessons */}
        <div>
          <p className="text-fs-body font-bold tracking-widest uppercase mb-2" style={{ color: "rgba(255,255,255,0.3)" }}>
            {t("valuesHeard" as TranslationKey)}
          </p>
          <div className="flex overflow-x-auto hide-scrollbar" style={{ gap: 20, paddingTop: 8, paddingBottom: 4 }}>
            {child.lessons.map((l) => (
              <ValueBadge key={l.label} label={l.label} count={l.count} />
            ))}
          </div>
        </div>

        {/* Calendar */}
        <div>
          <p className="text-fs-body font-bold tracking-widest uppercase mb-2" style={{ color: "rgba(255,255,255,0.3)" }}>
            {t("bedtimeRitual" as TranslationKey)}
          </p>
          <CalendarHeatmap days={child.calendar} />
        </div>

        {/* Pillow Talk Starter */}
        <PillowTalkCard child={child} />

        {/* Share CTA */}
        <button
          className="w-full py-2.5 rounded-2xl text-fs-body font-semibold transition-all active:scale-[0.98]"
          style={{
            background: shareState === "done" ? "rgba(79,195,247,0.1)" : "rgba(255,255,255,0.04)",
            border: `1px solid ${shareState === "done" ? "rgba(79,195,247,0.3)" : "rgba(255,255,255,0.09)"}`,
            color: shareState === "done" ? "#4fc3f7" : "rgba(255,255,255,0.4)",
          }}
          disabled={shareState === "sharing"}
          onClick={async () => {
            setShareState("sharing");
            try {
              const outcome = await shareChildMonth(child);
              setShareState("done");
              setTimeout(() => setShareState("idle"), outcome === "opened-whatsapp" ? 3000 : 2000);
            } catch {
              setShareState("idle");
            }
          }}
        >
          {shareState === "sharing" ? "Preparing…" : shareState === "done" ? "✓ Ready to share!" : `Share ${child.name}'s month with family 🌙`}
        </button>
      </div>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function StoryJourney() {
  const [expanded, setExpanded] = useState(true);
  const { t } = useLanguage();

  return (
    <div className="mb-7">
      {/* Section header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between mb-3"
      >
        <div>
          <p className="text-white/55 text-fs-body font-bold tracking-widest uppercase text-left">
            {t("storyJourneyTitle" as TranslationKey)}
          </p>
          <p className="text-white/25 text-fs-body mt-0.5 text-left">{t("monthlyReflection" as TranslationKey)}</p>
          <p className="text-white/18 text-fs-body mt-1 text-left" style={{ lineHeight: 1.5 }}>
            {t("privacyGuardNote" as TranslationKey)}
          </p>
        </div>
        <span
          className="text-white/30 text-fs-body transition-transform"
          style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          ▾
        </span>
      </button>

      {expanded && (
        <div>
          {/* Mock notice */}
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-2xl mb-3"
            style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)" }}
          >
            <span className="text-fs-body">🚧</span>
            <p className="text-fs-body" style={{ color: "rgba(251,191,36,0.7)" }}>
              {t("previewMockData" as TranslationKey)}
            </p>
          </div>

          {MOCK_CHILDREN.map((child) => (
            <ChildJourneyCard key={child.id} child={child} />
          ))}
        </div>
      )}
    </div>
  );
}
