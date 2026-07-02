"use client";

import { useEffect, useRef, useState } from "react";

// Current HE_EL_VOICE_MAP from ttsService — shown for reference / copy-paste
const CURRENT_MAP: Record<string, { elId: string; elName: string }> = {
  Aoede:   { elId: "21m00Tcm4TlvDq8ikWAM", elName: "Rachel" },
  Kore:    { elId: "EXAVITQu4vr4xnSDxMaL", elName: "Bella" },
  Leda:    { elId: "MF3mGyEYCl7XYWbV9V6O", elName: "Elli" },
  Autonoe: { elId: "AZnzlk1XvdvUeBnXmlld", elName: "Domi" },
  Charon:  { elId: "pNInz6obpgDQGcFmaJgB", elName: "Adam" },
  Fenrir:  { elId: "VR6AewLTigWG4xSOukaG", elName: "Arnold" },
  Puck:    { elId: "ErXwobaYiN019PkySvjV", elName: "Antoni" },
  Orus:    { elId: "TxGEqnHWrfWFTfGW9XjX", elName: "Josh" },
  Zephyr:  { elId: "yoZ06aMxZJJ28mfd3POQ", elName: "Sam" },
};

interface ELVoice {
  id: string;
  name: string;
  category: string;
  description: string;
  labels: Record<string, string>;
  previewUrl: string | null;
  language: string | null;
  useCases: string[];
  verifiedLanguages: { language: string; model_id: string; accent?: string }[];
}

