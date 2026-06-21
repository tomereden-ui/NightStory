"use client";

import { useState, useEffect } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { useViewMode, type ViewMode } from "@/context/ViewModeContext";
import LanguageToggle from "@/components/ui/LanguageToggle";
import { MOCK_USER } from "@/lib/mockData";
import type { UsageTotals } from "@/lib/usageTracker";

// ─── SVG icon helper ──────────────────────────────────────────────────────────

function Ico({ d, size = 15 }: { d: string; size?: number }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 16 16"
      fill="none" stroke="currentColor"
      strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}

// ─── Child profile card ────────────────────────────────────────────────────────

const CHILD_PALETTES: [string, string][] = [
  ["#4fc3f7", "#7c3aed"],
  ["#f59e0b", "#ec4899"],
  ["#10b981", "#4fc3f7"],
  ["#a78bfa", "#f472b6"],
];

function childInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts.length === 1
    ? parts[0].charAt(0).toUpperCase()
    : (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function ChildCard({ name, ageGroup }: { name: string; ageGroup: string }) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const [c1, c2] = CHILD_PALETTES[h % CHILD_PALETTES.length];

  return (
    <div
      className="relative overflow-hidden rounded-2xl p-4 flex flex-col items-center gap-2.5"
      style={{
        background: `linear-gradient(145deg, ${c1}10, ${c2}18)`,
        border: `1px solid ${c1}25`,
      }}
    >
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-xl"
        style={{
          background: `linear-gradient(135deg, ${c1}30, ${c2}50)`,
          border: `1.5px solid ${c1}50`,
          color: "rgba(255,255,255,0.92)",
          textShadow: "0 1px 4px rgba(0,0,0,0.5)",
          letterSpacing: "0.02em",
        }}
      >
        {childInitials(name)}
      </div>
      <span className="text-white text-sm font-semibold">{name}</span>
      <span
        className="text-[10px] px-2.5 py-0.5 rounded-full font-bold tracking-widest uppercase"
        style={{ background: `${c1}14`, border: `1px solid ${c1}30`, color: c1 }}
      >
        {ageGroup} yrs
      </span>
    </div>
  );
}

// ─── View mode button ─────────────────────────────────────────────────────────

const D_AUTO    = "M8 1.5l1.2 3.7 3.9.6-2.8 2.7.7 3.9L8 10.6l-3 1.8.7-3.9L3 5.8l3.9-.6z";
const D_MOBILE  = "M5 1h6a1 1 0 011 1v12a1 1 0 01-1 1H5a1 1 0 01-1-1V2a1 1 0 011-1zM7.5 13h1";
const D_TABLET  = "M3 1h10a1 1 0 011 1v12a1 1 0 01-1 1H3a1 1 0 01-1-1V2a1 1 0 011-1zM7 13.5h2";
const D_DESKTOP = "M1 2h14a1 1 0 011 1v9a1 1 0 01-1 1H1a1 1 0 01-1-1V3a1 1 0 011-1zM5 15h6M8 13v2";

const VIEW_MODES: { mode: ViewMode; label: string; iconD: string }[] = [
  { mode: "auto",    label: "Auto",    iconD: D_AUTO    },
  { mode: "mobile",  label: "Mobile",  iconD: D_MOBILE  },
  { mode: "tablet",  label: "Tablet",  iconD: D_TABLET  },
  { mode: "desktop", label: "Desktop", iconD: D_DESKTOP },
];

function ViewModeBtn({
  label, iconD, selected, onClick,
}: { label: string; iconD: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2.5 py-4 rounded-2xl transition-all active:scale-[0.97]"
      style={{
        background: selected ? "rgba(79,195,247,0.07)" : "rgba(255,255,255,0.03)",
        border: selected ? "1.5px solid rgba(79,195,247,0.35)" : "1px solid rgba(255,255,255,0.07)",
        boxShadow: selected ? "0 0 20px rgba(79,195,247,0.1)" : "none",
      }}
    >
      <span style={{ color: selected ? "#4fc3f7" : "rgba(255,255,255,0.3)" }}>
        <Ico d={iconD} size={22} />
      </span>
      <span
        className="text-[11px] font-semibold"
        style={{ color: selected ? "#4fc3f7" : "rgba(255,255,255,0.35)" }}
      >
        {label}
      </span>
    </button>
  );
}

// ─── Setting row ──────────────────────────────────────────────────────────────

const D_BELL   = "M8 1v1M8 2a5 5 0 015 5v3l1.5 2h-13L3 10V7A5 5 0 018 2zM6 14a2 2 0 004 0";
const D_MOON   = "M12.5 9A5.5 5.5 0 116 3.5a4 4 0 006.5 5.5z";
const D_VOLUME = "M5 6H2v4h3l4 4V2L5 6zM10 5.5a4 4 0 010 5M12.5 3a7.5 7.5 0 010 10";

