"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import type { ScriptBlock } from "@/types";
import { PRESET_VOICES } from "@/config/presetVoices";
import type { ClassicMeta } from "@/lib/classicStories";

// ─── Constants ────────────────────────────────────────────────────────────────

const ADMIN_EMAIL = "tomereden@gmail.com";

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

const AGE_GROUPS = ["2-4", "4-6", "6-8", "8-10", "10-12"];

const POLL_INTERVAL_MS = 2500;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function makeBlock(order: number): ScriptBlock {
  return {
    id: uid(),
    blockOrder: order,
    characterName: "Narrator",
    assignedVoiceId: "Aoede",
    textPayload: "",
  };
}

function uniqueChars(blocks: ScriptBlock[]): string[] {
  return Array.from(new Set(blocks.map((b) => b.characterName).filter(Boolean)));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <p className="text-fs-body font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>
        {title}
      </p>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 mb-3">
      <label className="text-fs-body" style={{ color: "rgba(255,255,255,0.45)" }}>{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full px-3 py-2.5 rounded-xl text-white text-fs-body outline-none";
const inputStyle = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" };

function TextInput({ value, onChange, placeholder, multiline = false }: {
  value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean;
}) {
  if (multiline) {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className={inputCls + " resize-none"}
        style={inputStyle}
      />
    );
  }
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={inputCls}
      style={inputStyle}
    />
  );
}

function SelectInput({ value, onChange, options }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={inputCls}
      style={{ ...inputStyle, color: "#fff", appearance: "none" }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} style={{ background: "#0D1120" }}>{o.label}</option>
      ))}
    </select>
  );
}

// ─── Block editor ─────────────────────────────────────────────────────────────

