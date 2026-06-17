"use client";

import { useState, useEffect, useRef } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { useViewMode, type ViewMode } from "@/context/ViewModeContext";
import LanguageToggle from "@/components/ui/LanguageToggle";
import { MOCK_USER } from "@/lib/mockData";

// ─── Illustrated card (same pattern as 5-question flow) ──────────────────────

function IllustratedCard({
  label, emoji, imageUrl, selected, onClick, dim,
}: {
  label: string; emoji: string; imageUrl?: string;
  selected?: boolean; onClick?: () => void; dim?: boolean;
}) {
  const [imgLoaded, setImgLoaded] = useState(false);

  return (
    <button
      onClick={onClick}
      className="relative overflow-hidden rounded-2xl transition-transform active:scale-[0.97]"
      style={{ aspectRatio: "4/3", cursor: onClick ? "pointer" : "default", opacity: dim ? 0.45 : 1 }}
    >
      {imageUrl && (
        <img
          src={imageUrl} alt={label}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ opacity: imgLoaded ? 1 : 0, transition: "opacity 0.5s ease" }}
          onLoad={() => setImgLoaded(true)}
        />
      )}
      {/* Gradient placeholder */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          background: "radial-gradient(ellipse at 40% 30%, rgba(79,195,247,0.2), rgba(10,12,24,0.95))",
          opacity: imgLoaded ? 0 : 1,
          transition: "opacity 0.4s ease",
          pointerEvents: "none",
        }}
      >
        <span className="text-4xl" style={{ filter: "drop-shadow(0 0 14px rgba(79,195,247,0.7))" }}>{emoji}</span>
      </div>
      {/* Cinematic overlay */}
      <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.15) 55%, rgba(0,0,0,0.05) 100%)" }} />
      {/* Selection ring */}
      <div
        className="absolute inset-0 rounded-2xl transition-all duration-200"
        style={selected
          ? { border: "2px solid #4fc3f7", boxShadow: "inset 0 0 20px rgba(79,195,247,0.25), 0 0 16px rgba(79,195,247,0.35)" }
          : { border: "1px solid rgba(255,255,255,0.1)" }}
      />
      {/* Label */}
      <div className="absolute bottom-0 left-0 right-0 px-2 pb-2.5 text-center">
        <span
          className="text-[11px] font-semibold leading-tight"
          style={{
            color: selected ? "#4fc3f7" : "rgba(255,255,255,0.92)",
            textShadow: "0 1px 8px rgba(0,0,0,1)",
            display: "block",
          }}
        >
          {label}
        </span>
      </div>
    </button>
  );
}

// ─── Child profile card ────────────────────────────────────────────────────────

const CHILD_PALETTES: [string, string][] = [
  ["#4fc3f7", "#7c3aed"],
  ["#f59e0b", "#ec4899"],
  ["#10b981", "#4fc3f7"],
  ["#a78bfa", "#f472b6"],
];

function ChildCard({ name, emoji, ageGroup }: { name: string; emoji: string; ageGroup: string }) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const [c1, c2] = CHILD_PALETTES[h % CHILD_PALETTES.length];

  return (
    <div
      className="relative overflow-hidden rounded-2xl p-4 flex flex-col items-center gap-2"
      style={{ background: `linear-gradient(145deg, ${c1}18, ${c2}25)`, border: `1px solid ${c1}33` }}
    >
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center text-3xl"
        style={{
          background: `linear-gradient(145deg, ${c1}22, ${c2}33)`,
          border: `2px solid ${c1}55`,
          boxShadow: `0 0 20px ${c1}33`,
        }}
      >
        {emoji}
      </div>
      <span className="text-white text-sm font-semibold">{name}</span>
      <span
        className="text-[10px] px-2.5 py-0.5 rounded-full font-bold tracking-widest uppercase"
        style={{ background: `${c1}18`, border: `1px solid ${c1}44`, color: c1 }}
      >
        {ageGroup} yrs
      </span>
    </div>
  );
}

// ─── Settings row ─────────────────────────────────────────────────────────────

function SettingCard({
  label, imageUrl, emoji, value,
}: {
  label: string; imageUrl?: string; emoji: string; value?: string;
}) {
  const [imgLoaded, setImgLoaded] = useState(false);

  return (
    <div
      className="relative overflow-hidden rounded-2xl flex items-center gap-0"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      {/* Left image panel */}
      <div className="w-16 flex-shrink-0 self-stretch relative overflow-hidden" style={{ minHeight: 56 }}>
        {imageUrl && (
          <img
            src={imageUrl} alt={label}
            className="absolute inset-0 w-full h-full object-cover"
            style={{ opacity: imgLoaded ? 1 : 0, transition: "opacity 0.5s" }}
            onLoad={() => setImgLoaded(true)}
          />
        )}
        {(!imageUrl || !imgLoaded) && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: "radial-gradient(ellipse at 40% 40%, rgba(79,195,247,0.2), rgba(10,12,24,0.95))" }}
          >
            <span className="text-2xl" style={{ filter: "drop-shadow(0 0 10px rgba(79,195,247,0.6))" }}>{emoji}</span>
          </div>
        )}
        <div className="absolute inset-y-0 right-0 w-6" style={{ background: "linear-gradient(to right, transparent, rgba(10,12,24,0.92))" }} />
      </div>

      <div className="flex-1 px-3 py-3.5">
        <p className="text-white/80 text-sm font-medium">{label}</p>
      </div>

      {value && (
        <span className="text-white/30 text-xs pr-3 flex-shrink-0">{value}</span>
      )}
      <span className="text-white/15 text-sm pr-3 flex-shrink-0">›</span>
    </div>
  );
}

