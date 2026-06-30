"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import { useViewMode, type ViewMode } from "@/context/ViewModeContext";
import { useFontSize, type FontScale } from "@/context/FontSizeContext";
import { useAuth } from "@/context/AuthContext";
import LanguageToggle from "@/components/ui/LanguageToggle";
import FamilyVoicesPanel from "@/components/profile/FamilyVoicesPanel";
import StoryJourney from "@/components/profile/StoryJourney";
import { MOCK_USER } from "@/lib/mockData";
import { PRESET_VOICES } from "@/config/presetVoices";
import { getNarratorVoiceId, setNarratorVoiceId } from "@/lib/narratorPreference";
import type { UsageTotals } from "@/lib/usageTracker";
import type { ChildProfile } from "@/types";
import Icon from "@/components/ui/Icon";
import { type IconName } from "@/lib/icons";
import { supabaseAuth } from "@/lib/supabaseAuth";

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

function childHash(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h;
}

function ChildCard({
  child,
  onChangeAvatar,
  onDelete,
}: {
  child: ChildProfile;
  onChangeAvatar: () => void;
  onDelete: () => void;
}) {
  const { t } = useLanguage();
  const [c1, c2] = CHILD_PALETTES[childHash(child.name) % CHILD_PALETTES.length];

  return (
    <div className="flex flex-col items-center gap-2.5 flex-shrink-0 transition-all active:scale-[0.97]" style={{ width: 84 }}>
      {/* Avatar circle + delete badge */}
      <div className="relative">
        {/* Glowing gradient ring */}
        <button
          onClick={onChangeAvatar}
          className="group block"
          title={t("changeAvatar" as never)}
        >
          <div style={{
            width: 80, height: 80, borderRadius: "50%",
            padding: 2.5,
            background: `linear-gradient(135deg, ${c1}, ${c2} 55%, ${c1})`,
            boxShadow: `0 0 20px ${c1}50, 0 0 40px ${c2}1a`,
          }}>
            <div style={{
              width: "100%", height: "100%", borderRadius: "50%",
              overflow: "hidden", background: "#07091a",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {child.avatarEmoji?.startsWith("http") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={child.avatarEmoji} alt={child.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span style={{ fontSize: 32 }}>{child.avatarEmoji || "⭐"}</span>
              )}
            </div>
          </div>
          {/* Edit overlay */}
          <div className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ background: "rgba(0,0,0,0.45)" }}>
            <span style={{ fontSize: 18 }}>✏️</span>
          </div>
        </button>

      </div>

      {/* Name */}
      <p className="font-semibold text-fs-body truncate w-full text-center leading-tight" style={{
        color: "rgba(255,255,255,0.85)",
        textShadow: `0 0 14px ${c1}88`,
      }}>
        {child.name}
      </p>
    </div>
  );
}

// ─── Avatar picker modal ──────────────────────────────────────────────────────

type BankAvatar = { id: string; description: string; image_url: string };

