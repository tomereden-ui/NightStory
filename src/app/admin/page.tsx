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
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className={baseInput} style={{ ...baseStyle, color: "rgba(255,255,255,0.8)" }}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function Divider({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 my-5">
      <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
      <p className="text-fs-body font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.22)" }}>{title}</p>
      <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
    </div>
  );
}

function Toggle({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button onClick={onToggle}
      className="flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all"
      style={{ background: on ? "rgba(79,195,247,0.08)" : "rgba(255,255,255,0.04)", border: on ? "1px solid rgba(79,195,247,0.3)" : "1px solid rgba(255,255,255,0.08)" }}>
      <div className="relative w-9 h-5 rounded-full flex-shrink-0 transition-all" style={{ background: on ? "#4fc3f7" : "rgba(255,255,255,0.15)" }}>
        <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all" style={{ left: on ? "calc(100% - 18px)" : "2px" }} />
      </div>
      <span className="text-fs-body" style={{ color: on ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.4)" }}>{label}</span>
    </button>
  );
}

// ─── Job progress ──────────────────────────────────────────────────────────────

function JobProgress({ status, step, progress, error }: { status: string; step: string; progress: number; error?: string }) {
  const c1 = status === "error" ? "#f87171" : "#4fc3f7";
  const c2 = status === "done"  ? "#34d399" : status === "error" ? "#f87171" : "#a78bfa";
  return (
    <div className="rounded-xl px-4 py-3" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${c1}33` }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-fs-body font-medium" style={{ color: c1 }}>{step}</p>
        <p className="text-fs-body" style={{ color: "rgba(255,255,255,0.3)" }}>{progress}%</p>
      </div>
      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${progress}%`, background: `linear-gradient(90deg,${c1},${c2})` }} />
      </div>
      {error && <p className="text-fs-body mt-2" style={{ color: "#f87171" }}>{error}</p>}
    </div>
  );
}

// ─── Cost Analysis tab ─────────────────────────────────────────────────────────

