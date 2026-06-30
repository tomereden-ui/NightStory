"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import type { ScriptBlock } from "@/types";
import { PRESET_VOICES } from "@/config/presetVoices";
import type { ClassicMeta } from "@/lib/classicStories";

const ADMIN_EMAIL = "tomereden@gmail.com";

// ─── Pricing model (estimates based on standard API rates) ────────────────────
// All prices in USD. Adjust here if plans/pricing change.
const PRICING = {
  gemini_token:      0.40  / 1_000_000,  // $0.40/1M tokens — blended text gen (Flash 2.5)
  gemini_tts_char:   0.10  / 1_000_000,  // $0.10/1M chars  — Gemini TTS synthesis
  gemini_image:      0.04,               // $0.04/image     — Imagen / Flash-image
  el_tts_char:       0.20  / 1_000,      // $0.20/1K chars  — ElevenLabs eleven_v3
  el_sfx_call:       0.08,               // $0.08/call      — ElevenLabs SFX generation
} as const;

const LANGUAGES = [
  { code: "en", label: "English 🇺🇸" },
  { code: "he", label: "Hebrew 🇮🇱" },
  { code: "es", label: "Spanish 🇪🇸" },
  { code: "fr", label: "French 🇫🇷" },
  { code: "de", label: "German 🇩🇪" },
  { code: "it", label: "Italian 🇮🇹" },
  { code: "pt", label: "Portuguese 🇵🇹" },
  { code: "ar", label: "Arabic 🇸🇦" },
  { code: "ru", label: "Russian 🇷🇺" },
];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function makeBlock(order: number): ScriptBlock {
  return { id: uid(), blockOrder: order, characterName: "Narrator", assignedVoiceId: "Aoede", textPayload: "" };
}

// ─── Shared UI ─────────────────────────────────────────────────────────────────

const baseInput = "w-full px-3 py-2.5 rounded-xl text-white text-fs-body outline-none";
const baseStyle = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" };

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-fs-body mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>{children}</p>;
}

function TextInput({ value, onChange, placeholder, rows }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  if (rows) {
    return <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows}
      className={baseInput + " resize-none"} style={baseStyle} />;
  }
  return <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
    className={baseInput} style={baseStyle} />;
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={baseInput}
      style={{ ...baseStyle, color: "#fff", appearance: "none" }}>
      {options.map((o) => <option key={o.value} value={o.value} style={{ background: "#0D1120" }}>{o.label}</option>)}
    </select>
  );
}

function Toggle({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <div onClick={onToggle} className="relative rounded-full transition-all flex-shrink-0"
        style={{ width: 44, height: 24, background: on ? "rgba(79,195,247,0.4)" : "rgba(255,255,255,0.1)", border: on ? "1px solid rgba(79,195,247,0.6)" : "1px solid rgba(255,255,255,0.15)" }}>
        <div className="absolute top-0.5 rounded-full transition-all"
          style={{ width: 20, height: 20, background: on ? "#4fc3f7" : "rgba(255,255,255,0.4)", left: on ? 22 : 2 }} />
      </div>
      <span className="text-fs-body" style={{ color: on ? "#4fc3f7" : "rgba(255,255,255,0.35)" }}>{label}</span>
    </label>
  );
}

function Divider({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 my-6">
      <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
      <span className="text-fs-body font-bold uppercase tracking-widest flex-shrink-0" style={{ color: "rgba(255,255,255,0.25)" }}>{title}</span>
      <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
    </div>
  );
}

// ─── Block Editor ──────────────────────────────────────────────────────────────

function BlockEditor({ blocks, onChange }: { blocks: ScriptBlock[]; onChange: (b: ScriptBlock[]) => void }) {
  const update = (id: string, patch: Partial<ScriptBlock>) =>
    onChange(blocks.map((b) => b.id === id ? { ...b, ...patch } : b));
  const remove = (id: string) =>
    onChange(blocks.filter((b) => b.id !== id).map((b, i) => ({ ...b, blockOrder: i })));
  const add = () => onChange([...blocks, makeBlock(blocks.length)]);
  const move = (id: string, dir: -1 | 1) => {
    const i = blocks.findIndex((b) => b.id === id);
    if (i + dir < 0 || i + dir >= blocks.length) return;
    const arr = [...blocks];
    [arr[i], arr[i + dir]] = [arr[i + dir], arr[i]];
    onChange(arr.map((b, j) => ({ ...b, blockOrder: j })));
  };

  return (
    <div className="flex flex-col gap-2.5">
      {blocks.map((block, idx) => (
        <div key={block.id} className="rounded-xl p-3"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
          {/* Header row */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-fs-body w-5 text-center flex-shrink-0 font-bold" style={{ color: "rgba(255,255,255,0.25)" }}>
              {idx + 1}
            </span>
            <input type="text" value={block.characterName}
              onChange={(e) => update(block.id, { characterName: e.target.value })}
              placeholder="Character" className="flex-1 px-2.5 py-1.5 rounded-lg text-fs-body text-white outline-none"
              style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }} />
            <select value={block.assignedVoiceId}
              onChange={(e) => update(block.id, { assignedVoiceId: e.target.value })}
              className="px-2 py-1.5 rounded-lg text-fs-body outline-none"
              style={{ background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.22)", color: "#a78bfa", maxWidth: 120 }}>
              {PRESET_VOICES.map((v) => (
                <option key={v.id} value={v.id} style={{ background: "#0D1120" }}>{v.emoji} {v.id}</option>
              ))}
            </select>
            <button onClick={() => move(block.id, -1)} disabled={idx === 0}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-fs-body"
              style={{ background: "rgba(255,255,255,0.05)", color: idx === 0 ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.45)" }}>↑</button>
            <button onClick={() => move(block.id, 1)} disabled={idx === blocks.length - 1}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-fs-body"
              style={{ background: "rgba(255,255,255,0.05)", color: idx === blocks.length - 1 ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.45)" }}>↓</button>
            <button onClick={() => remove(block.id)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-fs-body"
              style={{ background: "rgba(236,72,153,0.09)", color: "rgba(236,72,153,0.65)" }}>✕</button>
          </div>
          {/* Text */}
          <textarea value={block.textPayload}
            onChange={(e) => update(block.id, { textPayload: e.target.value })}
            placeholder="Dialogue or narration…" rows={3}
            className="w-full px-2.5 py-2 rounded-lg text-fs-body text-white outline-none resize-none"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }} />
        </div>
      ))}
      <button onClick={add}
        className="w-full py-2.5 rounded-xl text-fs-body font-medium transition-all active:scale-[0.98]"
        style={{ background: "rgba(79,195,247,0.06)", border: "1px dashed rgba(79,195,247,0.28)", color: "#4fc3f7" }}>
        + Add Block
      </button>
    </div>
  );
}

// ─── Job Progress ──────────────────────────────────────────────────────────────

function JobProgress({ status, step, progress, error }: { status: string; step: string; progress: number; error?: string }) {
  const done = status === "done";
  const err = status === "error";
  return (
    <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${err ? "rgba(236,72,153,0.3)" : done ? "rgba(79,195,247,0.3)" : "rgba(255,255,255,0.08)"}` }}>
      <div className="flex justify-between mb-2">
        <span className="text-white text-fs-body">{step || "Starting…"}</span>
        <span className="text-fs-body font-bold" style={{ color: err ? "#EC4899" : "#4fc3f7" }}>{progress}%</span>
      </div>
      <div className="w-full rounded-full overflow-hidden" style={{ height: 5, background: "rgba(255,255,255,0.07)" }}>
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${progress}%`, background: err ? "#EC4899" : "linear-gradient(90deg,#4fc3f7,#a78bfa)" }} />
      </div>
      {err && error && <p className="text-fs-body mt-2" style={{ color: "#EC4899" }}>{error}</p>}
    </div>
  );
}