const SETTINGS = [
  { id: "notifications", label: "Notifications", iconD: D_BELL,   accent: "#4fc3f7", value: "On"     },
  { id: "nightmode",     label: "Night mode",     iconD: D_MOON,   accent: "#8B5CF6", value: "Always" },
  { id: "volume",        label: "Volume",          iconD: D_VOLUME, accent: "#10D9A0", value: "80%"   },
];

function SettingRow({
  label, iconD, accent, value,
}: { label: string; iconD: string; accent: string; value?: string }) {
  return (
    <div
      className="flex items-center gap-3.5 px-4 py-3.5 rounded-2xl transition-all"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${accent}18`, border: `1px solid ${accent}28`, color: accent }}
      >
        <Ico d={iconD} size={15} />
      </div>
      <span className="flex-1 text-white/80 text-sm font-medium">{label}</span>
      {value && <span className="text-white/30 text-xs">{value}</span>}
      <span className="text-white/15 text-base ml-1">›</span>
    </div>
  );
}

// ─── API usage row ────────────────────────────────────────────────────────────

const D_SPARKLE  = "M8 1.5l1.2 3.7 3.9.6-2.8 2.7.7 3.9L8 10.6l-3 1.8.7-3.9L3 5.8l3.9-.6z";
const D_WAVEFORM = "M1 8h1.5M3.5 5v6M6 3v10M8.5 5.5v5M11 4v8M13.5 6v4M15 8h0.5";
const D_MUSIC    = "M9 13V4l5-1.5v9.5M4 14a2 2 0 100-4 2 2 0 000 4zM14 12.5a2 2 0 100-4 2 2 0 000 4z";
const D_MIC      = "M8 1a3 3 0 013 3v4a3 3 0 01-6 0V4a3 3 0 013-3zM3 7a5 5 0 0010 0M8 14v1M5 15h6";

function UsageRow({
  iconD, accent, label, sub, value, unit, cost,
}: {
  iconD: string; accent: string; label: string; sub: string;
  value: string; unit: string; cost?: string;
}) {
  return (
    <div
      className="flex items-center gap-3.5 px-4 py-3.5 rounded-2xl"
      style={{ background: `${accent}08`, border: `1px solid ${accent}18` }}
    >
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${accent}15`, border: `1px solid ${accent}28`, color: accent }}
      >
        <Ico d={iconD} size={15} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white/80 text-xs font-semibold">{label}</p>
        <p className="text-white/30 text-[10px] mt-0.5">{sub}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-bold" style={{ color: accent }}>{value}</p>
        <p className="text-[9px] text-white/25 mt-0.5">{unit}</p>
        {cost && <p className="text-[9px] mt-0.5 font-semibold" style={{ color: `${accent}99` }}>~{cost}</p>}
      </div>
    </div>
  );
}

// ─── Cost estimator ───────────────────────────────────────────────────────────

function estimateCosts(u: UsageTotals) {
  // Gemini 2.5 Flash: blended ~$0.15/1M tokens (input ~$0.075 + output ~$0.30, roughly half-half)
  const geminiText = (u.gemini_tokens / 1_000_000) * 0.15;
  // Gemini TTS: ~$0.05/1K chars (preview rate, approximate)
  const geminiTts  = (u.gemini_tts_chars / 1_000) * 0.05;
  // ElevenLabs TTS: ~$0.30/1K chars
  const elTts      = (u.el_tts_chars / 1_000) * 0.30;
  // ElevenLabs SFX: ~$0.08/1K chars
  const elSfx      = (u.el_sfx_chars / 1_000) * 0.08;
  const total      = geminiText + geminiTts + elTts + elSfx;
  const fmtCost    = (n: number) => n < 0.01 ? "<$0.01" : `$${n.toFixed(2)}`;
  return { geminiText: fmtCost(geminiText), geminiTts: fmtCost(geminiTts), elTts: fmtCost(elTts), elSfx: fmtCost(elSfx), total: fmtCost(total) };
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.28)" }}>
      {label}
    </p>
  );
}

// ─── Number formatter ─────────────────────────────────────────────────────────