// ─── Profile page ─────────────────────────────────────────────────────────────

const VIEW_MODES: { mode: ViewMode; label: string; emoji: string; key: string }[] = [
  { mode: "auto",    label: "Auto",    emoji: "✦",  key: "profile-mode-auto" },
  { mode: "mobile",  label: "Mobile",  emoji: "📱", key: "profile-mode-mobile" },
  { mode: "tablet",  label: "Tablet",  emoji: "📲", key: "profile-mode-tablet" },
  { mode: "desktop", label: "Desktop", emoji: "🖥️", key: "profile-mode-desktop" },
];

const SETTINGS = [
  { id: "notifications", label: "Notifications", emoji: "🔔", key: "profile-setting-notifications", value: "On" },
  { id: "nightmode",     label: "Night mode",     emoji: "🌙", key: "profile-setting-nightmode",     value: "Always" },
  { id: "volume",        label: "Volume",          emoji: "🔊", key: "profile-setting-volume",        value: "80%" },
];

export default function ProfilePage() {
  const { t, isRTL } = useLanguage();
  const { mode, setMode } = useViewMode();
  const user = MOCK_USER;
  const [profileImages, setProfileImages] = useState<Record<string, string>>({});

  // Browser-side seeder — reuses the same seed-create-images API
  useEffect(() => {
    let cancelled = false;
    async function seedImages() {
      try {
        const res = await fetch("/api/admin/seed-create-images");
        if (!res.ok) return;
        const { missing, existingImageUrls } = await res.json() as {
          missing: { key: string; prompt: string }[];
          existingImageUrls: Record<string, string>;
        };

        // Load any already-cached profile images
        const profKeys = new Set([
          ...VIEW_MODES.map((m) => m.key),
          ...SETTINGS.map((s) => s.key),
        ]);
        const cached: Record<string, string> = {};
        for (const [k, v] of Object.entries(existingImageUrls)) {
          if (profKeys.has(k)) cached[k] = v as string;
        }
        if (Object.keys(cached).length) setProfileImages((prev) => ({ ...prev, ...cached }));

        // Generate missing profile images
        const missingProf = (missing ?? []).filter(({ key }: { key: string }) => profKeys.has(key));
        for (const { key, prompt } of missingProf as { key: string; prompt: string }[]) {
          if (cancelled) return;
          try {
            const encoded = encodeURIComponent(prompt.slice(0, 1500));
            const seed = Math.floor(Math.random() * 999999);
            const url = `https://image.pollinations.ai/prompt/${encoded}?model=flux&width=512&height=384&seed=${seed}`;
            const imgRes = await fetch(url);
            if (!imgRes.ok || !imgRes.headers.get("content-type")?.startsWith("image/")) continue;
            if (cancelled) return;
            const blob = await imgRes.blob();
            const cacheRes = await fetch(`/api/admin/seed-create-images?key=${encodeURIComponent(`${key}.jpg`)}`, {
              method: "POST", body: blob, headers: { "Content-Type": blob.type },
            });
            if (cacheRes.ok) {
              const { imageKey, url: cachedUrl } = await cacheRes.json() as { imageKey: string; url: string };
              if (imageKey && cachedUrl) setProfileImages((prev) => ({ ...prev, [imageKey]: cachedUrl }));
            }
          } catch {
            // ignore individual failures
          }
        }
      } catch {
        // ignore
      }
    }
    seedImages();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-full" style={{ background: "transparent" }} dir={isRTL ? "rtl" : "ltr"}>
      <div className="px-5 pt-12 pb-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-base font-semibold text-white tracking-wide">{t("profile")}</h1>
          <LanguageToggle />
        </div>

        {/* ── Child profiles ─────────────────────────────────────────── */}
        <div className="mb-7">
          <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>
            {t("childProfiles")}
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {user.childProfiles.map((child) => (
              <ChildCard key={child.id} name={child.name} emoji={child.avatarEmoji} ageGroup={child.ageGroup} />
            ))}
            {/* Add child slot */}
            <button
              className="relative overflow-hidden rounded-2xl flex flex-col items-center justify-center gap-2 transition-all active:scale-[0.97]"
              style={{
                aspectRatio: "unset",
                minHeight: 120,
                background: "rgba(255,255,255,0.03)",
                border: "1.5px dashed rgba(255,255,255,0.12)",
              }}
            >
              <span className="text-2xl" style={{ color: "rgba(255,255,255,0.2)" }}>＋</span>
              <span className="text-[11px] font-medium" style={{ color: "rgba(255,255,255,0.25)" }}>Add child</span>
            </button>
          </div>
        </div>

        {/* ── Display modes ──────────────────────────────────────────── */}
        <div className="mb-7">
          <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>
            Display
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {VIEW_MODES.map((opt) => (
              <IllustratedCard
                key={opt.mode}
                label={opt.label}
                emoji={opt.emoji}
                imageUrl={profileImages[opt.key]}
                selected={mode === opt.mode}
                onClick={() => setMode(opt.mode)}
              />
            ))}
          </div>
          <p className="text-white/20 text-[10px] mt-2 leading-relaxed">
            Forces the layout to a specific screen size regardless of your device.
          </p>
        </div>

        {/* ── Settings ───────────────────────────────────────────────── */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>
            {t("settings")}
          </p>
          <div className="flex flex-col gap-2">
            {SETTINGS.map((s) => (
              <SettingCard
                key={s.id}
                label={s.label}
                emoji={s.emoji}
                imageUrl={profileImages[s.key]}
                value={s.value}
              />
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