// ─── Cost Analysis ────────────────────────────────────────────────────────────

interface CostData {
  totals: {
    gemini_tokens: number; gemini_calls: number;
    gemini_tts_chars: number; gemini_tts_calls: number;
    gemini_image_calls: number;
    el_tts_chars: number; el_tts_calls: number;
    el_sfx_chars: number; el_sfx_calls: number;
    pollinations_calls: number;
  };
  storyCount: number; publicCount: number; privateCount: number; totalDurationSec: number;
}

interface StoryCost {
  id: string; title: string; isPublic: boolean;
  durationSeconds: number; blockCount: number;
  geminiChars: number; elChars: number;
  estimatedSfx: number; estimatedTokens: number; hasCover: boolean;
  costs: { geminiTextGen: number; geminiTts: number; geminiImage: number; elTts: number; elSfx: number; total: number };
}
interface LibraryCostData {
  stories: StoryCost[];
  totals: { durationSeconds: number; blockCount: number; geminiChars: number; elChars: number; estimatedSfx: number; estimatedTokens: number; coverCount: number; costs: StoryCost["costs"] };
  storyCount: number;
}

function fmtCost(usd: number): string {
  if (usd < 0.001) return `<$0.001`;
  if (usd < 0.01)  return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(3)}`;
}
function fmtDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function SummaryChips({ items }: { items: { label: string; value: string | number; sub: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl px-3 py-3"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <p className="text-fs-body" style={{ color: "rgba(255,255,255,0.35)" }}>{item.label}</p>
          <p className="text-white font-bold text-fs-subtitle">{item.value}</p>
          <p className="text-fs-body" style={{ color: "rgba(255,255,255,0.25)" }}>{item.sub}</p>
        </div>
      ))}
    </div>
  );
}

function CostRow({ label, usage, cost, sub }: { label: string; usage: string; cost: number; sub?: string }) {
  return (
    <div className="flex items-center gap-3 py-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <div className="flex-1 min-w-0">
        <p className="text-white text-fs-body">{label}</p>
        {sub && <p className="text-fs-body" style={{ color: "rgba(255,255,255,0.3)" }}>{sub}</p>}
      </div>
      <span className="text-fs-body flex-shrink-0" style={{ color: "rgba(255,255,255,0.4)", minWidth: 80, textAlign: "right" }}>{usage}</span>
      <span className="text-fs-body font-bold flex-shrink-0" style={{ color: "#4fc3f7", minWidth: 70, textAlign: "right" }}>{fmtCost(cost)}</span>
    </div>
  );
}

function BreakdownTable({ rows, total }: { rows: { label: string; usage: string; cost: number; sub?: string }[]; total: number }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
      <div className="flex items-center gap-3 px-3 py-2"
        style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <span className="flex-1 text-fs-body font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.3)" }}>Service</span>
        <span className="text-fs-body font-bold uppercase tracking-widest flex-shrink-0" style={{ color: "rgba(255,255,255,0.3)", minWidth: 80, textAlign: "right" }}>Usage</span>
        <span className="text-fs-body font-bold uppercase tracking-widest flex-shrink-0" style={{ color: "rgba(255,255,255,0.3)", minWidth: 70, textAlign: "right" }}>Cost</span>
      </div>
      <div className="px-3">
        {rows.map((r) => <CostRow key={r.label} {...r} />)}
        <div className="flex items-center gap-3 py-3">
          <span className="flex-1 text-white font-bold text-fs-body">Total estimated</span>
          <span style={{ minWidth: 80 }} />
          <span className="font-bold flex-shrink-0"
            style={{ color: "#a78bfa", fontSize: "var(--fs-subtitle)", minWidth: 70, textAlign: "right" }}>
            {fmtCost(total)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Mode A: API usage tracker (cumulative) ────────────────────────────────────
function UsageMode({ data, onRefresh }: { data: CostData; onRefresh: () => void }) {
  const { totals, storyCount, publicCount, privateCount, totalDurationSec } = data;
  const totalMinutes = totalDurationSec / 60;
  const costs = {
    gemini_text:  totals.gemini_tokens      * PRICING.gemini_token,
    gemini_tts:   totals.gemini_tts_chars   * PRICING.gemini_tts_char,
    gemini_image: totals.gemini_image_calls * PRICING.gemini_image,
    el_tts:       totals.el_tts_chars       * PRICING.el_tts_char,
    el_sfx:       totals.el_sfx_calls       * PRICING.el_sfx_call,
  };
  const totalCost   = Object.values(costs).reduce((s, c) => s + c, 0);
  const totalTts    = totals.gemini_tts_chars + totals.el_tts_chars;
  const elPct       = totalTts > 0 ? Math.round((totals.el_tts_chars / totalTts) * 100) : 0;

  return (
    <div className="flex flex-col gap-4">
      <SummaryChips items={[
        { label: "Total stories",  value: storyCount,                            sub: `${publicCount} public · ${privateCount} private` },
        { label: "Total audio",    value: fmtDuration(totalDurationSec),          sub: `${totalMinutes.toFixed(1)} min` },
        { label: "Cost / minute",  value: fmtCost(totalCost / (totalMinutes||1)), sub: "cumulative average" },
        { label: "Cost / story",   value: fmtCost(totalCost / (storyCount||1)),   sub: "cumulative average" },
      ]} />

      <div className="rounded-xl px-3 py-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <p className="text-fs-body font-bold mb-2" style={{ color: "rgba(255,255,255,0.35)" }}>TTS Voice Split</p>
        <div className="flex rounded-full overflow-hidden mb-2" style={{ height: 8 }}>
          <div style={{ width: `${100 - elPct}%`, background: "linear-gradient(90deg,#4fc3f7,#a78bfa)" }} />
          <div style={{ width: `${elPct}%`, background: "linear-gradient(90deg,#f59e0b,#EC4899)" }} />
        </div>
        <div className="flex justify-between">
          <span className="text-fs-body" style={{ color: "#4fc3f7" }}>Gemini {100-elPct}% — {fmtNum(totals.gemini_tts_chars)} chars</span>
          <span className="text-fs-body" style={{ color: "#f59e0b" }}>EL {elPct}% — {fmtNum(totals.el_tts_chars)} chars</span>
        </div>
      </div>

      <BreakdownTable total={totalCost} rows={[
        { label: "Gemini Text Gen",  usage: `${fmtNum(totals.gemini_tokens)} tokens`, cost: costs.gemini_text,  sub: `${totals.gemini_calls} calls · $0.40/1M tokens` },
        { label: "Gemini TTS",       usage: `${fmtNum(totals.gemini_tts_chars)} chars`, cost: costs.gemini_tts, sub: `${totals.gemini_tts_calls} calls · $0.10/1M chars` },
        { label: "Gemini Images",    usage: `${totals.gemini_image_calls} images`,    cost: costs.gemini_image, sub: "$0.04/image (Imagen)" },
        { label: "ElevenLabs TTS",   usage: `${fmtNum(totals.el_tts_chars)} chars`,   cost: costs.el_tts,       sub: `${totals.el_tts_calls} calls · $0.20/1K chars` },
        { label: "ElevenLabs SFX",   usage: `${totals.el_sfx_calls} effects`,         cost: costs.el_sfx,       sub: `${fmtNum(totals.el_sfx_chars)} prompt chars · $0.08/effect` },
      ]} />

      <p className="text-center text-fs-body" style={{ color: "rgba(255,255,255,0.2)" }}>
        Includes test runs, retries, voice previews — not just produced stories
      </p>
      <button onClick={onRefresh} className="text-fs-body px-4 py-2 rounded-xl transition-all active:scale-95 self-center"
        style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.08)" }}>
        ↻ Refresh
      </button>
    </div>
  );
}

// ── Mode B: Library script analysis (bottom-up per story) ────────────────────
function LibraryMode({ data, onRefresh }: { data: LibraryCostData; onRefresh: () => void }) {
  const { stories, totals, storyCount } = data;
  const totalMinutes = totals.durationSeconds / 60;
  const [expanded, setExpanded] = useState<string | null>(null);
  const totalTts = totals.geminiChars + totals.elChars;
  const elPct    = totalTts > 0 ? Math.round((totals.elChars / totalTts) * 100) : 0;

  return (
    <div className="flex flex-col gap-4">
      <SummaryChips items={[
        { label: "Stories analysed", value: storyCount,                                  sub: `${totals.coverCount} with cover` },
        { label: "Total audio",      value: fmtDuration(totals.durationSeconds),          sub: `${totalMinutes.toFixed(1)} min` },
        { label: "Cost / minute",    value: fmtCost(totals.costs.total / (totalMinutes||1)), sub: "script-based estimate" },
        { label: "Cost / story",     value: fmtCost(totals.costs.total / (storyCount||1)),   sub: "script-based estimate" },
      ]} />

      <div className="rounded-xl px-3 py-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <p className="text-fs-body font-bold mb-2" style={{ color: "rgba(255,255,255,0.35)" }}>TTS Voice Split (from blocks)</p>
        <div className="flex rounded-full overflow-hidden mb-2" style={{ height: 8 }}>
          <div style={{ width: `${100-elPct}%`, background: "linear-gradient(90deg,#4fc3f7,#a78bfa)" }} />
          <div style={{ width: `${elPct}%`,     background: "linear-gradient(90deg,#f59e0b,#EC4899)" }} />
        </div>
        <div className="flex justify-between">
          <span className="text-fs-body" style={{ color: "#4fc3f7" }}>Gemini {100-elPct}% — {fmtNum(totals.geminiChars)} chars</span>
          <span className="text-fs-body" style={{ color: "#f59e0b" }}>EL {elPct}% — {fmtNum(totals.elChars)} chars</span>
        </div>
      </div>

      <BreakdownTable total={totals.costs.total} rows={[
        { label: "Gemini Text Gen",  usage: `~${fmtNum(totals.estimatedTokens)} tokens`,   cost: totals.costs.geminiTextGen, sub: "estimated: script gen + drama plan per story" },
        { label: "Gemini TTS",       usage: `${fmtNum(totals.geminiChars)} chars`,          cost: totals.costs.geminiTts,     sub: "actual chars from blocks · $0.10/1M" },
        { label: "Gemini Images",    usage: `${totals.coverCount} covers`,                  cost: totals.costs.geminiImage,   sub: "$0.04/image" },
        { label: "ElevenLabs TTS",   usage: `${fmtNum(totals.elChars)} chars`,              cost: totals.costs.elTts,         sub: "cloned voice chars from blocks · $0.20/1K" },
        { label: "ElevenLabs SFX",   usage: `~${totals.estimatedSfx} effects`,              cost: totals.costs.elSfx,         sub: "estimated from duration + block count · $0.08/effect" },
      ]} />

      {/* Per-story breakdown */}
      <p className="text-fs-body font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.28)" }}>Per Story</p>
      <div className="flex flex-col gap-1.5">
        {[...stories].sort((a, b) => b.costs.total - a.costs.total).map((s) => (
          <div key={s.id}>
            <button
              onClick={() => setExpanded(expanded === s.id ? null : s.id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
              style={{ background: expanded === s.id ? "rgba(79,195,247,0.07)" : "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <span className="text-fs-body flex-shrink-0" style={{ color: "rgba(255,255,255,0.25)" }}>
                {s.isPublic ? "🌍" : "🔒"}
              </span>
              <span className="flex-1 text-white text-fs-body truncate">{s.title}</span>
              <span className="text-fs-body flex-shrink-0" style={{ color: "rgba(255,255,255,0.35)" }}>
                {fmtDuration(s.durationSeconds)}
              </span>
              <span className="text-fs-body font-bold flex-shrink-0" style={{ color: "#4fc3f7", minWidth: 60, textAlign: "right" }}>
                {fmtCost(s.costs.total)}
              </span>
            </button>
            {expanded === s.id && (
              <div className="mx-3 mt-1 mb-1 rounded-xl px-3 py-2 flex flex-col gap-1"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                {[
                  ["Text gen",    `~${fmtNum(s.estimatedTokens)} tokens`, s.costs.geminiTextGen],
                  ["Gemini TTS",  `${fmtNum(s.geminiChars)} chars`,        s.costs.geminiTts],
                  ["Cover image", s.hasCover ? "1 image" : "none",          s.costs.geminiImage],
                  ["EL TTS",      `${fmtNum(s.elChars)} chars`,             s.costs.elTts],
                  ["EL SFX",      `~${s.estimatedSfx} effects`,             s.costs.elSfx],
                ].map(([name, usage, cost]) => (
                  <div key={name as string} className="flex items-center gap-2">
                    <span className="flex-1 text-fs-body" style={{ color: "rgba(255,255,255,0.4)" }}>{name as string}</span>
                    <span className="text-fs-body" style={{ color: "rgba(255,255,255,0.25)" }}>{usage as string}</span>
                    <span className="text-fs-body font-bold" style={{ color: "#4fc3f7", minWidth: 60, textAlign: "right" }}>{fmtCost(cost as number)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <p className="text-center text-fs-body" style={{ color: "rgba(255,255,255,0.2)" }}>
        Derived from script blocks · SFX & text-gen are estimated
      </p>
      <button onClick={onRefresh} className="text-fs-body px-4 py-2 rounded-xl transition-all active:scale-95 self-center"
        style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.08)" }}>
        ↻ Refresh
      </button>
    </div>
  );
}

// ── Outer shell with mode toggle ──────────────────────────────────────────────
function CostAnalysis({
  usageData, libraryData, usageLoading, libraryLoading, onLoadUsage, onLoadLibrary,
}: {
  usageData: CostData | null; libraryData: LibraryCostData | null;
  usageLoading: boolean; libraryLoading: boolean;
  onLoadUsage: () => void; onLoadLibrary: () => void;
}) {
  const [mode, setMode] = useState<"usage" | "library">("library");

  const loading = mode === "usage" ? usageLoading : libraryLoading;
  const hasData = mode === "usage" ? !!usageData : !!libraryData;
  const onLoad  = mode === "usage" ? onLoadUsage : onLoadLibrary;

  return (
    <div className="flex flex-col gap-4">
      {/* Mode toggle */}
      <div className="flex gap-2">
        {(["library", "usage"] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)}
            className="px-4 py-2 rounded-full text-fs-body font-medium transition-all"
            style={mode === m
              ? { background: "rgba(79,195,247,0.15)", border: "1px solid rgba(79,195,247,0.4)", color: "#4fc3f7" }
              : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.35)" }}>
            {m === "library" ? "📖 Script Analysis" : "📊 API Usage"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {[0,1,2,3,4].map((i) => <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />)}
        </div>
      ) : !hasData ? (
        <button onClick={onLoad}
          className="w-full py-3 rounded-xl text-fs-body font-medium transition-all active:scale-[0.98]"
          style={{ background: "rgba(79,195,247,0.07)", border: "1px solid rgba(79,195,247,0.25)", color: "#4fc3f7" }}>
          Load {mode === "library" ? "Script Analysis" : "API Usage"}
        </button>
      ) : mode === "library" ? (
        <LibraryMode data={libraryData!} onRefresh={onLoadLibrary} />
      ) : (
        <UsageMode data={usageData!} onRefresh={onLoadUsage} />
      )}
    </div>
  );
}

// ─── Existing stories list ─────────────────────────────────────────────────────

function ClassicsList({ classics, loading }: { classics: ClassicMeta[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />
        ))}
      </div>
    );
  }
  if (!classics.length) {
    return <p className="text-fs-body" style={{ color: "rgba(255,255,255,0.2)" }}>No public stories yet.</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      {classics.map((c) => (
        <div key={c.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <span className="text-fs-subtitle flex-shrink-0">{c.emoji}</span>
          <div className="flex-1 min-w-0">
            <p className="text-white text-fs-body font-medium truncate">{c.title}</p>
            <p className="text-fs-body truncate" style={{ color: "rgba(255,255,255,0.28)" }}>{c.tagline}</p>
          </div>
          <span className="text-fs-body flex-shrink-0 px-2 py-0.5 rounded-full font-bold"
            style={{
              background: c.status === "ready" ? "rgba(79,195,247,0.1)" : "rgba(255,255,255,0.04)",
              color: c.status === "ready" ? "#4fc3f7" : "rgba(255,255,255,0.25)",
              border: c.status === "ready" ? "1px solid rgba(79,195,247,0.22)" : "1px solid rgba(255,255,255,0.07)",
            }}>
            {c.status === "ready" ? "✓ ready" : "pending"}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── SFX Library Seeder ────────────────────────────────────────────────────────

function SfxLibrarySeeder() {
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [result, setResult] = useState<{ total: number; seeded: number; skipped: number; alreadyInLibrary: number } | null>(null);
  const [error, setError] = useState("");

  const handleSeed = async () => {
    setStatus("running");
    setResult(null);
    setError("");
    try {
      const res = await fetch("/api/admin/seed-sfx-library", { method: "POST", cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Seeding failed");
      setResult(data as typeof result);
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setStatus("error");
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-fs-body" style={{ color: "rgba(255,255,255,0.35)" }}>
        Scan all existing SFX in story_elements, deduplicate by description, embed each one with
        Gemini text-embedding-004, and insert into the global sfx_library for cross-story reuse.
      </p>

      {result && status === "done" && (
        <div className="rounded-xl px-4 py-3 flex flex-col gap-1"
          style={{ background: "rgba(79,195,247,0.06)", border: "1px solid rgba(79,195,247,0.2)" }}>
          <p className="text-white font-bold text-fs-body">✅ Done</p>
          <p className="text-fs-body" style={{ color: "rgba(255,255,255,0.45)" }}>
            {result.total} unique SFX found · {result.alreadyInLibrary} already in library · {result.seeded} newly added · {result.skipped} failed
          </p>
        </div>
      )}

      {status === "error" && (
        <p className="text-fs-body" style={{ color: "#EC4899" }}>{error}</p>
      )}

      <button onClick={handleSeed} disabled={status === "running"}
        className="w-full py-3 rounded-xl text-fs-body font-bold transition-all active:scale-[0.98] disabled:opacity-50"
        style={{ background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.3)", color: "#a78bfa" }}>
        {status === "running" ? "Seeding… (embedding takes a moment)" : "🔊 Seed SFX Library from story_elements"}
      </button>
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();

  // ── Add Story fields ──────────────────────────────────────────────────────
  const [addTitle, setAddTitle]           = useState("");
  const [addScript, setAddScript]         = useState("");
  const [addIsPublic, setAddIsPublic]     = useState(true);
  const [addCategory, setAddCategory]     = useState<"classics" | "community">("classics");
  const [parsedBlocks, setParsedBlocks]   = useState<ScriptBlock[]>([]);
  const [sfxSuggestions, setSfxSuggestions] = useState<Array<{ afterBlockIndex: number; description: string; reason: string }>>([]);
  const [validationIssues, setValidationIssues] = useState<string[]>([]);
  const [processState, setProcessState]   = useState<"idle" | "processing" | "done" | "error">("idle");
  const [processError, setProcessError]   = useState("");
  const [addProduceLog, setAddProduceLog] = useState<string[]>([]);
  const [addProducing, setAddProducing]   = useState(false);
  const [addProduceError, setAddProduceError] = useState("");

  // ── Production job ─────────────────────────────────────────────────────────
  const [jobId, setJobId]               = useState<string | null>(null);
  const [job, setJob]                   = useState<{ status: string; step: string; progress: number; audioUrl?: string; coverUrl?: string; error?: string; title?: string } | null>(null);
  const pollRef                         = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Classics list ─────────────────────────────────────────────────────────
  const [classics, setClassics]         = useState<ClassicMeta[]>([]);
  const [classicsLoading, setClassicsLoading] = useState(true);

  const loadClassics = useCallback(() => {
    fetch("/api/classics", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setClassics(d as ClassicMeta[]); })
      .catch(() => {})
      .finally(() => setClassicsLoading(false));
  }, []);

  useEffect(() => { loadClassics(); }, [loadClassics]);

  // ── Cost analysis ─────────────────────────────────────────────────────────
  const [costData, setCostData]           = useState<CostData | null>(null);
  const [costLoading, setCostLoading]     = useState(false);
  const [libraryData, setLibraryData]     = useState<LibraryCostData | null>(null);
  const [libraryLoading, setLibraryLoading] = useState(false);

  const loadCostAnalysis = useCallback(() => {
    setCostLoading(true);
    fetch("/api/admin/cost-analysis", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setCostData(d as CostData))
      .catch(() => {})
      .finally(() => setCostLoading(false));
  }, []);

  const loadLibraryAnalysis = useCallback(() => {
    setLibraryLoading(true);
    fetch("/api/admin/cost-analysis/library", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setLibraryData(d as LibraryCostData))
      .catch(() => {})
      .finally(() => setLibraryLoading(false));
  }, []);

  // Job polling
  useEffect(() => {
    if (!jobId) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/drama-status/${jobId}`, { cache: "no-store" });
        if (!res.ok) return;
        const j = await res.json();
        setJob(j);
        if (j.status === "done" || j.status === "error") {
          clearInterval(pollRef.current!);
          setAddProducing(false);
          if (j.status === "done") loadClassics();
        }
      } catch {}
    }, 2500);
    return () => clearInterval(pollRef.current!);
  }, [jobId, loadClassics]);

  // ── Script parser ─────────────────────────────────────────────────────────
  const CHAR_VOICE_POOL = ["Puck", "Kore", "Charon", "Fenrir", "Leda", "Orus", "Zephyr", "Autonoe"];
  function parseScriptText(raw: string): ScriptBlock[] {
    const regex = /\[([^\]]+)\]/g;
    const out: ScriptBlock[] = [];
    const voiceMap: Record<string, string> = {};
    let voiceIdx = 0;
    let lastChar = "";
    let lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(raw)) !== null) {
      if (lastChar) {
        const text = raw.slice(lastIndex, m.index).trim();
        if (text) {
          if (!voiceMap[lastChar]) {
            voiceMap[lastChar] = lastChar.toLowerCase() === "narrator"
              ? "Aoede"
              : CHAR_VOICE_POOL[voiceIdx++ % CHAR_VOICE_POOL.length];
          }
          out.push({ id: uid(), blockOrder: out.length, characterName: lastChar, assignedVoiceId: voiceMap[lastChar], textPayload: text });
        }
      }
      lastChar = m[1].trim();
      lastIndex = regex.lastIndex;
    }
    if (lastChar) {
      const text = raw.slice(lastIndex).trim();
      if (text) {
        if (!voiceMap[lastChar]) {
          voiceMap[lastChar] = lastChar.toLowerCase() === "narrator"
            ? "Aoede"
            : CHAR_VOICE_POOL[voiceIdx++ % CHAR_VOICE_POOL.length];
        }
        out.push({ id: uid(), blockOrder: out.length, characterName: lastChar, assignedVoiceId: voiceMap[lastChar], textPayload: text });
      }
    }
    return out;
  }

  // ── Process Script ─────────────────────────────────────────────────────────
  const handleProcessScript = async () => {
    if (!addScript.trim()) return;
    setProcessState("processing");
    setProcessError("");
    setSfxSuggestions([]);
    setValidationIssues([]);
    const blocks = parseScriptText(addScript);
    if (!blocks.length) {
      setProcessState("error");
      setProcessError("Could not parse any blocks. Use [Character Name] to mark each speaker.");
      return;
    }
    setParsedBlocks(blocks);
    const rawBlocks = blocks.map((b) => ({ characterName: b.characterName, textPayload: b.textPayload }));
    const [valRes, sfxRes] = await Promise.all([
      fetch("/api/validate-script", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ blocks: rawBlocks }) }),
      fetch("/api/admin/suggest-sfx", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ blocks: rawBlocks, title: addTitle }) }),
    ]);
    const valData = await valRes.json();
    const sfxData = await sfxRes.json();
    if (!valData.ok && Array.isArray(valData.issues)) setValidationIssues(valData.issues as string[]);
    if (Array.isArray(sfxData.suggestions)) setSfxSuggestions(sfxData.suggestions as typeof sfxSuggestions);
    setProcessState("done");
  };

  // ── Produce Story ──────────────────────────────────────────────────────────
  const handleProduceStory = async () => {
    const blocks = parsedBlocks.filter((b) => b.textPayload.trim());
    if (!addTitle.trim()) { setAddProduceError("Title is required."); return; }
    if (!blocks.length)  { setAddProduceError("Process the script first."); return; }
    setAddProducing(true);
    setAddProduceLog([]);
    setAddProduceError("");
    setJob(null);
    setJobId(null);
    const log = (msg: string) => setAddProduceLog((p) => [...p, msg]);
    try {
      // 1. Classify characters
      log("Classifying characters…");
      const charNames = Array.from(new Set(blocks.map((b) => b.characterName)));
      const classifyRes = await fetch("/api/classify-characters", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characters: charNames, summary: addTitle }),
      });
      const classifyData = await classifyRes.json() as { types?: Record<string, string> };
      const characterTypes = classifyData.types ?? {};

      // 2. Story metadata (summary + age group + cover prompt)
      log("Generating story metadata…");
      const metaRes = await fetch("/api/admin/story-meta", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks: blocks.map((b) => ({ characterName: b.characterName, textPayload: b.textPayload })), title: addTitle }),
      });
      const meta = await metaRes.json() as { summary?: string; ageGroup?: string; coverPrompt?: string };

      // 3. Kick off production
      log("Starting production (audio + cover)…");
      const produceRes = await fetch("/api/produce-drama", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blocks,
          summary: meta.summary ?? "",
          coverPrompt: meta.coverPrompt ?? `${addTitle} — magical Pixar-style children's bedtime illustration`,
          isPublic: addIsPublic,
          isClassic: addIsPublic && addCategory === "classics",
          characterTypes,
          durationMinutes: 5,
        }),
      });
      const produceData = await produceRes.json() as { jobId?: string; error?: string };
      if (!produceRes.ok) throw new Error(produceData.error ?? "Production failed");
      setJobId(produceData.jobId!);
      log("Production running — see progress below…");
    } catch (e) {
      setAddProduceError(e instanceof Error ? e.message : "Unknown error");
      setAddProducing(false);
    }
  };

  const resetAddStory = () => {
    setAddTitle(""); setAddScript(""); setAddIsPublic(true); setAddCategory("classics");
    setParsedBlocks([]); setSfxSuggestions([]); setValidationIssues([]);
    setProcessState("idle"); setProcessError(""); setAddProduceLog([]);
    setAddProducing(false); setAddProduceError(""); setJobId(null); setJob(null);
  };

  // ── Auth gate ──────────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="cosmic-page min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "#4fc3f7 transparent transparent transparent" }} />
      </div>
    );
  }
  if (!user || user.email !== ADMIN_EMAIL) {
    return (
      <div className="cosmic-page min-h-screen flex flex-col items-center justify-center gap-3 text-center px-8">
        <span className="text-5xl">🔐</span>
        <p className="text-white/40 text-fs-body">Admin access only</p>
      </div>
    );
  }

  const isDone  = job?.status === "done";
  const isError = job?.status === "error";

  const [adminTab, setAdminTab] = useState<"factory" | "costs">("factory");

  return (
    <div className="cosmic-page min-h-full pb-40">
      <div className="px-5 pt-12">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-fs-title font-bold"
              style={{ background: "linear-gradient(135deg,#fff 0%,#4fc3f7 50%,#a78bfa 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              Admin
            </h1>
            <p className="text-fs-body mt-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>{user.email}</p>
          </div>
          {adminTab === "factory" && (
            <button onClick={resetAddStory}
              className="text-fs-body px-3 py-1.5 rounded-lg transition-all active:scale-95"
              style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.08)" }}>
              Reset
            </button>
          )}
        </div>

        {/* Tab bar */}
        <div className="flex gap-2 mb-8 p-1 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
          {([
            { id: "factory", label: "➕ Add Story" },
            { id: "costs",   label: "📊 Cost Analysis" },
          ] as const).map((tab) => (
            <button key={tab.id} onClick={() => setAdminTab(tab.id)}
              className="flex-1 py-2.5 rounded-xl text-fs-body font-medium transition-all"
              style={adminTab === tab.id
                ? { background: "rgba(79,195,247,0.15)", border: "1px solid rgba(79,195,247,0.35)", color: "#4fc3f7" }
                : { background: "transparent", border: "1px solid transparent", color: "rgba(255,255,255,0.35)" }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/*  TAB: Factory                                                     */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {adminTab === "factory" && (<>

        {/* ── Visibility ── */}
        <Divider title="Visibility" />
        <div className="flex flex-col gap-4 mb-2">
          <Toggle on={addIsPublic} onToggle={() => setAddIsPublic((v) => !v)}
            label={addIsPublic ? "Public story" : "Private — only visible to you"} />
          {addIsPublic && (
            <div className="flex gap-2">
              {(["classics", "community"] as const).map((cat) => (
                <button key={cat} onClick={() => setAddCategory(cat)}
                  className="flex-1 py-2.5 rounded-xl text-fs-body font-medium transition-all"
                  style={addCategory === cat
                    ? { background: cat === "classics" ? "rgba(251,191,36,0.15)" : "rgba(167,139,250,0.15)", border: `1px solid ${cat === "classics" ? "rgba(251,191,36,0.4)" : "rgba(167,139,250,0.4)"}`, color: cat === "classics" ? "#fbbf24" : "#a78bfa" }
                    : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.3)" }}>
                  {cat === "classics" ? "✨ Classics" : "🌍 Community"}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Title ── */}
        <Divider title="Story Title" />
        <TextInput value={addTitle} onChange={setAddTitle} placeholder="Maya the Bee" />

        {/* ── Script ── */}
        <Divider title="Script" />
        <p className="text-fs-body mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>
          Use <span style={{ color: "#4fc3f7" }}>[Character Name]</span> to mark each speaker. Example:
        </p>
        <div className="rounded-xl px-3 py-2.5 mb-3 text-fs-body leading-relaxed"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.35)", fontFamily: "monospace", fontSize: 12 }}>
          [Narrator] Once upon a time…{"\n"}[Maya] Oh, what's out there?{"\n"}[Miss Cassandra] Stay safe inside, little bee.
        </div>
        <textarea
          value={addScript}
          onChange={(e) => setAddScript(e.target.value)}
          placeholder="Paste or type your script here using [Character Name] markers…"
          rows={12}
          className="w-full px-3 py-2.5 rounded-xl text-white text-fs-body outline-none resize-none"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", fontFamily: "monospace" }}
        />

        {processError && (
          <p className="text-fs-body mt-2" style={{ color: "#EC4899" }}>{processError}</p>
        )}

        <button
          onClick={handleProcessScript}
          disabled={processState === "processing" || !addScript.trim()}
          className="w-full mt-3 py-3 rounded-xl text-fs-body font-bold transition-all active:scale-[0.98] disabled:opacity-40"
          style={{ background: "linear-gradient(135deg,rgba(79,195,247,0.2),rgba(167,139,250,0.2))", border: "1px solid rgba(79,195,247,0.4)", color: "#fff" }}>
          {processState === "processing" ? "Processing…" : "⚙️ Process Script"}
        </button>

        {/* ── Process results ── */}
        {processState === "done" && (
          <>
            {/* Parsed blocks */}
            <Divider title={`${parsedBlocks.length} Parsed Blocks`} />
            <div className="flex flex-col gap-2">
              {parsedBlocks.map((b, i) => {
                const sfxBefore = sfxSuggestions.filter((s) => s.afterBlockIndex === i - 1);
                return (
                  <div key={b.id}>
                    {sfxBefore.map((sfx, si) => (
                      <div key={si} className="flex gap-2 items-start px-3 py-2 rounded-xl mb-1.5"
                        style={{ background: "rgba(167,139,250,0.07)", border: "1px solid rgba(167,139,250,0.2)" }}>
                        <span className="text-fs-body flex-shrink-0" style={{ color: "#a78bfa" }}>🔊</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-fs-body" style={{ color: "#a78bfa", fontWeight: 500 }}>SFX suggestion</p>
                          <p className="text-fs-body leading-snug" style={{ color: "rgba(167,139,250,0.75)" }}>{sfx.description}</p>
                          <p className="text-fs-body mt-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>{sfx.reason}</p>
                        </div>
                      </div>
                    ))}
                    <div className="rounded-xl px-3 py-2.5"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                      <p className="text-fs-body font-medium" style={{ color: "#4fc3f7" }}>{b.characterName}</p>
                      <p className="text-fs-body leading-snug mt-0.5" style={{ color: "rgba(255,255,255,0.6)" }}>{b.textPayload}</p>
                      <p className="text-fs-body mt-1" style={{ color: "rgba(255,255,255,0.22)" }}>Voice: {b.assignedVoiceId}</p>
                    </div>
                  </div>
                );
              })}
              {/* SFX after last block */}
              {sfxSuggestions.filter((s) => s.afterBlockIndex === parsedBlocks.length - 1).map((sfx, si) => (
                <div key={`end-${si}`} className="flex gap-2 items-start px-3 py-2 rounded-xl"
                  style={{ background: "rgba(167,139,250,0.07)", border: "1px solid rgba(167,139,250,0.2)" }}>
                  <span className="text-fs-body flex-shrink-0" style={{ color: "#a78bfa" }}>🔊</span>
                  <div>
                    <p className="text-fs-body" style={{ color: "#a78bfa", fontWeight: 500 }}>SFX (closing)</p>
                    <p className="text-fs-body" style={{ color: "rgba(167,139,250,0.75)" }}>{sfx.description}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Validation issues */}
            {validationIssues.length > 0 && (
              <div className="rounded-xl px-4 py-3 mt-3"
                style={{ background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.25)" }}>
                <p className="text-fs-body font-bold mb-1" style={{ color: "#fbbf24" }}>⚠️ Policy issues to fix</p>
                {validationIssues.map((issue, i) => (
                  <p key={i} className="text-fs-body leading-snug" style={{ color: "rgba(251,191,36,0.75)" }}>• {issue}</p>
                ))}
              </div>
            )}

            {validationIssues.length === 0 && (
              <p className="text-center text-fs-body mt-2" style={{ color: "rgba(79,195,247,0.6)" }}>
                ✓ Script passes policy check
              </p>
            )}
          </>
        )}

        {/* ── Produce Story ── */}
        {processState === "done" && !isDone && (
          <>
            <Divider title="Produce Story" />

            {addProduceLog.length > 0 && (
              <div className="rounded-xl px-3 py-2.5 mb-3 flex flex-col gap-1"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                {addProduceLog.map((msg, i) => (
                  <p key={i} className="text-fs-body" style={{ color: "rgba(255,255,255,0.4)" }}>→ {msg}</p>
                ))}
              </div>
            )}

            {job && (
              <div className="mb-4">
                <JobProgress status={job.status} step={job.step} progress={job.progress} error={job.error} />
              </div>
            )}

            {addProduceError && (
              <p className="text-fs-body mb-3" style={{ color: "#EC4899" }}>{addProduceError}</p>
            )}

            <button
              onClick={handleProduceStory}
              disabled={addProducing}
              className="w-full py-4 rounded-2xl text-fs-subtitle font-bold transition-all active:scale-[0.98] disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,rgba(79,195,247,0.28),rgba(167,139,250,0.28))", border: "1px solid rgba(79,195,247,0.45)", color: "#fff", boxShadow: "0 4px 24px rgba(79,195,247,0.18)" }}>
              {addProducing ? "Working…" : "🚀 Produce Story"}
            </button>
          </>
        )}

        {/* ── Done ── */}
        {isDone && (
          <div className="mt-4 rounded-xl p-4 flex flex-col gap-3"
            style={{ background: "rgba(79,195,247,0.06)", border: "1px solid rgba(79,195,247,0.22)" }}>
            <p className="text-white font-bold text-fs-body">✅ Story produced{job?.title ? ` — "${job.title}"` : ""}</p>
            {job?.coverUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={job.coverUrl} alt="Cover" className="w-28 rounded-xl" />
            )}
            {job?.audioUrl && (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <audio controls src={job.audioUrl} className="w-full" style={{ height: 36 }} />
            )}
            <button onClick={resetAddStory}
              className="text-fs-body px-4 py-2 rounded-xl font-medium transition-all active:scale-[0.98]"
              style={{ background: "rgba(79,195,247,0.12)", border: "1px solid rgba(79,195,247,0.3)", color: "#4fc3f7" }}>
              Add another story
            </button>
          </div>
        )}

        {/* ── SFX Library seeder ── */}
        <Divider title="SFX Library" />
        <SfxLibrarySeeder />

        </>)}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/*  TAB: Cost Analysis                                               */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {adminTab === "costs" && (
          <CostAnalysis
            usageData={costData}
            libraryData={libraryData}
            usageLoading={costLoading}
            libraryLoading={libraryLoading}
            onLoadUsage={loadCostAnalysis}
            onLoadLibrary={loadLibraryAnalysis}
          />
        )}

      </div>
    </div>
  );
}
