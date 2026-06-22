"use client";

import { useState, useEffect } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { useViewMode, type ViewMode } from "@/context/ViewModeContext";
import LanguageToggle from "@/components/ui/LanguageToggle";
import { MOCK_USER } from "@/lib/mockData";
import { SYSTEM_AVATARS } from "@/config/systemAvatars";
import type { UsageTotals } from "@/lib/usageTracker";
import type { ChildProfile } from "@/types";

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

// ─── Avatar tile gradients (cycles by index) ──────────────────────────────────

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg,#1E3A5F,#4FC3F7)",
  "linear-gradient(135deg,#2D1B69,#8B5CF6)",
  "linear-gradient(135deg,#0D3D3D,#10D9A0)",
  "linear-gradient(135deg,#1A1A4E,#818CF8)",
  "linear-gradient(135deg,#4A1942,#EC4899)",
  "linear-gradient(135deg,#3D2000,#F59E0B)",
];

// ─── Child profile card ────────────────────────────────────────────────────────

const CHILD_PALETTES: [string, string][] = [
  ["#4fc3f7", "#7c3aed"],
  ["#f59e0b", "#ec4899"],
  ["#10b981", "#4fc3f7"],
  ["#a78bfa", "#f472b6"],
];

function childHash(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h;
}

function ChildCard({
  child,
  onChangeAvatar,
}: {
  child: ChildProfile;
  onChangeAvatar: () => void;
}) {
  const { t } = useLanguage();
  const [c1, c2] = CHILD_PALETTES[childHash(child.name) % CHILD_PALETTES.length];
  const ageLabel = child.age != null
    ? `${t("age")} ${child.age}`
    : `${child.ageGroup} ${t("yrs")}`;

  return (
    <div
      className="relative overflow-hidden rounded-2xl p-4 flex flex-col items-center gap-2.5"
      style={{
        background: `linear-gradient(145deg, ${c1}10, ${c2}18)`,
        border: `1px solid ${c1}25`,
      }}
    >
      <button
        onClick={onChangeAvatar}
        className="relative group"
        title="Change avatar"
      >
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center text-2xl transition-all group-hover:scale-105"
          style={{
            background: `linear-gradient(135deg, ${c1}30, ${c2}50)`,
            border: `1.5px solid ${c1}50`,
          }}
        >
          {child.avatarEmoji}
        </div>
        <span
          className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-semibold"
          style={{ background: "rgba(0,0,0,0.55)", color: "#fff" }}
        >
          ✏️
        </span>
      </button>
      <span className="text-white text-sm font-semibold">{child.name}</span>
      <span
        className="text-[10px] px-2.5 py-0.5 rounded-full font-bold tracking-widest uppercase"
        style={{ background: `${c1}14`, border: `1px solid ${c1}30`, color: c1 }}
      >
        {ageLabel}
      </span>
    </div>
  );
}

// ─── Avatar picker modal ──────────────────────────────────────────────────────