function AvatarPicker({
  current,
  onSelect,
  onClose,
}: {
  current: string;
  onSelect: (url: string) => void;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const [avatars, setAvatars] = useState<BankAvatar[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/avatar-bank-list")
      .then((r) => r.json())
      .then((data: { avatars: BankAvatar[] }) => { setAvatars(data.avatars ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl flex flex-col overflow-hidden"
        style={{
          background: "rgba(8,12,24,0.97)",
          border: "1px solid rgba(255,255,255,0.09)",
          maxHeight: "72vh",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* top accent bar */}
        <div className="h-0.5 w-full flex-shrink-0" style={{ background: "linear-gradient(90deg,#4fc3f7,#8B5CF6)" }} />

        <div className="flex items-center justify-between px-5 pt-4 pb-3 flex-shrink-0">
          <div>
            <p className="text-white font-bold text-fs-body">{t("chooseAvatar")}</p>
            <p className="text-white/30 text-fs-body mt-0.5">{loading ? t("loading") : `${avatars.length} characters`}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:text-white/70 transition-colors"
            style={{ background: "rgba(255,255,255,0.06)" }}
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2.5 overflow-y-auto px-4 pb-6">
          {avatars.map((avatar) => {
            const isSelected = avatar.image_url === current;
            return (
              <button
                key={avatar.id}
                onClick={() => { onSelect(avatar.image_url); onClose(); }}
                className="flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-2xl transition-all active:scale-95"
                style={{
                  background: isSelected ? "rgba(79,195,247,0.1)" : "rgba(255,255,255,0.03)",
                  border: isSelected ? "1.5px solid rgba(79,195,247,0.5)" : "1px solid rgba(255,255,255,0.06)",
                  boxShadow: isSelected ? "0 0 18px rgba(79,195,247,0.18)" : "none",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={avatar.image_url}
                  alt={avatar.description}
                  className="w-14 h-14 rounded-full object-cover flex-shrink-0"
                  style={{
                    border: isSelected
                      ? "2px solid rgba(79,195,247,0.65)"
                      : "1.5px solid rgba(255,255,255,0.13)",
                  }}
                />
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
  t: (key: Parameters<ReturnType<typeof useLanguage>["t"]>[0]) => string;
}) {
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [emoji, setEmoji] = useState("");
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
          <p className="text-white/70 text-fs-body uppercase tracking-widest font-bold">{t("addChild")}</p>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors"><Icon name="close" size={18} /></button>
        </div>

        {/* Avatar picker trigger */}
        <div className="flex justify-center mb-5">
          <button
            onClick={() => setPickingAvatar(true)}
            className="relative group w-16 h-16 rounded-full flex items-center justify-center text-fs-display transition-all hover:scale-105"
            style={{
              background: "linear-gradient(135deg, rgba(79,195,247,0.15), rgba(139,92,246,0.2))",
              border: "1.5px solid rgba(79,195,247,0.3)",
            }}
          >
            {emoji?.startsWith("http") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={emoji} alt="avatar" className="w-full h-full rounded-full object-cover" />
            ) : emoji || <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "var(--fs-display)" }}>＋</span>}
            <span
              className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-fs-body"
              style={{ background: "rgba(0,0,0,0.5)", color: "#fff" }}
            >
              ✏️
            </span>
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <label className="text-white/40 text-fs-body uppercase tracking-widest font-bold mb-1.5 block">{t("name")}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("childsName")}
              maxLength={30}
              className="w-full px-4 py-3 rounded-2xl text-white text-fs-body outline-none transition-all"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
              onFocus={(e) => { e.target.style.borderColor = "rgba(79,195,247,0.4)"; }}
              onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.1)"; }}
            />
          </div>
          <div>
            <label className="text-white/40 text-fs-body uppercase tracking-widest font-bold mb-1.5 block">{t("age")}</label>
            <input
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="1–16"
              min={1}
              max={16}
              className="w-full px-4 py-3 rounded-2xl text-white text-fs-body outline-none transition-all"
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
          className="w-full mt-5 py-3.5 rounded-2xl text-fs-body font-bold transition-all active:scale-[0.98] disabled:opacity-30"
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
  { mode: "auto",    labelKey: "viewAuto",    iconD: D_AUTO    },
  { mode: "mobile",  labelKey: "viewMobile",  iconD: D_MOBILE  },
  { mode: "tablet",  labelKey: "viewTablet",  iconD: D_TABLET  },
  { mode: "desktop", labelKey: "viewDesktop", iconD: D_DESKTOP },
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
        className="text-fs-body font-semibold"
        style={{ color: selected ? "#4fc3f7" : "rgba(255,255,255,0.35)" }}
      >
        {label}
      </span>
    </button>
  );
}

// ─── Setting row ──────────────────────────────────────────────────────────────

function SettingRow({
  label, iconName, accent, value,
}: { label: string; iconName: IconName; accent: string; value?: string }) {
  return (
    <div
      className="flex items-center gap-3.5 px-4 py-3.5 rounded-2xl transition-all"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${accent}18`, border: `1px solid ${accent}28`, color: accent }}
      >
        <Icon name={iconName} size={18} />
      </div>
      <span className="flex-1 text-white/80 text-fs-body font-medium">{label}</span>
      {value && <span className="text-white/30 text-fs-body">{value}</span>}
      <Icon name="chevronRight" size={14} />
    </div>
  );
}

// ─── API usage row ────────────────────────────────────────────────────────────

function UsageRow({
  iconName, accent, label, sub, value, unit, cost,
}: {
  iconName: IconName; accent: string; label: string; sub: string;
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
        <Icon name={iconName} size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white/80 text-fs-body font-semibold">{label}</p>
        <p className="text-white/30 text-fs-body mt-0.5">{sub}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-fs-body font-bold" style={{ color: accent }}>{value}</p>
        <p className="text-fs-body text-white/25 mt-0.5">{unit}</p>
        {cost && <p className="text-fs-body mt-0.5 font-semibold" style={{ color: `${accent}99` }}>~{cost}</p>}
      </div>
    </div>
  );
}

// ─── Cost estimator ───────────────────────────────────────────────────────────

function estimateCosts(u: UsageTotals) {
  const geminiText  = (u.gemini_tokens / 1_000_000) * 0.15;
  const geminiTts   = (u.gemini_tts_chars / 1_000) * 0.05;
  const geminiImage = (u.gemini_image_calls ?? 0) * 0.04;
  const elTts       = (u.el_tts_chars / 1_000) * 0.30;
  const elSfx       = (u.el_sfx_chars / 1_000) * 0.08;
  const total       = geminiText + geminiTts + geminiImage + elTts + elSfx;
  const fmtCost     = (n: number) => n < 0.01 ? "<$0.01" : `$${n.toFixed(2)}`;
  return { geminiText: fmtCost(geminiText), geminiTts: fmtCost(geminiTts), geminiImage: fmtCost(geminiImage), elTts: fmtCost(elTts), elSfx: fmtCost(elSfx), total: fmtCost(total) };
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <p className="text-fs-body font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.28)" }}>
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

// ─── Narrator voice section (collapsible, shows selected in header) ───────────

function NarratorVoiceSection({ open, onToggle, label }: { open: boolean; onToggle: () => void; label: string }) {
  const [selected, setSelected] = useState<string>("Zephyr");
  useEffect(() => { setSelected(getNarratorVoiceId()); }, []);

  const selectedVoice = PRESET_VOICES.find((v) => v.id === selected) ?? PRESET_VOICES[0];

  function pick(id: string) {
    setSelected(id);
    setNarratorVoiceId(id);
  }

  return (
    <div className="mb-7">
      {/* Section label */}
      <p className="text-fs-body font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.28)" }}>
        {label}
      </p>

      {/* Collapsed row — always shows selected voice as a tappable card */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all active:scale-[0.98]"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: open ? "1px solid rgba(79,195,247,0.3)" : "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={selectedVoice.avatarUrl}
          alt={selectedVoice.name}
          className="w-10 h-10 rounded-full object-cover flex-shrink-0"
          style={{ border: "2px solid rgba(79,195,247,0.5)" }}
        />
        <div className="flex-1 text-left">
          <p className="text-fs-body font-semibold" style={{ color: "#4fc3f7" }}>{selectedVoice.name}</p>
          <p className="text-fs-body mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>{selectedVoice.desc}</p>
        </div>
        <span
          className="text-white/30 text-fs-body flex-shrink-0 transition-transform"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", display: "inline-block" }}
        >
          ▾
        </span>
      </button>

      {/* Expanded — full carousel */}
      {open && (
        <div className="mt-3">
          <NarratorVoicePicker selected={selected} onPick={pick} />
          <p className="text-white/18 text-fs-body mt-2 leading-relaxed">
            Used for Luna&apos;s chat voice and as the narrator in new stories.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Narrator voice picker ────────────────────────────────────────────────────

function NarratorVoicePicker({ selected, onPick }: { selected: string; onPick: (id: string) => void }) {
  return (
    <div
      className="-mx-1 flex gap-2.5 overflow-x-auto pb-1"
      style={{ scrollbarWidth: "none" }}
    >
      {PRESET_VOICES.map((v) => {
        const isActive = selected === v.id;
        return (
          <button
            key={v.id}
            onClick={() => onPick(v.id)}
            className="flex-shrink-0 flex flex-col items-center gap-1.5 px-2 py-2.5 rounded-2xl transition-all active:scale-95"
            style={{
              width: 72,
              background: isActive ? "rgba(79,195,247,0.1)" : "rgba(255,255,255,0.03)",
              border: isActive ? "1.5px solid rgba(79,195,247,0.5)" : "1px solid rgba(255,255,255,0.07)",
              boxShadow: isActive ? "0 0 16px rgba(79,195,247,0.15)" : "none",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={v.avatarUrl}
              alt={v.name}
              className="w-11 h-11 rounded-full object-cover"
              style={{ border: isActive ? "2px solid rgba(79,195,247,0.6)" : "1.5px solid rgba(255,255,255,0.12)" }}
            />
            <span className="text-fs-body font-semibold truncate w-full text-center"
              style={{ color: isActive ? "#4fc3f7" : "rgba(255,255,255,0.45)" }}>
              {v.name}
            </span>
            <span className="text-fs-body text-center leading-tight"
              style={{ color: isActive ? "rgba(79,195,247,0.6)" : "rgba(255,255,255,0.2)" }}>
              {v.desc.split(" ")[0]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Text size picker ─────────────────────────────────────────────────────────

const FONT_SCALE_OPTIONS: { scale: FontScale; sampleSize: number }[] = [
  { scale: "small",  sampleSize: 18 },
  { scale: "medium", sampleSize: 24 },
  { scale: "large",  sampleSize: 29 },
];

function TextSizePicker() {
  const { scale, setScale, fs } = useFontSize();
  const { t } = useLanguage();

  const scaleLabel: Record<FontScale, string> = {
    small:  t("fontSmall" as never),
    medium: t("fontMedium" as never),
    large:  t("fontLarge" as never),
  };

  return (
    <div>
      <div className="grid grid-cols-3 gap-2.5">
        {FONT_SCALE_OPTIONS.map((opt) => {
          const isSelected = scale === opt.scale;
          return (
            <button
              key={opt.scale}
              onClick={() => setScale(opt.scale)}
              className="flex flex-col items-center gap-2 py-4 rounded-2xl transition-all active:scale-[0.97]"
              style={{
                background: isSelected ? "rgba(79,195,247,0.08)" : "rgba(255,255,255,0.03)",
                border: isSelected ? "1px solid rgba(79,195,247,0.5)" : "1px solid rgba(255,255,255,0.08)",
                boxShadow: isSelected ? "0 0 20px rgba(79,195,247,0.1)" : "none",
              }}
            >
              <span
                className="font-bold leading-none"
                style={{
                  fontSize: opt.sampleSize,
                  color: isSelected ? "#4fc3f7" : "rgba(255,255,255,0.4)",
                }}
              >
                A
              </span>
              <span
                className="text-fs-body font-semibold"
                style={{ color: isSelected ? "#4fc3f7" : "rgba(255,255,255,0.35)" }}
              >
                {scaleLabel[opt.scale]}
              </span>
            </button>
          );
        })}
      </div>
      <p
        className="mt-3 leading-relaxed"
        style={{ fontSize: fs.body, color: "rgba(255,255,255,0.5)" }}
      >
        {t("fontPreview" as never)}
      </p>
    </div>
  );
}

// ─── Profile page ─────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { t, isRTL } = useLanguage();
  const { mode, setMode } = useViewMode();
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [usage, setUsage] = useState<UsageTotals | null>(null);
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [childrenLoaded, setChildrenLoaded] = useState(false);
  const [showAddChild, setShowAddChild] = useState(false);
  const [editAvatarFor, setEditAvatarFor] = useState<string | null>(null);
  const [narratorOpen, setNarratorOpen] = useState(false);
  const [apiExpanded, setApiExpanded] = useState(false);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [familyMembers, setFamilyMembers] = useState<{ user_id: string; role: string }[]>([]);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);

  const loadFamily = useCallback(async () => {
    if (!user) return;
    const { data } = await supabaseAuth
      .from("family_members")
      .select("family_id, role")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    if (!data) return;
    setFamilyId(data.family_id);
    const { data: members } = await supabaseAuth
      .from("family_members")
      .select("user_id, role")
      .eq("family_id", data.family_id);
    setFamilyMembers(members ?? []);
  }, [user]);

  useEffect(() => { loadFamily(); }, [loadFamily]);

  async function handleInvite() {
    if (!familyId) return;
    setInviteLoading(true);
    setInviteLink(null);
    const res = await fetch("/api/family/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ familyId }),
    });
    const data = await res.json();
    if (data.token) {
      const link = `${window.location.origin}/join?token=${data.token}`;
      setInviteLink(link);
      await navigator.clipboard.writeText(link).catch(() => {});
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 3000);
    }
    setInviteLoading(false);
  }

  // Load children from DB on mount; seed mock defaults if table is empty
  useEffect(() => {
    fetch("/api/child-profiles")
      .then((r) => r.json())
      .then(async (data: Array<{ id: string; name: string; age: number; avatar_emoji: string }>) => {
        if (Array.isArray(data) && data.length > 0) {
          setChildren(data.map((c) => ({
            id: c.id, name: c.name, age: c.age,
            avatarEmoji: c.avatar_emoji, ageGroup: ageToGroup(c.age), favoriteCategories: [],
          })));
          setChildrenLoaded(true);
        } else {
          // Seed mock defaults into DB so future PATCHes work
          const seeded: ChildProfile[] = [];
          for (const mock of MOCK_USER.childProfiles) {
            try {
              const res = await fetch("/api/child-profiles", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: mock.name, age: mock.age ?? 5, avatar_emoji: mock.avatarEmoji ?? "", gender: "other" }),
              });
              if (res.ok) {
                const saved = await res.json() as { id: string; name: string; age: number; avatar_emoji: string };
                seeded.push({ id: saved.id, name: saved.name, age: saved.age, avatarEmoji: saved.avatar_emoji, ageGroup: ageToGroup(saved.age), favoriteCategories: [] });
              }
            } catch { /* ignore */ }
          }
          if (seeded.length > 0) setChildren(seeded);
          setChildrenLoaded(true);
        }
      })
      .catch(() => { setChildrenLoaded(true); });
  }, []);

  useEffect(() => {
    fetch("/api/usage", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => setUsage(data as UsageTotals))
      .catch(() => {});
  }, []);

  async function handleAddChild(partial: Omit<ChildProfile, "id" | "favoriteCategories" | "ageGroup">) {
    try {
      const res = await fetch("/api/child-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: partial.name, age: partial.age, avatar_emoji: partial.avatarEmoji ?? "", gender: "other" }),
      });
      if (res.ok) {
        const saved = await res.json() as { id: string; name: string; age: number; avatar_emoji: string };
        setChildren((prev) => [...prev, {
          id: saved.id, name: saved.name, age: saved.age,
          avatarEmoji: saved.avatar_emoji, ageGroup: ageToGroup(saved.age), favoriteCategories: [],
        }]);
      }
    } catch { /* ignore */ }
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      const { data: { session } } = await (await import("@/lib/supabaseAuth")).supabaseAuth.auth.getSession();
      const token = session?.access_token;
      if (!token) { setDeleting(false); return; }
      const res = await fetch("/api/account/delete", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        await signOut();
        router.replace("/login");
      } else {
        setDeleting(false);
        setShowDeleteConfirm(false);
      }
    } catch {
      setDeleting(false);
    }
  }

  async function handleDeleteChild(childId: string) {
    setChildren((prev) => prev.filter((c) => c.id !== childId));
    try {
      await fetch(`/api/child-profiles/${childId}`, { method: "DELETE" });
    } catch { /* ignore */ }
  }

  async function handleChangeAvatar(childId: string, emoji: string) {
    setChildren((prev) => prev.map((c) => c.id === childId ? { ...c, avatarEmoji: emoji } : c));
    try {
      await fetch(`/api/child-profiles/${childId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar_emoji: emoji }),
      });
    } catch { /* ignore */ }
  }

  const editingChild = children.find((c) => c.id === editAvatarFor);

  const SETTINGS_ROWS = [
    { id: "notifications", label: t("notifications"), iconName: "bell"   as IconName, accent: "#4fc3f7", value: t("on")     },
    { id: "nightmode",     label: t("nightMode"),     iconName: "moon"   as IconName, accent: "#8B5CF6", value: t("always") },
    { id: "volume",        label: t("volume"),         iconName: "volume" as IconName, accent: "#10D9A0", value: "80%"       },
  ];

  return (
    <>
      <div className="min-h-full" style={{ background: "transparent" }} dir={isRTL ? "rtl" : "ltr"}>
        <div className="px-5 pt-12 pb-10">

          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-fs-heading font-semibold text-white tracking-wide mb-0.5">{t("profile")}</h1>
              <p className="text-white/30 text-fs-body">{t("manageAccount")}</p>
            </div>
            <LanguageToggle />
          </div>

          {/* ── Child profiles ──────────────────────────────────────── */}
          <div className="mb-7">
            <SectionHeader label={t("childProfiles")} />
            <div className="flex flex-wrap gap-5">
              {!childrenLoaded
                ? [0, 1].map((i) => (
                    <div key={i} className="flex flex-col items-center gap-2.5 animate-pulse" style={{ width: 84 }}>
                      <div style={{ width: 80, height: 80, borderRadius: "50%", background: "rgba(255,255,255,0.06)", animationDelay: `${i * 0.1}s` }} />
                      <div style={{ width: 52, height: 10, borderRadius: 6, background: "rgba(255,255,255,0.05)" }} />
                    </div>
                  ))
                : children.map((child) => (
                    <ChildCard
                      key={child.id}
                      child={child}
                      onChangeAvatar={() => setEditAvatarFor(child.id)}
                      onDelete={() => handleDeleteChild(child.id)}
                    />
                  ))
              }
              {/* Add child — small + pill */}
              <button
                onClick={() => setShowAddChild(true)}
                className="flex-shrink-0 self-center flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all active:scale-95"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px dashed rgba(255,255,255,0.18)",
                  color: "rgba(255,255,255,0.4)",
                }}
              >
                <span style={{ fontSize: 14, lineHeight: 1 }}>+</span>
                <span className="text-fs-label font-medium">{t("addChild")}</span>
              </button>
            </div>
          </div>

          {/* ── Story Journey ────────────────────────────────────────── */}
          <div id="story-journey">
            <StoryJourney />
          </div>

          {/* ── Family Voices ────────────────────────────────────────── */}
          <FamilyVoicesPanel />

          {/* ── Family Members ───────────────────────────────────────── */}
          <div className="mb-7">
            <div className="flex items-center justify-between mb-3">
              <p className="font-bold text-fs-heading" style={{ color: "#e2e8f0" }}>{t("familyMembers")}</p>
              <span className="text-fs-label px-2 py-0.5 rounded-full" style={{ background: "rgba(167,139,250,0.12)", color: "#a78bfa" }}>
                {familyMembers.length} member{familyMembers.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Member list */}
            <div className="flex flex-col gap-2 mb-3">
              {familyMembers.map((m) => (
                <div key={m.user_id} className="flex items-center justify-between px-4 py-3 rounded-2xl"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold"
                      style={{
                        background: m.role === "owner"
                          ? "linear-gradient(135deg,rgba(167,139,250,0.2),rgba(79,195,247,0.15))"
                          : "rgba(255,255,255,0.05)",
                        border: m.role === "owner"
                          ? "1px solid rgba(167,139,250,0.4)"
                          : "1px solid rgba(255,255,255,0.1)",
                        fontSize: "var(--fs-body)",
                        color: m.role === "owner" ? "#a78bfa" : "rgba(255,255,255,0.35)",
                      }}>
                      {m.role === "owner" ? "✦" : "·"}
                    </div>
                    <div>
                      <p className="text-fs-body font-medium" style={{ color: "#e2e8f0" }}>
                        {m.user_id === user?.id ? (user?.email ?? t("you")) : t("familyMember")}
                      </p>
                      <p className="text-fs-label" style={{ color: "rgba(148,163,184,0.5)" }}>{m.role === "owner" ? t("roleOwner" as never) : t("roleMember" as never)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Invite button */}
            <button
              onClick={handleInvite}
              disabled={inviteLoading}
              className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 font-semibold transition-opacity"
              style={{
                background: "linear-gradient(135deg, rgba(167,139,250,0.15), rgba(79,195,247,0.10))",
                border: "1px solid rgba(167,139,250,0.3)",
                color: "#a78bfa",
                fontSize: 14,
                opacity: inviteLoading ? 0.6 : 1,
              }}
            >
              <span style={{ fontSize: 16 }}>🔗</span>
              {inviteLoading ? t("generatingLink") : inviteCopied ? `✓ ${t("linkCopied")}` : t("inviteFamilyMember")}
            </button>

            {inviteLink && (
              <div className="mt-2 px-3 py-2 rounded-xl flex items-center gap-2"
                style={{ background: "rgba(79,195,247,0.06)", border: "1px solid rgba(79,195,247,0.15)" }}>
                <p className="flex-1 text-fs-label truncate" style={{ color: "rgba(148,163,184,0.7)" }}>{inviteLink}</p>
                <button onClick={() => { navigator.clipboard.writeText(inviteLink); setInviteCopied(true); setTimeout(() => setInviteCopied(false), 2000); }}
                  style={{ color: "#4fc3f7", fontSize: 12, whiteSpace: "nowrap" }}>{t("copyLink" as never)}</button>
              </div>
            )}
          </div>

          {/* ── Sign out ─────────────────────────────────────────────── */}
          <div className="mb-3">
            <button
              onClick={async () => { await signOut(); router.replace("/login"); }}
              className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 font-semibold"
              style={{
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.2)",
                color: "#fca5a5",
                fontSize: 14,
              }}
            >
              {t("signOut")}
            </button>
          </div>

          {/* ── Privacy & Delete account ──────────────────────────────── */}
          <div className="mb-7 flex items-center justify-between gap-3">
            <a href="/privacy" style={{ fontSize: 12, color: "rgba(148,163,184,0.35)", textDecoration: "underline", flexShrink: 0 }}>
              {t("privacyPolicy")}
            </a>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 rounded-xl font-medium transition-all active:scale-[0.97]"
              style={{
                background: "rgba(239,68,68,0.07)",
                border: "1px solid rgba(239,68,68,0.16)",
                color: "rgba(239,68,68,0.5)",
                fontSize: 12,
              }}
            >
              {t("deleteAccount")}
            </button>
          </div>

          {/* ── Display mode ─────────────────────────────────────────── */}
          <div className="mb-7">
            <SectionHeader label={t("display")} />
            <div className="grid grid-cols-4 gap-2">
              {VIEW_MODES.map((opt) => (
                <ViewModeBtn
                  key={opt.mode}
                  label={t(opt.labelKey as never)}
                  iconD={opt.iconD}
                  selected={mode === opt.mode}
                  onClick={() => setMode(opt.mode)}
                />
              ))}
            </div>
            <p className="text-white/18 text-fs-body mt-2 leading-relaxed">
              {t("viewModeDescription" as never)}
            </p>
          </div>

          {/* ── Narrator voice ───────────────────────────────────────── */}
          <NarratorVoiceSection open={narratorOpen} onToggle={() => setNarratorOpen((v) => !v)} label={t("defaultNarratorVoice")} />

          {/* ── Text Size ───────────────────────────────────────────── */}
          <div className="mb-7">
            <SectionHeader label={t("textSize")} />
            <TextSizePicker />
          </div>

          {/* ── API Usage ─────────────────────────────────────────────── */}
          <div>
            <SectionHeader label={t("apiUsage")} />

            {usage && (() => {
              const costs = estimateCosts(usage);
              return (
                <button
                  onClick={() => setApiExpanded((v) => !v)}
                  className="w-full mb-3 px-4 py-3 rounded-2xl flex items-center justify-between transition-all active:scale-[0.99]"
                  style={{ background: "rgba(79,195,247,0.05)", border: "1px solid rgba(79,195,247,0.15)" }}
                >
                  <div className="text-start">
                    <p className="text-fs-body font-bold uppercase tracking-widest" style={{ color: "rgba(79,195,247,0.5)" }}>{t("estimatedSpend" as never)}</p>
                    <p className="text-fs-body mt-0.5" style={{ color: "rgba(255,255,255,0.2)" }}>{t("estimatedSpendNote" as never)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-fs-subtitle font-bold" style={{ color: "#4fc3f7" }}>{costs.total}</p>
                    <span style={{ color: "rgba(79,195,247,0.4)", fontSize: 10, transform: apiExpanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▼</span>
                  </div>
                </button>
              );
            })()}

            {apiExpanded && (
              <div className="flex flex-col gap-2">
                <UsageRow iconName="sparkles" accent="#4fc3f7" label="Gemini · Text"
                  sub={usage ? `${fmt(usage.gemini_calls)} request${usage.gemini_calls !== 1 ? "s" : ""}` : "—"}
                  value={usage ? fmt(usage.gemini_tokens) : "—"} unit="tokens"
                  cost={usage ? estimateCosts(usage).geminiText : undefined} />
                <UsageRow iconName="mic" accent="#38bdf8" label="Gemini · TTS"
                  sub={usage ? `${fmt(usage.gemini_tts_calls)} synthesis call${usage.gemini_tts_calls !== 1 ? "s" : ""}` : "—"}
                  value={usage ? fmt(usage.gemini_tts_chars) : "—"} unit="chars"
                  cost={usage ? estimateCosts(usage).geminiTts : undefined} />
                <UsageRow iconName="sparkles" accent="#34d399" label="Gemini · Images"
                  sub={usage ? `${fmt(usage.gemini_image_calls ?? 0)} image${(usage.gemini_image_calls ?? 0) !== 1 ? "s" : ""} generated` : "—"}
                  value={usage ? fmt(usage.gemini_image_calls ?? 0) : "—"} unit="images"
                  cost={usage ? estimateCosts(usage).geminiImage : undefined} />
                <UsageRow iconName="sparkles" accent="#6ee7b7" label="Pollinations · Images"
                  sub={usage ? `${fmt(usage.pollinations_calls ?? 0)} image${(usage.pollinations_calls ?? 0) !== 1 ? "s" : ""} generated` : "—"}
                  value={usage ? fmt(usage.pollinations_calls ?? 0) : "—"} unit="images" />
                <UsageRow iconName="waveform" accent="#F59E0B" label="ElevenLabs · TTS"
                  sub={usage ? `${fmt(usage.el_tts_calls)} synthesis call${usage.el_tts_calls !== 1 ? "s" : ""}` : "—"}
                  value={usage ? fmt(usage.el_tts_chars) : "—"} unit="chars"
                  cost={usage ? estimateCosts(usage).elTts : undefined} />
                <UsageRow iconName="music" accent="#A78BFA" label="ElevenLabs · SFX"
                  sub={usage ? `${fmt(usage.el_sfx_calls)} generation${usage.el_sfx_calls !== 1 ? "s" : ""}` : "—"}
                  value={usage ? fmt(usage.el_sfx_chars) : "—"} unit="prompt chars"
                  cost={usage ? estimateCosts(usage).elSfx : undefined} />
              </div>
            )}
          </div>

        </div>
      </div>

      {/* App version / build info */}
      {(() => {
        const BUILD_LABEL = "Jun 12 · v4";
        const badge = process.env.NEXT_PUBLIC_BUILD_TIME
          ? (() => {
              const d = new Date(process.env.NEXT_PUBLIC_BUILD_TIME!);
              return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
                + " " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
            })()
          : BUILD_LABEL;
        return (
          <div className="flex justify-center pb-6 pt-2">
            <span
              className="text-fs-body font-mono px-2.5 py-1 rounded-full"
              style={{
                background: "rgba(255,255,255,0.04)",
                color: "rgba(255,255,255,0.18)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              {badge}
            </span>
          </div>
        );
      })()}

      {/* Delete account confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}>
          <div className="w-full rounded-2xl p-6" style={{ maxWidth: 360, background: "#0d0f22", border: "1px solid rgba(239,68,68,0.3)" }}>
            <h2 className="font-bold mb-2" style={{ fontSize: 18, color: "#e2e8f0" }}>{t("deleteAccountTitle")}</h2>
            <p className="mb-6" style={{ fontSize: 14, color: "rgba(148,163,184,0.8)", lineHeight: 1.6 }}>
              {t("deleteAccountWarning")}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 rounded-xl py-3 font-semibold"
                style={{ background: "rgba(255,255,255,0.06)", color: "#e2e8f0", fontSize: 14 }}
              >
                {t("cancel")}
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="flex-1 rounded-xl py-3 font-semibold"
                style={{ background: "rgba(239,68,68,0.15)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.3)", fontSize: 14, opacity: deleting ? 0.6 : 1 }}
              >
                {deleting ? t("deleting") : t("yesDelete")}
              </button>
            </div>
          </div>
        </div>
      )}

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