export default function HebrewVoicesPage() {
  const [voices, setVoices] = useState<ELVoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<"he" | "all">("he");
  const [playing, setPlaying] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const initialMap = () => Object.fromEntries(Object.entries(CURRENT_MAP).map(([k, v]) => [k, v.elId]));
  const [remapping, setRemapping] = useState<Record<string, string>>(initialMap);

  const isDirty = Object.entries(CURRENT_MAP).some(([k, v]) => remapping[k] !== v.elId);

  async function load(pg = 1, lang = filter) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ mode: "library", page_size: "40", page: String(pg) });
      if (lang === "he") params.set("language", "he");
      const res = await fetch(`/api/el-voices?${params}`);
      const data = await res.json() as { voices?: ELVoice[]; hasMore?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      const incoming = data.voices ?? [];
      setVoices(pg === 1 ? incoming : (prev) => [...prev, ...incoming]);
      setHasMore(data.hasMore ?? false);
      setPage(pg);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(1, filter); }, [filter]);

  function playPreview(voice: ELVoice) {
    if (!voice.previewUrl) return;
    if (playing === voice.id) {
      audioRef.current?.pause();
      setPlaying(null);
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = voice.previewUrl;
      audioRef.current.play().catch(() => {});
    }
    setPlaying(voice.id);
  }

  function assign(geminiVoice: string, elId: string) {
    setRemapping((prev) => {
      // Clicking the already-assigned voice resets this slot back to its original mapping
      if (prev[geminiVoice] === elId) {
        return { ...prev, [geminiVoice]: CURRENT_MAP[geminiVoice].elId };
      }
      return { ...prev, [geminiVoice]: elId };
    });
  }

  function resetAll() {
    setRemapping(initialMap());
  }

  function generateCode() {
    const lines = Object.entries(remapping).map(([k, v]) => {
      const voiceObj = voices.find((vv) => vv.id === v);
      const comment = voiceObj ? `// ${voiceObj.name}` : CURRENT_MAP[k]?.elName ? `// ${CURRENT_MAP[k].elName} (unchanged)` : "";
      return `  ${k.padEnd(10)}: "${v}", ${comment}`;
    });
    return `const HE_EL_VOICE_MAP: Record<string, string> = {\n${lines.join("\n")}\n};`;
  }

  function copyCode() {
    navigator.clipboard.writeText(generateCode()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div style={{ background: "#040612", minHeight: "100vh", color: "#e2e8f0", padding: "24px", fontFamily: "sans-serif" }}>
      <audio ref={audioRef} onEnded={() => setPlaying(null)} />

      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Hebrew Voice Mapping</h1>
      <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 24 }}>
        Browse ElevenLabs voices → listen → drag to assign. Copy the generated code into <code>ttsService.ts → HE_EL_VOICE_MAP</code>.
      </p>

      {/* Current map */}
      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: "#a78bfa" }}>Current HE_EL_VOICE_MAP</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
          {Object.entries(CURRENT_MAP).map(([gem, { elId, elName }]) => (
            <div key={gem} style={{ background: "#0f172a", borderRadius: 8, padding: "10px 14px", border: "1px solid #1e293b" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#4fc3f7" }}>{gem}</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                {elName} <span style={{ color: "#475569", fontFamily: "monospace" }}>{elId.slice(0, 8)}…</span>
              </div>
              {remapping[gem] !== elId && (
                <div style={{ fontSize: 11, color: "#a78bfa", marginTop: 4 }}>
                  → {voices.find((v) => v.id === remapping[gem])?.name ?? remapping[gem].slice(0, 8) + "…"}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Generated code */}
      <section style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: "#a78bfa", margin: 0 }}>Generated Code</h2>
          <button onClick={copyCode} style={{ fontSize: 12, background: copied ? "#059669" : "#1e293b", color: "#e2e8f0", border: "none", borderRadius: 6, padding: "4px 12px", cursor: "pointer" }}>
            {copied ? "Copied!" : "Copy"}
          </button>
          <button
            onClick={resetAll}
            disabled={!isDirty}
            style={{ fontSize: 12, background: "transparent", color: isDirty ? "#f87171" : "#475569", border: `1px solid ${isDirty ? "#f8717166" : "#334155"}`, borderRadius: 6, padding: "4px 12px", cursor: isDirty ? "pointer" : "default" }}
          >
            Reset all
          </button>
        </div>
        <pre style={{ background: "#0f172a", borderRadius: 8, padding: 14, fontSize: 12, overflowX: "auto", border: "1px solid #1e293b", color: "#94a3b8" }}>
          {generateCode()}
        </pre>
      </section>

      {/* Voice browser */}
      <section>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: "#a78bfa", margin: 0 }}>EL Voice Library</h2>
          <div style={{ display: "flex", gap: 6 }}>
            {(["he", "all"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{ fontSize: 12, padding: "4px 12px", borderRadius: 6, border: "1px solid", cursor: "pointer",
                  background: filter === f ? "#4fc3f7" : "transparent",
                  color: filter === f ? "#040612" : "#4fc3f7",
                  borderColor: "#4fc3f7" }}
              >
                {f === "he" ? "Hebrew" : "All languages"}
              </button>
            ))}
          </div>
          {loading && <span style={{ fontSize: 12, color: "#64748b" }}>Loading…</span>}
        </div>

        {error && <div style={{ color: "#f87171", fontSize: 13, marginBottom: 12 }}>{error}</div>}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
          {voices.map((voice) => {
            const heVerified = voice.verifiedLanguages.some((l) => l.language === "he" || l.language?.startsWith("he"));
            const assignedTo = Object.entries(remapping).filter(([, id]) => id === voice.id).map(([k]) => k);
            return (
              <div key={voice.id} style={{ background: "#0f172a", borderRadius: 10, padding: "12px 14px", border: `1px solid ${heVerified ? "#a78bfa44" : "#1e293b"}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0" }}>{voice.name}</div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>{voice.category}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                    {heVerified && <span style={{ fontSize: 10, background: "#a78bfa22", color: "#a78bfa", padding: "2px 6px", borderRadius: 4 }}>עברית ✓</span>}
                    {voice.previewUrl && (
                      <button onClick={() => playPreview(voice)} style={{ fontSize: 18, background: "none", border: "none", cursor: "pointer", color: playing === voice.id ? "#4fc3f7" : "#64748b" }}>
                        {playing === voice.id ? "⏸" : "▶"}
                      </button>
                    )}
                  </div>
                </div>
                {voice.description && <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8, lineHeight: 1.4 }}>{voice.description.slice(0, 100)}{voice.description.length > 100 ? "…" : ""}</div>}
                {assignedTo.length > 0 && (
                  <div style={{ fontSize: 11, color: "#4fc3f7", marginBottom: 6 }}>Assigned to: {assignedTo.join(", ")}</div>
                )}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {Object.keys(CURRENT_MAP).map((gem) => (
                    <button
                      key={gem}
                      onClick={() => assign(gem, voice.id)}
                      title={remapping[gem] === voice.id ? `Click to reset ${gem} to default (${CURRENT_MAP[gem].elName})` : `Assign ${gem} to ${voice.name}`}
                      style={{ fontSize: 11, padding: "3px 8px", borderRadius: 5, border: "1px solid", cursor: "pointer",
                        background: remapping[gem] === voice.id ? "#4fc3f7" : "transparent",
                        color: remapping[gem] === voice.id ? "#040612" : "#94a3b8",
                        borderColor: remapping[gem] === voice.id ? "#4fc3f7" : "#334155" }}
                    >
                      {gem}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {hasMore && (
          <button onClick={() => load(page + 1)} disabled={loading} style={{ marginTop: 16, padding: "10px 24px", background: "#1e293b", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>
            Load more
          </button>
        )}
      </section>
    </div>
  );
}