interface UsageCost {
  period: string;
  gemini_tokens: number; gemini_calls: number;
  gemini_tts_chars: number; gemini_tts_calls: number;
  gemini_image_calls: number;
  el_tts_chars: number; el_tts_calls: number;
  el_sfx_chars: number; el_sfx_calls: number;
  pollinations_calls: number;
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

function CostAnalysis({
  usageData, libraryData, usageLoading, libraryLoading, onLoadUsage, onLoadLibrary,
}: {
  usageData: UsageCost | null;
  libraryData: LibraryCostData | null;
  usageLoading: boolean;
  libraryLoading: boolean;
  onLoadUsage: () => void;
  onLoadLibrary: () => void;
}) {
  const estimatedUsageCost = usageData ? (
    usageData.gemini_tokens    * PRICING.gemini_token +
    usageData.gemini_tts_chars * PRICING.gemini_tts_char +
    usageData.gemini_image_calls * PRICING.gemini_image +
    usageData.el_tts_chars     * PRICING.el_tts_char +
    usageData.el_sfx_calls     * PRICING.el_sfx_call
  ) : 0;

  return (
    <div className="flex flex-col gap-6">

      {/* Usage section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-white font-bold text-fs-body">API Usage (30 days)</p>
          <button onClick={onLoadUsage} disabled={usageLoading}
            className="text-fs-body px-3 py-1.5 rounded-lg transition-all active:scale-95 disabled:opacity-40"
            style={{ background: "rgba(79,195,247,0.1)", border: "1px solid rgba(79,195,247,0.3)", color: "#4fc3f7" }}>
            {usageLoading ? "Loading…" : "Load"}
          </button>
        </div>

        {usageData && (
          <div className="flex flex-col gap-3">
            <SummaryChips items={[
              { label: "Stories",    value: usageData.storyCount, sub: `${usageData.publicCount} public · ${usageData.privateCount} private` },
              { label: "Duration",   value: fmtDuration(usageData.totalDurationSec), sub: "total audio produced" },
              { label: "Est. cost",  value: fmtCost(estimatedUsageCost), sub: "30-day estimate" },
              { label: "Gemini TTS", value: fmtNum(usageData.gemini_tts_chars), sub: `chars · ${usageData.gemini_tts_calls} calls` },
            ]} />

            <div className="rounded-xl px-4 py-3 flex flex-col gap-2"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              {[
                { label: "Gemini text",  value: `${fmtNum(usageData.gemini_tokens)} tokens · ${usageData.gemini_calls} calls`, cost: usageData.gemini_tokens * PRICING.gemini_token },
                { label: "Gemini TTS",   value: `${fmtNum(usageData.gemini_tts_chars)} chars · ${usageData.gemini_tts_calls} calls`, cost: usageData.gemini_tts_chars * PRICING.gemini_tts_char },
                { label: "Gemini images",value: `${usageData.gemini_image_calls} images`, cost: usageData.gemini_image_calls * PRICING.gemini_image },
                { label: "EL TTS",       value: `${fmtNum(usageData.el_tts_chars)} chars · ${usageData.el_tts_calls} calls`, cost: usageData.el_tts_chars * PRICING.el_tts_char },
                { label: "EL SFX",       value: `${usageData.el_sfx_calls} calls`, cost: usageData.el_sfx_calls * PRICING.el_sfx_call },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between">
                  <div>
                    <p className="text-fs-body" style={{ color: "rgba(255,255,255,0.6)" }}>{row.label}</p>
                    <p className="text-fs-body" style={{ color: "rgba(255,255,255,0.25)" }}>{row.value}</p>
                  </div>
                  <p className="text-fs-body font-bold" style={{ color: "#4fc3f7" }}>{fmtCost(row.cost)}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Library section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-white font-bold text-fs-body">Library Cost Breakdown</p>
          <button onClick={onLoadLibrary} disabled={libraryLoading}
            className="text-fs-body px-3 py-1.5 rounded-lg transition-all active:scale-95 disabled:opacity-40"
            style={{ background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.3)", color: "#a78bfa" }}>
            {libraryLoading ? "Loading…" : "Load"}
          </button>
        </div>

        {libraryData && (
          <div className="flex flex-col gap-3">
            <SummaryChips items={[
              { label: "Stories",    value: libraryData.storyCount, sub: "in library" },
              { label: "Duration",   value: fmtDuration(libraryData.totals.durationSeconds), sub: "total audio" },
              { label: "Est. total", value: fmtCost(libraryData.totals.costs.total), sub: "production cost" },
              { label: "Covers",     value: libraryData.totals.coverCount, sub: "images generated" },
            ]} />

            <div className="flex flex-col gap-2">
              {libraryData.stories.slice(0, 20).map((s) => (
                <div key={s.id} className="rounded-xl px-3 py-2.5 flex items-start justify-between gap-3"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-fs-body font-medium truncate">{s.title}</p>
                    <p className="text-fs-body" style={{ color: "rgba(255,255,255,0.3)" }}>
                      {fmtDuration(s.durationSeconds)} · {s.blockCount} blocks · {s.isPublic ? "public" : "private"}
                    </p>
                  </div>
                  <p className="text-fs-body font-bold flex-shrink-0" style={{ color: "#a78bfa" }}>{fmtCost(s.costs.total)}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Script validation ─────────────────────────────────────────────────────────

const CHAR_VOICE_POOL = ["Puck", "Kore", "Charon", "Fenrir", "Leda", "Orus", "Zephyr", "Autonoe"];

function parseScriptText(raw: string): ScriptBlock[] {
  const lines = raw.split("\n").map((l) => l.trim()).filter((l) => l);
  const out: ScriptBlock[] = [];
  const voiceMap: Record<string, string> = {};
  let voiceIdx = 0;

  for (const line of lines) {
    // First [...] on the line is the character/SFX tag; everything after is textPayload
    const m = line.match(/^\[([^\]]+)\](.*)/);
    if (!m) continue;
    const charName = m[1].trim();
    const rest = m[2].trim();

    if (charName.startsWith("SFX")) {
      // Store entire original bracket as textPayload so validate-script sees the full SFX block
      const textPayload = `[${charName}]${rest ? " " + rest : ""}`;
      out.push({ id: uid(), blockOrder: out.length, characterName: "SFX", assignedVoiceId: "", textPayload });
    } else {
      if (!voiceMap[charName]) {
        voiceMap[charName] = charName.toLowerCase() === "narrator"
          ? "Aoede"
          : CHAR_VOICE_POOL[voiceIdx++ % CHAR_VOICE_POOL.length];
      }
      if (rest) {
        out.push({ id: uid(), blockOrder: out.length, characterName: charName, assignedVoiceId: voiceMap[charName], textPayload: rest });
      }
    }
  }
  return out;
}

function validateScript(blocks: ScriptBlock[]): string[] {
  const issues: string[] = [];
  const charNames = blocks.map((b) => b.characterName).filter((n) => n !== "SFX");
  const uniqueChars = Array.from(new Set(charNames));

  // Check character count
  const nonNarratorChars = uniqueChars.filter((n) => n.toLowerCase() !== "narrator");
  if (nonNarratorChars.length > 8) {
    issues.push(`Too many characters (${nonNarratorChars.length}). Max 8 non-narrator characters.`);
  }

  // Check for empty blocks
  const emptyBlocks = blocks.filter((b) => !b.textPayload.trim());
  if (emptyBlocks.length > 0) {
    issues.push(`${emptyBlocks.length} block(s) have empty text.`);
  }

  // Check character names are reasonable
  for (const name of uniqueChars) {
    if (name.length > 30) issues.push(`Character name too long: "${name}"`);
    if (/[^a-zA-Z0-9\s-￿'-]/.test(name)) issues.push(`Character name has special chars: "${name}"`);
  }

  // Check SFX format
  const sfxBlocks = blocks.filter((b) => b.characterName === "SFX");
  for (const sfx of sfxBlocks) {
    if (!sfx.textPayload.trim()) issues.push("SFX block has empty description.");
  }

  return issues;
}

// ─── Main admin page ───────────────────────────────────────────────────────────

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();

  // ── Story Factory state ──────────────────────────────────────────────────
  const [addTitle,    setAddTitle]    = useState("");
  const [addScript,   setAddScript]   = useState("");
  const [addIsPublic, setAddIsPublic] = useState(true);
  const [addCategory, setAddCategory] = useState<"classics" | "community">("classics");
  const [parsedBlocks, setParsedBlocks] = useState<ScriptBlock[]>([]);
  const [validationIssues, setValidationIssues] = useState<string[]>([]);
  const [processState, setProcessState] = useState<"idle" | "processing" | "done">("idle");
  const [processError, setProcessError] = useState("");
  const [addProduceLog,   setAddProduceLog]   = useState<string[]>([]);
  const [addProducing,    setAddProducing]     = useState(false);
  const [addProduceError, setAddProduceError] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [job,   setJob]   = useState<{
    status: string; step: string; progress: number; error?: string;
    audioUrl?: string; coverUrl?: string; title?: string;
  } | null>(null);

  // ── Cost Analysis state ──────────────────────────────────────────────────
  const [costData,       setCostData]       = useState<UsageCost | null>(null);
  const [libraryData,    setLibraryData]    = useState<LibraryCostData | null>(null);
  const [costLoading,    setCostLoading]    = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(false);

  const loadCostAnalysis = useCallback(async () => {
    setCostLoading(true);
    try {
      const res = await fetch("/api/admin/cost-analysis");
      if (res.ok) setCostData(await res.json() as UsageCost);
    } finally { setCostLoading(false); }
  }, []);

  const loadLibraryAnalysis = useCallback(async () => {
    setLibraryLoading(true);
    try {
      const res = await fetch("/api/admin/cost-analysis/library");
      if (res.ok) setLibraryData(await res.json() as LibraryCostData);
    } finally { setLibraryLoading(false); }
  }, []);

  // ── Job polling ──────────────────────────────────────────────────────────
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!jobId) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/drama-status/${jobId}`);
        if (!res.ok) return;
        const data = await res.json() as typeof job;
        setJob(data);
        if (data?.status === "done" || data?.status === "error") {
          clearInterval(pollRef.current!);
          setAddProducing(false);
        }
      } catch { /* ignore transient errors */ }
    }, 2000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [jobId]);