function BlockEditor({ blocks, onChange }: {
  blocks: ScriptBlock[];
  onChange: (blocks: ScriptBlock[]) => void;
}) {
  const update = (id: string, patch: Partial<ScriptBlock>) =>
    onChange(blocks.map((b) => b.id === id ? { ...b, ...patch } : b));

  const remove = (id: string) =>
    onChange(blocks.filter((b) => b.id !== id).map((b, i) => ({ ...b, blockOrder: i })));

  const add = () =>
    onChange([...blocks, makeBlock(blocks.length)]);

  const move = (id: string, dir: -1 | 1) => {
    const idx = blocks.findIndex((b) => b.id === id);
    const next = idx + dir;
    if (next < 0 || next >= blocks.length) return;
    const arr = [...blocks];
    [arr[idx], arr[next]] = [arr[next], arr[idx]];
    onChange(arr.map((b, i) => ({ ...b, blockOrder: i })));
  };

  return (
    <div className="flex flex-col gap-3">
      {blocks.map((block, idx) => (
        <div
          key={block.id}
          className="rounded-xl p-3"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-fs-body font-bold" style={{ color: "rgba(255,255,255,0.3)", minWidth: 20 }}>
              {idx + 1}
            </span>
            <input
              type="text"
              value={block.characterName}
              onChange={(e) => update(block.id, { characterName: e.target.value })}
              placeholder="Character name"
              className="flex-1 px-2.5 py-1.5 rounded-lg text-fs-body text-white outline-none"
              style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}
            />
            <select
              value={block.assignedVoiceId}
              onChange={(e) => update(block.id, { assignedVoiceId: e.target.value })}
              className="px-2 py-1.5 rounded-lg text-fs-body outline-none"
              style={{ background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.25)", color: "#a78bfa", maxWidth: 110 }}
            >
              {PRESET_VOICES.map((v) => (
                <option key={v.id} value={v.id} style={{ background: "#0D1120" }}>
                  {v.emoji} {v.id}
                </option>
              ))}
            </select>
            <button onClick={() => move(block.id, -1)} disabled={idx === 0}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-opacity"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)", opacity: idx === 0 ? 0.25 : 1 }}>↑</button>
            <button onClick={() => move(block.id, 1)} disabled={idx === blocks.length - 1}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-opacity"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)", opacity: idx === blocks.length - 1 ? 0.25 : 1 }}>↓</button>
            <button onClick={() => remove(block.id)}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
              style={{ background: "rgba(236,72,153,0.1)", color: "rgba(236,72,153,0.7)" }}>✕</button>
          </div>
          <textarea
            value={block.textPayload}
            onChange={(e) => update(block.id, { textPayload: e.target.value })}
            placeholder="Dialogue / narration…"
            rows={3}
            className="w-full px-2.5 py-2 rounded-lg text-fs-body text-white outline-none resize-none"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
          />
        </div>
      ))}
      <button
        onClick={add}
        className="w-full py-2.5 rounded-xl text-fs-body font-medium transition-all active:scale-[0.98]"
        style={{ background: "rgba(79,195,247,0.07)", border: "1px dashed rgba(79,195,247,0.3)", color: "#4fc3f7" }}
      >
        + Add Block
      </button>
    </div>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function JobProgress({ progress, step, status }: { progress: number; step: string; status: string }) {
  const isDone = status === "done";
  const isError = status === "error";
  return (
    <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${isError ? "rgba(236,72,153,0.3)" : isDone ? "rgba(79,195,247,0.3)" : "rgba(255,255,255,0.08)"}` }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-fs-body font-medium text-white">{step || "Starting…"}</span>
        <span className="text-fs-body font-bold" style={{ color: isError ? "#EC4899" : "#4fc3f7" }}>{progress}%</span>
      </div>
      <div className="w-full rounded-full overflow-hidden" style={{ height: 6, background: "rgba(255,255,255,0.08)" }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${progress}%`,
            background: isError ? "linear-gradient(90deg,#EC4899,#f472b6)" : "linear-gradient(90deg,#4fc3f7,#a78bfa)",
          }}
        />
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();

  // ── Metadata state ──────────────────────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState("🌙");
  const [summary, setSummary] = useState("");
  const [language, setLanguage] = useState("en");
  const [ageGroup, setAgeGroup] = useState("4-6");
  const [durationMinutes, setDurationMinutes] = useState(5);
  const [coverPrompt, setCoverPrompt] = useState("");
  const [isPublic, setIsPublic] = useState(true);

  // ── Script state ────────────────────────────────────────────────────────────
  const [scriptMode, setScriptMode] = useState<"auto" | "manual">("auto");
  const [promptText, setPromptText] = useState("");
  const [blocks, setBlocks] = useState<ScriptBlock[]>([makeBlock(0)]);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");

  // ── Production state ────────────────────────────────────────────────────────
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<{
    status: string; step: string; progress: number; audioUrl?: string; coverUrl?: string; error?: string; title?: string;
  } | null>(null);
  const [producing, setProducing] = useState(false);
  const [produceError, setProduceError] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Existing classics list ──────────────────────────────────────────────────
  const [classics, setClassics] = useState<ClassicMeta[]>([]);
  const [classicsLoading, setClassicsLoading] = useState(true);

  const loadClassics = useCallback(() => {
    fetch("/api/classics", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setClassics(data as ClassicMeta[]); })
      .catch(() => {})
      .finally(() => setClassicsLoading(false));
  }, []);

  useEffect(() => { loadClassics(); }, [loadClassics]);

  // ── Job polling ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!jobId) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/drama-status/${jobId}`, { cache: "no-store" });
        if (!res.ok) return;
        const job = await res.json();
        setJobStatus(job);
        if (job.status === "done" || job.status === "error") {
          clearInterval(pollRef.current!);
          setProducing(false);
          if (job.status === "done") loadClassics();
        }
      } catch {}
    }, POLL_INTERVAL_MS);
    return () => clearInterval(pollRef.current!);
  }, [jobId, loadClassics]);

  // ── Auth gate ───────────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="cosmic-page min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "#4fc3f7 transparent transparent transparent" }} />
      </div>
    );
  }

  if (!user || user.email !== ADMIN_EMAIL) {
    return (
      <div className="cosmic-page min-h-screen flex flex-col items-center justify-center gap-4 text-center px-8">
        <span className="text-5xl">🔐</span>
        <p className="text-white/50 text-fs-body">Admin access only</p>
      </div>
    );
  }

  // ── Generate script ─────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!promptText.trim()) return;
    setGenerating(true);
    setGenerateError("");
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
          childAgeGroup: ageGroup,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      if (data.blocks?.length) setBlocks(data.blocks as ScriptBlock[]);
      if (data.title && !title) setTitle(data.title as string);
      if (data.summary && !summary) setSummary(data.summary as string);
      if (data.coverPrompt && !coverPrompt) setCoverPrompt(data.coverPrompt as string);
      setScriptMode("manual");
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setGenerating(false);
    }
  };

  // ── Produce ─────────────────────────────────────────────────────────────────
  const handleProduce = async () => {
    const validBlocks = blocks.filter((b) => b.textPayload.trim());
    if (!validBlocks.length) { setProduceError("Add at least one block with text."); return; }
    if (!title.trim()) { setProduceError("Title is required."); return; }

    setProducing(true);
    setProduceError("");
    setJobStatus(null);
    setJobId(null);

    try {
      const res = await fetch("/api/produce-drama", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blocks: validBlocks,
          summary: summary.trim() || undefined,
          durationMinutes,
          coverPrompt: coverPrompt.trim() || `${emoji} ${title} — illustrated children's storybook scene`,
          isPublic,
          language,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Produce failed");
      setJobId(data.jobId as string);
    } catch (err) {
      setProduceError(err instanceof Error ? err.message : "Unknown error");
      setProducing(false);
    }
  };

  // ── Reset form ───────────────────────────────────────────────────────────────
  const handleReset = () => {
    setTitle(""); setEmoji("🌙"); setSummary(""); setLanguage("en");
    setAgeGroup("4-6"); setDurationMinutes(5); setCoverPrompt("");
    setPromptText(""); setBlocks([makeBlock(0)]);
    setScriptMode("auto"); setJobId(null); setJobStatus(null);
    setProduceError(""); setGenerateError("");
  };

  const isDone = jobStatus?.status === "done";
  const isError = jobStatus?.status === "error";

  return (
    <div className="cosmic-page min-h-full pb-32">
      <div className="px-5 pt-12 pb-4">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-fs-title font-bold" style={{ background: "linear-gradient(135deg,#fff 0%,#4fc3f7 55%,#a78bfa 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
            🏭 Story Factory
          </h1>
          <button onClick={handleReset} className="text-fs-body px-3 py-1.5 rounded-lg transition-all"
            style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.09)" }}>
            Reset
          </button>
        </div>

        {/* ── Metadata ── */}
        <Section title="Story Metadata">
          <div className="flex gap-3 mb-3">
            <div className="flex-1">
              <Field label="Title">
                <TextInput value={title} onChange={setTitle} placeholder="Cinderella" />
              </Field>
            </div>
            <div style={{ width: 80 }}>
              <Field label="Emoji">
                <TextInput value={emoji} onChange={setEmoji} placeholder="🌙" />
              </Field>
            </div>
          </div>

          <Field label="Summary">
            <TextInput value={summary} onChange={setSummary} placeholder="A short description shown on the card…" multiline />
          </Field>

          <div className="grid grid-cols-3 gap-3 mb-3">
            <Field label="Language">
              <SelectInput value={language} onChange={setLanguage}
                options={LANGUAGES.map((l) => ({ value: l.code, label: l.label }))} />
            </Field>
            <Field label="Age">
              <SelectInput value={ageGroup} onChange={setAgeGroup}
                options={AGE_GROUPS.map((a) => ({ value: a, label: `${a} yrs` }))} />
            </Field>
            <Field label="Duration">
              <SelectInput value={String(durationMinutes)} onChange={(v) => setDurationMinutes(Number(v))}
                options={[1, 2, 3, 4, 5, 7, 10].map((m) => ({ value: String(m), label: `${m} min` }))} />
            </Field>
          </div>

          <Field label="Cover prompt (optional)">
            <TextInput value={coverPrompt} onChange={setCoverPrompt}
              placeholder="A magical castle at night with glowing stars…" multiline />
          </Field>

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div
              onClick={() => setIsPublic((v) => !v)}
              className="relative rounded-full transition-all"
              style={{ width: 44, height: 24, background: isPublic ? "rgba(79,195,247,0.4)" : "rgba(255,255,255,0.1)", border: isPublic ? "1px solid rgba(79,195,247,0.6)" : "1px solid rgba(255,255,255,0.15)" }}
            >
              <div className="absolute top-0.5 rounded-full transition-all"
                style={{ width: 20, height: 20, background: isPublic ? "#4fc3f7" : "rgba(255,255,255,0.4)", left: isPublic ? 22 : 2 }} />
            </div>
            <span className="text-fs-body" style={{ color: isPublic ? "#4fc3f7" : "rgba(255,255,255,0.4)" }}>
              {isPublic ? "Public (classic / community)" : "Private"}
            </span>
          </label>
        </Section>

        {/* ── Script ── */}
        <Section title="Script">
          {/* Mode tabs */}
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

          {scriptMode === "auto" && (
            <div className="flex flex-col gap-3">
              <TextInput
                value={promptText}
                onChange={setPromptText}
                placeholder="Describe the story: e.g. Cinderella — a kind girl who goes to the royal ball with the help of her fairy godmother…"
                multiline
              />
              {generateError && (
                <p className="text-fs-body" style={{ color: "#EC4899" }}>{generateError}</p>
              )}
              <button
                onClick={handleGenerate}
                disabled={generating || !promptText.trim()}
                className="w-full py-3 rounded-xl text-fs-body font-bold transition-all active:scale-[0.98] disabled:opacity-40"
                style={{ background: "linear-gradient(135deg,rgba(79,195,247,0.25),rgba(167,139,250,0.25))", border: "1px solid rgba(79,195,247,0.4)", color: "#fff" }}
              >
                {generating ? "Generating script…" : "✨ Generate Script"}
              </button>
              {blocks.length > 1 && (
                <p className="text-fs-body text-center" style={{ color: "rgba(255,255,255,0.3)" }}>
                  {blocks.length} blocks generated — switch to Manual to edit
                </p>
              )}
            </div>
          )}

          {scriptMode === "manual" && (
            <BlockEditor blocks={blocks} onChange={setBlocks} />
          )}
        </Section>

        {/* ── Produce ── */}
        <Section title="Produce">
          {produceError && (
            <p className="text-fs-body mb-3" style={{ color: "#EC4899" }}>{produceError}</p>
          )}

          {jobStatus && (
            <div className="mb-4">
              <JobProgress
                progress={jobStatus.progress}
                step={jobStatus.step}
                status={jobStatus.status}
              />
              {isDone && (
                <div className="mt-3 rounded-xl p-4 flex flex-col gap-2"
                  style={{ background: "rgba(79,195,247,0.07)", border: "1px solid rgba(79,195,247,0.25)" }}>
                  <p className="text-white font-bold text-fs-body">✅ Done{jobStatus.title ? ` — ${jobStatus.title}` : ""}!</p>
                  {jobStatus.audioUrl && (
                    // eslint-disable-next-line jsx-a11y/media-has-caption
                    <audio controls src={jobStatus.audioUrl} className="w-full" style={{ height: 36 }} />
                  )}
                  {jobStatus.coverUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={jobStatus.coverUrl} alt="Cover" className="w-32 rounded-xl" />
                  )}
                  <button onClick={handleReset}
                    className="text-fs-body px-4 py-2 rounded-xl font-medium transition-all active:scale-[0.98] mt-1"
                    style={{ background: "rgba(79,195,247,0.15)", border: "1px solid rgba(79,195,247,0.35)", color: "#4fc3f7" }}>
                    Create another story
                  </button>
                </div>
              )}
              {isError && (
                <p className="text-fs-body mt-2" style={{ color: "#EC4899" }}>Error: {jobStatus.error}</p>
              )}
            </div>
          )}

          {!isDone && (
            <button
              onClick={handleProduce}
              disabled={producing}
              className="w-full py-4 rounded-2xl text-fs-subtitle font-bold transition-all active:scale-[0.98] disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,rgba(79,195,247,0.3),rgba(167,139,250,0.3))", border: "1px solid rgba(79,195,247,0.45)", color: "#fff", boxShadow: "0 4px 24px rgba(79,195,247,0.2)" }}
            >
              {producing ? "Producing…" : "🚀 Produce Story"}
            </button>
          )}
        </Section>

        {/* ── Existing classics ── */}
        <Section title={`Existing Public Stories (${classics.length})`}>
          {classicsLoading ? (
            <div className="flex gap-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-xl animate-pulse flex-shrink-0"
                  style={{ width: 90, height: 120, background: "rgba(255,255,255,0.04)" }} />
              ))}
            </div>
          ) : classics.length === 0 ? (
            <p className="text-fs-body" style={{ color: "rgba(255,255,255,0.25)" }}>No public stories yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {classics.map((c) => (
                <div key={c.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <span className="text-fs-subtitle flex-shrink-0">{c.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-fs-body font-medium truncate">{c.title}</p>
                    <p className="text-fs-body truncate" style={{ color: "rgba(255,255,255,0.3)" }}>{c.tagline}</p>
                  </div>
                  <span className="text-fs-body flex-shrink-0 px-2 py-0.5 rounded-full font-bold"
                    style={{ background: c.status === "ready" ? "rgba(79,195,247,0.1)" : "rgba(255,255,255,0.05)", color: c.status === "ready" ? "#4fc3f7" : "rgba(255,255,255,0.3)", border: c.status === "ready" ? "1px solid rgba(79,195,247,0.25)" : "1px solid rgba(255,255,255,0.08)" }}>
                    {c.status === "ready" ? "✓ ready" : "pending"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}