function AvatarPicker({
  current,
  onSelect,
  onClose,
}: {
  current: string;
  onSelect: (emoji: string) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl p-5 pb-8 max-h-[70vh] flex flex-col"
        style={{ background: "#111526", border: "1px solid rgba(255,255,255,0.08)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <p className="text-white/70 text-xs uppercase tracking-widest font-bold">Choose Avatar</p>
          <button onClick={onClose} className="text-white/30 text-lg leading-none">✕</button>
        </div>
        <div className="grid grid-cols-4 gap-2.5 overflow-y-auto">
          {SYSTEM_AVATARS.map((avatar, i) => {
            const grad = AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length];
            const isSelected = avatar.emoji === current;
            return (
              <button
                key={avatar.id}
                onClick={() => { onSelect(avatar.emoji); onClose(); }}
                className="flex flex-col items-center gap-1.5 rounded-2xl py-3 px-1 transition-all hover:scale-105 active:scale-95"
                style={{
                  background: isSelected ? "rgba(79,195,247,0.1)" : "rgba(255,255,255,0.03)",
                  border: isSelected ? "1.5px solid rgba(79,195,247,0.55)" : "1px solid rgba(255,255,255,0.07)",
                  boxShadow: isSelected ? "0 0 16px rgba(79,195,247,0.2)" : "none",
                }}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                  style={{ background: grad }}
                >
                  {avatar.emoji}
                </div>
                <span className="text-[9px] font-semibold text-white/40 truncate w-full text-center px-0.5">
                  {avatar.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Add child modal ──────────────────────────────────────────────────────────

function AddChildModal({
  onAdd,
  onClose,
  t,
}: {
  onAdd: (child: Omit<ChildProfile, "id" | "favoriteCategories" | "ageGroup">) => void;
  onClose: () => void;
  t: (key: string) => string;
}) {
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [emoji, setEmoji] = useState(SYSTEM_AVATARS[0].emoji);
  const [pickingAvatar, setPickingAvatar] = useState(false);

  function handleSave() {
    const trimmed = name.trim();
    const parsedAge = parseInt(age, 10);
    if (!trimmed || isNaN(parsedAge) || parsedAge < 1 || parsedAge > 16) return;
    onAdd({ name: trimmed, age: parsedAge, avatarEmoji: emoji });
    onClose();
  }

  if (pickingAvatar) {
    return (
      <AvatarPicker
        current={emoji}
        onSelect={setEmoji}
        onClose={() => setPickingAvatar(false)}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl p-5 pb-8"
        style={{ background: "#111526", border: "1px solid rgba(255,255,255,0.08)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <p className="text-white/70 text-xs uppercase tracking-widest font-bold">{t("addChild")}</p>
          <button onClick={onClose} className="text-white/30 text-lg leading-none">✕</button>
        </div>

        {/* Avatar picker trigger */}
        <div className="flex justify-center mb-5">
          <button
            onClick={() => setPickingAvatar(true)}
            className="relative group w-16 h-16 rounded-full flex items-center justify-center text-3xl transition-all hover:scale-105"
            style={{
              background: "linear-gradient(135deg, rgba(79,195,247,0.15), rgba(139,92,246,0.2))",
              border: "1.5px solid rgba(79,195,247,0.3)",
            }}
          >
            {emoji}
            <span
              className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-sm"
              style={{ background: "rgba(0,0,0,0.5)", color: "#fff" }}
            >
              ✏️
            </span>
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <label className="text-white/40 text-[10px] uppercase tracking-widest font-bold mb-1.5 block">{t("name")}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Child's name"
              maxLength={30}
              className="w-full px-4 py-3 rounded-2xl text-white text-sm outline-none transition-all"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
              onFocus={(e) => { e.target.style.borderColor = "rgba(79,195,247,0.4)"; }}
              onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.1)"; }}
            />
          </div>
          <div>
            <label className="text-white/40 text-[10px] uppercase tracking-widest font-bold mb-1.5 block">{t("age")}</label>
            <input
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="1–16"
              min={1}
              max={16}
              className="w-full px-4 py-3 rounded-2xl text-white text-sm outline-none transition-all"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
              onFocus={(e) => { e.target.style.borderColor = "rgba(79,195,247,0.4)"; }}
              onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.1)"; }}
            />
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={!name.trim() || !age}
          className="w-full mt-5 py-3.5 rounded-2xl text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-30"
          style={{
            background: "linear-gradient(135deg, #4fc3f7, #7c3aed)",
            color: "#fff",
          }}
        >
          {t("save")}
        </button>
      </div>
    </div>
  );
}

// ─── View mode button ─────────────────────────────────────────────────────────

const D_AUTO    = "M8 1.5l1.2 3.7 3.9.6-2.8 2.7.7 3.9L8 10.6l-3 1.8.7-3.9L3 5.8l3.9-.6z";
const D_MOBILE  = "M5 1h6a1 1 0 011 1v12a1 1 0 01-1 1H5a1 1 0 01-1-1V2a1 1 0 011-1zM7.5 13h1";
const D_TABLET  = "M3 1h10a1 1 0 011 1v12a1 1 0 01-1 1H3a1 1 0 01-1-1V2a1 1 0 011-1zM7 13.5h2";
const D_DESKTOP = "M1 2h14a1 1 0 011 1v9a1 1 0 01-1 1H1a1 1 0 01-1-1V3a1 1 0 011-1zM5 15h6M8 13v2";

const VIEW_MODES: { mode: ViewMode; labelKey: string; iconD: string }[] = [
  { mode: "auto",    labelKey: "Auto",    iconD: D_AUTO    },
  { mode: "mobile",  labelKey: "Mobile",  iconD: D_MOBILE  },
  { mode: "tablet",  labelKey: "Tablet",  iconD: D_TABLET  },
  { mode: "desktop", labelKey: "Desktop", iconD: D_DESKTOP },
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
  const geminiText = (u.gemini_tokens / 1_000_000) * 0.15;
  const geminiTts  = (u.gemini_tts_chars / 1_000) * 0.05;
  const elTts      = (u.el_tts_chars / 1_000) * 0.30;
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

// ─── AgeGroup helper ──────────────────────────────────────────────────────────

function ageToGroup(age: number): import("@/types").AgeGroup {
  if (age <= 4) return "2-4";
  if (age <= 6) return "4-6";
  if (age <= 8) return "6-8";
  if (age <= 10) return "8-10";
  return "10-12";
}

// ─── Profile page ─────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { t, isRTL } = useLanguage();
  const { mode, setMode } = useViewMode();
  const [usage, setUsage] = useState<UsageTotals | null>(null);
  const [children, setChildren] = useState<ChildProfile[]>(MOCK_USER.childProfiles);
  const [showAddChild, setShowAddChild] = useState(false);
  const [editAvatarFor, setEditAvatarFor] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/usage", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => setUsage(data as UsageTotals))
      .catch(() => {});
  }, []);

  function handleAddChild(partial: Omit<ChildProfile, "id" | "favoriteCategories" | "ageGroup">) {
    const newChild: ChildProfile = {
      id: `c${Date.now()}`,
      name: partial.name,
      avatarEmoji: partial.avatarEmoji,
      age: partial.age,
      ageGroup: ageToGroup(partial.age ?? 6),
      favoriteCategories: [],
    };
    setChildren((prev) => [...prev, newChild]);
  }

  function handleChangeAvatar(childId: string, emoji: string) {
    setChildren((prev) =>
      prev.map((c) => c.id === childId ? { ...c, avatarEmoji: emoji } : c)
    );
  }

  const editingChild = children.find((c) => c.id === editAvatarFor);

  const SETTINGS_ROWS = [
    { id: "notifications", label: t("notifications"), iconD: D_BELL,   accent: "#4fc3f7", value: t("on")     },
    { id: "nightmode",     label: t("nightMode"),     iconD: D_MOON,   accent: "#8B5CF6", value: t("always") },
    { id: "volume",        label: t("volume"),         iconD: D_VOLUME, accent: "#10D9A0", value: "80%"       },
  ];

  return (
    <>
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
              {children.map((child) => (
                <ChildCard
                  key={child.id}
                  child={child}
                  onChangeAvatar={() => setEditAvatarFor(child.id)}
                />
              ))}
              <button
                onClick={() => setShowAddChild(true)}
                className="rounded-2xl flex flex-col items-center justify-center gap-2 transition-all active:scale-[0.97] hover:border-white/20"
                style={{
                  minHeight: 130,
                  background: "rgba(255,255,255,0.02)",
                  border: "1.5px dashed rgba(255,255,255,0.1)",
                }}
              >
                <span className="text-xl font-light" style={{ color: "rgba(255,255,255,0.18)" }}>＋</span>
                <span className="text-[11px] font-medium" style={{ color: "rgba(255,255,255,0.22)" }}>{t("addChild")}</span>
              </button>
            </div>
          </div>

          {/* ── Display mode ─────────────────────────────────────────── */}
          <div className="mb-7">
            <SectionHeader label={t("display")} />
            <div className="grid grid-cols-4 gap-2">
              {VIEW_MODES.map((opt) => (
                <ViewModeBtn
                  key={opt.mode}
                  label={opt.labelKey}
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
              {SETTINGS_ROWS.map((s) => (
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
              <UsageRow iconD={D_SPARKLE} accent="#4fc3f7" label="Gemini · Text"
                sub={usage ? `${fmt(usage.gemini_calls)} request${usage.gemini_calls !== 1 ? "s" : ""}` : "—"}
                value={usage ? fmt(usage.gemini_tokens) : "—"} unit="tokens"
                cost={usage ? estimateCosts(usage).geminiText : undefined} />
              <UsageRow iconD={D_MIC} accent="#38bdf8" label="Gemini · TTS"
                sub={usage ? `${fmt(usage.gemini_tts_calls)} synthesis call${usage.gemini_tts_calls !== 1 ? "s" : ""}` : "—"}
                value={usage ? fmt(usage.gemini_tts_chars) : "—"} unit="chars"
                cost={usage ? estimateCosts(usage).geminiTts : undefined} />
              <UsageRow iconD={D_WAVEFORM} accent="#F59E0B" label="ElevenLabs · TTS"
                sub={usage ? `${fmt(usage.el_tts_calls)} synthesis call${usage.el_tts_calls !== 1 ? "s" : ""}` : "—"}
                value={usage ? fmt(usage.el_tts_chars) : "—"} unit="chars"
                cost={usage ? estimateCosts(usage).elTts : undefined} />
              <UsageRow iconD={D_MUSIC} accent="#A78BFA" label="ElevenLabs · SFX"
                sub={usage ? `${fmt(usage.el_sfx_calls)} generation${usage.el_sfx_calls !== 1 ? "s" : ""}` : "—"}
                value={usage ? fmt(usage.el_sfx_chars) : "—"} unit="prompt chars"
                cost={usage ? estimateCosts(usage).elSfx : undefined} />
            </div>
          </div>

        </div>
      </div>

      {/* Add child modal */}
      {showAddChild && (
        <AddChildModal
          onAdd={handleAddChild}
          onClose={() => setShowAddChild(false)}
          t={t}
        />
      )}

      {/* Avatar picker for existing child */}
      {editAvatarFor && editingChild && (
        <AvatarPicker
          current={editingChild.avatarEmoji}
          onSelect={(emoji) => handleChangeAvatar(editAvatarFor, emoji)}
          onClose={() => setEditAvatarFor(null)}
        />
      )}
    </>
  );
}
