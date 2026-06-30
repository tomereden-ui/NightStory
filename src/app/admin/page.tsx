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

  // ── Story fields ──────────────────────────────────────────────────────────
  const [title, setTitle]               = useState("");
  const [emoji, setEmoji]               = useState("🌙");
  const [summary, setSummary]           = useState("");
  const [language, setLanguage]         = useState("en");
  const [isPublic, setIsPublic]         = useState(true);
  const [coverPrompt, setCoverPrompt]   = useState("");
  const [durationMinutes, setDuration]  = useState(5);

  // ── Script fields ─────────────────────────────────────────────────────────
  const [scriptMode, setScriptMode]     = useState<"auto" | "manual">("auto");
  const [promptText, setPromptText]     = useState("");
  const [blocks, setBlocks]             = useState<ScriptBlock[]>([makeBlock(0)]);
  const [generating, setGenerating]     = useState(false);
  const [genError, setGenError]         = useState("");

  // ── Production ────────────────────────────────────────────────────────────
  const [jobId, setJobId]               = useState<string | null>(null);
  const [job, setJob]                   = useState<{ status: string; step: string; progress: number; audioUrl?: string; coverUrl?: string; error?: string; title?: string } | null>(null);
  const [producing, setProducing]       = useState(false);
  const [produceError, setProduceError] = useState("");
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
          setProducing(false);
          if (j.status === "done") loadClassics();
        }
      } catch {}
    }, 2500);
    return () => clearInterval(pollRef.current!);
  }, [jobId, loadClassics]);

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

  // ── Generate script ────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!promptText.trim()) return;
    setGenerating(true);
    setGenError("");
    try {
      const res = await fetch("/api/generate-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "prompt",
          promptText: promptText.trim(),
          primaryVoiceId: "Aoede",
          durationMinutes,
          language,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      if (data.blocks?.length)  setBlocks(data.blocks as ScriptBlock[]);
      if (data.title && !title) setTitle(data.title as string);
      if (data.summary && !summary) setSummary(data.summary as string);
      if (data.coverPrompt && !coverPrompt) setCoverPrompt(data.coverPrompt as string);
      setScriptMode("manual");
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setGenerating(false);
    }
  };

  // ── Produce ────────────────────────────────────────────────────────────────
  const handleProduce = async () => {
    const valid = blocks.filter((b) => b.textPayload.trim());
    if (!title.trim())   { setProduceError("Title is required."); return; }
    if (!valid.length)   { setProduceError("Script needs at least one block with text."); return; }
    setProducing(true);
    setProduceError("");
    setJob(null);
    setJobId(null);
    try {
      const res = await fetch("/api/produce-drama", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blocks: valid,
          summary: summary.trim() || undefined,
          durationMinutes,
          coverPrompt: coverPrompt.trim() || `${emoji} ${title} — illustrated children's storybook scene`,
          isPublic,
          language,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to start production");
      setJobId(data.jobId as string);
    } catch (e) {
      setProduceError(e instanceof Error ? e.message : "Unknown error");
      setProducing(false);
    }
  };

  const handleReset = () => {
    setTitle(""); setEmoji("🌙"); setSummary(""); setLanguage("en");
    setIsPublic(true); setCoverPrompt(""); setDuration(5);
    setPromptText(""); setBlocks([makeBlock(0)]); setScriptMode("auto");
    setJobId(null); setJob(null); setProduceError(""); setGenError("");
  };

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
            <button onClick={handleReset}
              className="text-fs-body px-3 py-1.5 rounded-lg transition-all active:scale-95"
              style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.08)" }}>
              Reset
            </button>
          )}
        </div>

        {/* Tab bar */}
        <div className="flex gap-2 mb-8 p-1 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
          {([
            { id: "factory", label: "🏭 Story Factory" },
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

        {/* SECTION 1 — Story record fields */}
        <Divider title="Story Record" />

        <div className="flex gap-3 mb-4">
          <div className="flex-1">
            <Label>Title</Label>
            <TextInput value={title} onChange={setTitle} placeholder="Cinderella" />
          </div>
          <div style={{ width: 72 }}>
            <Label>Emoji</Label>
            <TextInput value={emoji} onChange={setEmoji} placeholder="🌙" />
          </div>
        </div>

        <div className="mb-4">
          <Label>Summary</Label>
          <TextInput value={summary} onChange={setSummary}
            placeholder="A kind girl who dreams of the royal ball…" rows={2} />
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <Label>Language</Label>
            <Select value={language} onChange={setLanguage}
              options={LANGUAGES.map((l) => ({ value: l.code, label: l.label }))} />
          </div>
          <div>
            <Label>Duration</Label>
            <Select value={String(durationMinutes)} onChange={(v) => setDuration(Number(v))}
              options={[2, 3, 4, 5, 7, 10].map((m) => ({ value: String(m), label: `${m} min` }))} />
          </div>
        </div>

        <div className="mb-4">
          <Label>Cover prompt</Label>
          <TextInput value={coverPrompt} onChange={setCoverPrompt}
            placeholder="A magical castle at night with glowing stars and a golden carriage…" rows={2} />
        </div>

        <Toggle on={isPublic} onToggle={() => setIsPublic((v) => !v)}
          label={isPublic ? "Public — visible in Classics / Community" : "Private — only visible to you"} />

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/*  SECTION 2 — Script (blocks)                                     */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <Divider title="Script" />

        {/* Mode toggle */}
        <div className="flex gap-2 mb-4">
          {(["auto", "manual"] as const).map((m) => (
            <button key={m} onClick={() => setScriptMode(m)}
              className="px-4 py-2 rounded-full text-fs-body font-medium transition-all"
              style={scriptMode === m
                ? { background: "rgba(79,195,247,0.15)", border: "1px solid rgba(79,195,247,0.4)", color: "#4fc3f7" }
                : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.35)" }}>
              {m === "auto" ? "✨ Auto-generate" : "✏️ Manual blocks"}
            </button>
          ))}
        </div>

        {/* Auto-generate */}
        {scriptMode === "auto" && (
          <div className="flex flex-col gap-3 mb-2">
            <TextInput value={promptText} onChange={setPromptText}
              placeholder="Describe the story: characters, setting, key plot moments, tone…" rows={4} />
            {genError && <p className="text-fs-body" style={{ color: "#EC4899" }}>{genError}</p>}
            <button onClick={handleGenerate} disabled={generating || !promptText.trim()}
              className="w-full py-3 rounded-xl text-fs-body font-bold transition-all active:scale-[0.98] disabled:opacity-40"
              style={{ background: "linear-gradient(135deg,rgba(79,195,247,0.2),rgba(167,139,250,0.2))", border: "1px solid rgba(79,195,247,0.4)", color: "#fff" }}>
              {generating ? "Generating…" : "✨ Generate Script"}
            </button>
            {blocks.length > 1 && !generating && (
              <p className="text-center text-fs-body" style={{ color: "rgba(255,255,255,0.3)" }}>
                {blocks.length} blocks ready — switch to Manual to review
              </p>
            )}
          </div>
        )}

        {/* Manual block editor */}
        {scriptMode === "manual" && (
          <BlockEditor blocks={blocks} onChange={setBlocks} />
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/*  PRODUCE                                                          */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <Divider title="Produce" />

        {produceError && (
          <p className="text-fs-body mb-3" style={{ color: "#EC4899" }}>{produceError}</p>
        )}

        {job && (
          <div className="mb-4">
            <JobProgress status={job.status} step={job.step} progress={job.progress} error={job.error} />

            {isDone && (
              <div className="mt-3 rounded-xl p-4 flex flex-col gap-3"
                style={{ background: "rgba(79,195,247,0.06)", border: "1px solid rgba(79,195,247,0.22)" }}>
                <p className="text-white font-bold text-fs-body">
                  ✅ Produced{job.title ? ` — "${job.title}"` : ""}
                </p>
                {job.coverUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={job.coverUrl} alt="Cover" className="w-28 rounded-xl" />
                )}
                {job.audioUrl && (
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  <audio controls src={job.audioUrl} className="w-full" style={{ height: 36 }} />
                )}
                <button onClick={handleReset}
                  className="text-fs-body px-4 py-2 rounded-xl font-medium transition-all active:scale-[0.98]"
                  style={{ background: "rgba(79,195,247,0.12)", border: "1px solid rgba(79,195,247,0.3)", color: "#4fc3f7" }}>
                  Create another story
                </button>
              </div>
            )}
          </div>
        )}

        {!isDone && (
          <button onClick={handleProduce} disabled={producing}
            className="w-full py-4 rounded-2xl text-fs-subtitle font-bold transition-all active:scale-[0.98] disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,rgba(79,195,247,0.28),rgba(167,139,250,0.28))", border: "1px solid rgba(79,195,247,0.45)", color: "#fff", boxShadow: "0 4px 24px rgba(79,195,247,0.18)" }}>
            {producing ? "Producing…" : "🚀 Produce Story"}
          </button>
        )}

        {/* Existing public stories */}
        <Divider title={`Public Stories (${classics.length})`} />
        <ClassicsList classics={classics} loading={classicsLoading} />

        {/* SFX Library seeder */}
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