  // ── Script processing ────────────────────────────────────────────────────
  const handleProcessScript = async () => {
    if (!addScript.trim()) return;
    setProcessState("processing");
    setProcessError("");
    try {
      const blocks = parseScriptText(addScript);
      const issues = validateScript(blocks);
      setParsedBlocks(blocks);
      setValidationIssues(issues);
      setProcessState("done");
    } catch (e) {
      setProcessError(e instanceof Error ? e.message : "Parse error");
      setProcessState("idle");
    }
  };

  // ── Story production ─────────────────────────────────────────────────────
  const handleProduceStory = async () => {
    if (!parsedBlocks.length || !addTitle.trim()) return;
    setAddProducing(true);
    setAddProduceError("");
    setAddProduceLog([]);
    setJob(null);
    setJobId(null);

    try {
      const blocks = parsedBlocks;

      // 1. Classify characters
      const log = (msg: string) => setAddProduceLog((l) => [...l, msg]);
      log("Classifying characters…");
      const classifyRes = await fetch("/api/classify-characters", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characters: Array.from(new Set(blocks.map((b) => b.characterName))), summary: addTitle }),
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
    setParsedBlocks([]); setValidationIssues([]);
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

  const [adminTab, setAdminTab] = useState<"factory" | "costs" | "services">("factory");

  // ── Admin Services: SFX cache update ─────────────────────────────────────
  const [sfxRunning, setSfxRunning] = useState(false);
  const [sfxProgress, setSfxProgress] = useState(0);
  const [sfxLog, setSfxLog] = useState<Array<{ type: "info" | "error" | "success"; text: string }>>([]);

  const handleUpdateSfxCache = async () => {
    setSfxRunning(true);
    setSfxProgress(10);
    setSfxLog([{ type: "info", text: "Scanning story_elements for SFX entries…" }]);
    try {
      setSfxProgress(30);
      const res = await fetch("/api/admin/seed-sfx-library", { method: "POST" });
      setSfxProgress(90);
      if (!res.ok) {
        const { error } = await res.json() as { error?: string };
        setSfxLog((l) => [...l, { type: "error", text: `Server error: ${error ?? res.statusText}` }]);
      } else {
        const data = await res.json() as { total: number; seeded: number; skipped: number; alreadyInLibrary: number };
        setSfxLog((l) => [
          ...l,
          { type: "success", text: `✅ Done — ${data.seeded} new SFX added to cache (${data.skipped} skipped, ${data.alreadyInLibrary} already stored, ${data.total} unique descriptions total)` },
        ]);
      }
    } catch (e) {
      setSfxLog((l) => [...l, { type: "error", text: `Network error: ${e instanceof Error ? e.message : String(e)}` }]);
    } finally {
      setSfxProgress(100);
      setSfxRunning(false);
    }
  };

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
            { id: "factory",  label: "➕ Add Story" },
            { id: "costs",    label: "📊 Cost Analysis" },
            { id: "services", label: "🛠️ Admin Services" },
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
              {parsedBlocks.map((b) => (
                <div key={b.id} className="rounded-xl px-3 py-2.5"
                  style={{ background: b.characterName === "SFX" ? "rgba(167,139,250,0.07)" : "rgba(255,255,255,0.04)", border: b.characterName === "SFX" ? "1px solid rgba(167,139,250,0.2)" : "1px solid rgba(255,255,255,0.07)" }}>
                  <p className="text-fs-body font-medium" style={{ color: b.characterName === "SFX" ? "#a78bfa" : "#4fc3f7" }}>
                    {b.characterName === "SFX" ? "🔊 SFX" : b.characterName}
                  </p>
                  <p className="text-fs-body leading-snug mt-0.5" style={{ color: "rgba(255,255,255,0.6)" }}>{b.textPayload}</p>
                  {b.characterName !== "SFX" && (
                    <p className="text-fs-body mt-1" style={{ color: "rgba(255,255,255,0.22)" }}>Voice: {b.assignedVoiceId}</p>
                  )}
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

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/*  TAB: Admin Services                                               */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {adminTab === "services" && (
          <div className="flex flex-col gap-6">

            {/* ── SFX Cache Panel ── */}
            <div className="rounded-2xl p-5"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex items-start justify-between mb-1">
                <div>
                  <p className="text-white font-bold text-fs-body">🔊 SFX Cache</p>
                  <p className="text-fs-body mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
                    Scans all story_elements for SFX clips and seeds the sfx_library table for cross-story reuse.
                  </p>
                </div>
              </div>

              <button
                onClick={handleUpdateSfxCache}
                disabled={sfxRunning}
                className="w-full mt-4 py-3 rounded-xl text-fs-body font-bold transition-all active:scale-[0.98] disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,rgba(167,139,250,0.2),rgba(79,195,247,0.2))", border: "1px solid rgba(167,139,250,0.4)", color: "#fff" }}>
                {sfxRunning ? "Updating…" : "Update SFXs"}
              </button>

              {/* Progress bar */}
              {(sfxRunning || sfxProgress > 0) && (
                <div className="mt-4">
                  <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${sfxProgress}%`,
                        background: sfxProgress === 100
                          ? "linear-gradient(90deg,#10b981,#4fc3f7)"
                          : "linear-gradient(90deg,#a78bfa,#4fc3f7)",
                      }}
                    />
                  </div>
                  <p className="text-fs-body mt-1 text-right" style={{ color: "rgba(255,255,255,0.25)" }}>
                    {sfxProgress}%
                  </p>
                </div>
              )}

              {/* Log output */}
              {sfxLog.length > 0 && (
                <div className="mt-4 rounded-xl px-3 py-3 flex flex-col gap-1.5"
                  style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  {sfxLog.map((entry, i) => (
                    <p key={i} className="text-fs-body leading-snug"
                      style={{
                        color: entry.type === "error" ? "#f87171"
                          : entry.type === "success" ? "#34d399"
                          : "rgba(255,255,255,0.45)",
                        fontFamily: "monospace",
                      }}>
                      {entry.text}
                    </p>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