function fmt(n: number) {
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K`
    : String(n);
}

// ─── Profile page ─────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { t, isRTL } = useLanguage();
  const { mode, setMode } = useViewMode();
  const user = MOCK_USER;
  const [usage, setUsage] = useState<UsageTotals | null>(null);

  useEffect(() => {
    fetch("/api/usage", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => setUsage(data as UsageTotals))
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-full" style={{ background: "transparent" }} dir={isRTL ? "rtl" : "ltr"}>
      <div className="px-5 pt-12 pb-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-base font-semibold text-white tracking-wide mb-0.5">{t("profile")}</h1>
            <p className="text-white/30 text-xs">Manage your account & preferences</p>
          </div>
          <LanguageToggle />
        </div>

        {/* ── Child profiles ──────────────────────────────────────── */}
        <div className="mb-7">
          <SectionHeader label={t("childProfiles")} />
          <div className="grid grid-cols-2 gap-2.5">
            {user.childProfiles.map((child) => (
              <ChildCard key={child.id} name={child.name} ageGroup={child.ageGroup} />
            ))}
            <button
              className="rounded-2xl flex flex-col items-center justify-center gap-2 transition-all active:scale-[0.97]"
              style={{
                minHeight: 130,
                background: "rgba(255,255,255,0.02)",
                border: "1.5px dashed rgba(255,255,255,0.1)",
              }}
            >
              <span className="text-xl font-light" style={{ color: "rgba(255,255,255,0.18)" }}>＋</span>
              <span className="text-[11px] font-medium" style={{ color: "rgba(255,255,255,0.22)" }}>Add child</span>
            </button>
          </div>
        </div>

        {/* ── Display mode ─────────────────────────────────────────── */}
        <div className="mb-7">
          <SectionHeader label="Display" />
          <div className="grid grid-cols-4 gap-2">
            {VIEW_MODES.map((opt) => (
              <ViewModeBtn
                key={opt.mode}
                label={opt.label}
                iconD={opt.iconD}
                selected={mode === opt.mode}
                onClick={() => setMode(opt.mode)}
              />
            ))}
          </div>
          <p className="text-white/18 text-[10px] mt-2 leading-relaxed">
            Forces the layout to a specific screen size regardless of your device.
          </p>
        </div>

        {/* ── Settings ─────────────────────────────────────────────── */}
        <div className="mb-7">
          <SectionHeader label={t("settings")} />
          <div className="flex flex-col gap-2">
            {SETTINGS.map((s) => (
              <SettingRow
                key={s.id}
                label={s.label}
                iconD={s.iconD}
                accent={s.accent}
                value={s.value}
              />
            ))}
          </div>
        </div>

        {/* ── API Usage ─────────────────────────────────────────────── */}
        <div>
          <SectionHeader label="API Usage" />

          {/* Estimated total cost banner */}
          {usage && (() => {
            const costs = estimateCosts(usage);
            return (
              <div
                className="mb-3 px-4 py-3 rounded-2xl flex items-center justify-between"
                style={{ background: "rgba(79,195,247,0.05)", border: "1px solid rgba(79,195,247,0.15)" }}
              >
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(79,195,247,0.5)" }}>Estimated spend</p>
                  <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.2)" }}>Rough estimate · verify in each provider dashboard</p>
                </div>
                <p className="text-xl font-bold" style={{ color: "#4fc3f7" }}>{costs.total}</p>
              </div>
            );
          })()}

          <div className="flex flex-col gap-2">
            <UsageRow
              iconD={D_SPARKLE}
              accent="#4fc3f7"
              label="Gemini · Text"
              sub={usage ? `${fmt(usage.gemini_calls)} request${usage.gemini_calls !== 1 ? "s" : ""}` : "—"}
              value={usage ? fmt(usage.gemini_tokens) : "—"}
              unit="tokens"
              cost={usage ? estimateCosts(usage).geminiText : undefined}
            />
            <UsageRow
              iconD={D_MIC}
              accent="#38bdf8"
              label="Gemini · TTS"
              sub={usage ? `${fmt(usage.gemini_tts_calls)} synthesis call${usage.gemini_tts_calls !== 1 ? "s" : ""}` : "—"}
              value={usage ? fmt(usage.gemini_tts_chars) : "—"}
              unit="chars"
              cost={usage ? estimateCosts(usage).geminiTts : undefined}
            />
            <UsageRow
              iconD={D_WAVEFORM}
              accent="#F59E0B"
              label="ElevenLabs · TTS"
              sub={usage ? `${fmt(usage.el_tts_calls)} synthesis call${usage.el_tts_calls !== 1 ? "s" : ""}` : "—"}
              value={usage ? fmt(usage.el_tts_chars) : "—"}
              unit="chars"
              cost={usage ? estimateCosts(usage).elTts : undefined}
            />
            <UsageRow
              iconD={D_MUSIC}
              accent="#A78BFA"
              label="ElevenLabs · SFX"
              sub={usage ? `${fmt(usage.el_sfx_calls)} generation${usage.el_sfx_calls !== 1 ? "s" : ""}` : "—"}
              value={usage ? fmt(usage.el_sfx_chars) : "—"}
              unit="prompt chars"
              cost={usage ? estimateCosts(usage).elSfx : undefined}
            />
          </div>
        </div>

      </div>
    </div>
  );
}
