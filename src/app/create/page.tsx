"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import ScriptTab from "@/components/studio/ScriptTab";
import ProductionProgress from "@/components/studio/ProductionProgress";
import DramaPlayer from "@/components/studio/DramaPlayer";
import { VOICES } from "@/lib/mockData";
import type { ScriptBlock } from "@/types";
import type { GenerateStoryRequest } from "@/app/api/generate-story/route";
import type { Job } from "@/lib/jobs";

type ActiveTab = "prompt" | "five-question" | "script" | "producing" | "drama";

// ─── Prompt tab ───────────────────────────────────────────────────────────────

function PromptTab({
  promptText, setPromptText,
  generating, onGenerate,
  t,
}: {
  promptText: string; setPromptText: (v: string) => void;
  generating: boolean; onGenerate: () => void;
  t: (key: Parameters<ReturnType<typeof useLanguage>["t"]>[0]) => string;
}) {
  const canGenerate = promptText.trim().length > 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <label className="block text-white/40 text-[10px] font-bold uppercase tracking-widest mb-2">
          {t("describeStory")}
        </label>
        <textarea
          placeholder={t("storyPlaceholder")}
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          rows={10}
          className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 outline-none resize-none leading-relaxed"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(79,195,247,0.4)")}
          onBlur={(e)  => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}
        />
        <p className="text-white/15 text-[10px] mt-1 text-right">
          {promptText.trim().split(/\s+/).filter(Boolean).length} {t("wordCount")}
        </p>
      </div>

      <button
        onClick={onGenerate}
        disabled={!canGenerate || generating}
        className="w-full py-4 rounded-2xl font-semibold text-sm transition-all active:scale-[0.98]"
        style={
          canGenerate && !generating
            ? { background: "linear-gradient(90deg,#4fc3f7,#2a8cb5)", color: "#05080F", boxShadow: "0 4px 24px rgba(79,195,247,0.35)" }
            : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.07)" }
        }
      >
        {generating
          ? <span className="flex items-center justify-center gap-2"><span className="animate-pulse">✨</span>{t("generating")}</span>
          : t("generateStory")}
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CreatePage() {
  const { language, isRTL, t } = useLanguage();
  const router = useRouter();

  const [promptText, setPromptText]       = useState("");
  const [activeTab, setActiveTab]         = useState<ActiveTab>("prompt");
  const [generating, setGenerating]       = useState(false);
  const [scriptBlocks, setScriptBlocks]   = useState<ScriptBlock[]>([]);
  const [isProducing, setIsProducing]     = useState(false);
  const [productionJobId, setProductionJobId] = useState<string | null>(null);
  const [completedJob, setCompletedJob]   = useState<Job | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const hasScript = scriptBlocks.length > 0;

  const handleGenerate = async () => {
    if (!promptText.trim()) return;
    setGenerating(true);
    setGenerateError(null);

    const body: GenerateStoryRequest = {
      mode: "prompt",
      promptText,
      primaryVoiceId: VOICES[0].id,
      durationMinutes: 5,
    };

    try {
      const res  = await fetch("/api/generate-story", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setScriptBlocks(data.blocks as ScriptBlock[]);
      setActiveTab("script");
    } catch (err: unknown) {
      setGenerateError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setGenerating(false);
    }
  };

  const handleProduce = useCallback(async (blocks: ScriptBlock[]) => {
    setIsProducing(true);
    setGenerateError(null);
    setActiveTab("producing");
    try {
      const res  = await fetch("/api/produce-drama", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ blocks }) });
      const text = await res.text();
      let data: { jobId?: string; error?: string } = {};
      try { data = JSON.parse(text); } catch { throw new Error(`Server error (${res.status}): ${text.slice(0, 300)}`); }
      if (!res.ok) throw new Error(data.error ?? "Production failed");
      setProductionJobId(data.jobId!);
    } catch (err: unknown) {
      setGenerateError(err instanceof Error ? err.message : "Production failed");
      setIsProducing(false);
      setActiveTab("script");
    }
  }, []);

  const handleProductionDone = useCallback((job: Job) => {
    setCompletedJob(job);
    setIsProducing(false);
    setActiveTab("drama");
  }, []);

  const handleProductionError = useCallback((msg: string) => {
    setGenerateError(msg);
    setIsProducing(false);
    setProductionJobId(null);
    setActiveTab("script");
  }, []);

  const handleReset = () => {
    setPromptText(""); setScriptBlocks([]); setActiveTab("prompt");
    setGenerateError(null); setProductionJobId(null); setCompletedJob(null);
    setIsProducing(false);
  };

  // ─── Full-screen states ───────────────────────────────────────────────────

  if (generating) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center px-8 text-center">
        <div className="flex flex-col items-center gap-6">
          <div className="relative w-24 h-24 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full animate-ping opacity-20"
              style={{ background: "radial-gradient(circle,#4fc3f7,#0088AA)" }} />
            <div className="absolute inset-2 rounded-full opacity-40 animate-pulse"
              style={{ background: "radial-gradient(circle,#4fc3f7,#0088AA)" }} />
            <span className="relative text-5xl animate-pulse">✨</span>
          </div>
          <div>
            <h2 className="text-white text-xl font-bold mb-2">{t("craftingStory")}</h2>
            <p className="text-white/35 text-sm">{t("weavingMagic")}</p>
          </div>
          <div className="flex gap-2">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="w-2 h-2 rounded-full"
                style={{ background: "linear-gradient(135deg,#4fc3f7,#0088AA)", animation: `bounce 1s ease-in-out ${i * 0.15}s infinite` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (activeTab === "producing" && productionJobId) {
    return (
      <div className="min-h-full" style={{ background: "transparent" }} dir={isRTL ? "rtl" : "ltr"}>
        <div className="px-5 pt-12 pb-8">
          <div className="flex items-center mb-7">
            <button onClick={() => { setActiveTab("script"); setIsProducing(false); setProductionJobId(null); }}
              className="w-8 h-8 flex items-center justify-center text-white/50 text-base">←</button>
            <h1 className="flex-1 text-center text-base font-semibold text-white tracking-wide">{t("producingDrama")}</h1>
            <div className="w-8" />
          </div>
          <ProductionProgress jobId={productionJobId} onDone={handleProductionDone} onError={handleProductionError} />
        </div>
      </div>
    );
  }

  if (activeTab === "drama" && completedJob) {
    return (
      <div className="min-h-full" style={{ background: "transparent" }} dir={isRTL ? "rtl" : "ltr"}>
        <div className="px-5 pt-12 pb-8">
          <div className="flex items-center mb-7">
            <button onClick={handleReset} className="w-8 h-8 flex items-center justify-center text-white/50 text-base">←</button>
            <h1 className="flex-1 text-center text-base font-semibold text-white tracking-wide">{t("dramaReady")}</h1>
            <div className="w-8" />
          </div>
          <DramaPlayer job={completedJob} onGenerateAnother={handleReset} />
        </div>
      </div>
    );
  }

  // ─── Main tab shell ───────────────────────────────────────────────────────

  const TABS: { id: ActiveTab; label: string; emoji: string }[] = [
    { id: "prompt",        label: t("promptTab"),        emoji: "💬" },
    { id: "five-question", label: t("fiveQuestionsTab"), emoji: "🧚" },
    { id: "script",        label: t("scriptTab"),        emoji: "📄" },
  ];

  return (
    <div className="min-h-full" style={{ background: "transparent" }} dir={isRTL ? "rtl" : "ltr"}>
      <div className="px-5 pt-12 pb-8">
        {/* Header */}
        <div className="flex items-center mb-7">
          <a href="/library" className="w-8 h-8 flex items-center justify-center text-white/50 text-base">←</a>
          <h1 className="flex-1 text-center text-base font-semibold text-white tracking-wide">
            {t("storyCreator")}
          </h1>
          <div className="w-8" />
        </div>

        {/* Tab bar */}
        <div className="flex mb-7" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          {TABS.map(({ id, label, emoji }) => {
            const isFiveQ   = id === "five-question";
            const isScript  = id === "script";
            const isDisabled = isScript && !hasScript;
            const isActive  = activeTab === id;

            return (
              <button
                key={id}
                onClick={() => {
                  if (isDisabled) return;
                  if (isFiveQ) { router.push("/create/five-question"); return; }
                  setActiveTab(id);
                }}
                disabled={isDisabled}
                className={`relative flex-1 pb-3 text-[11px] font-bold tracking-wider uppercase transition-colors ${
                  isActive ? "text-white" : isDisabled ? "text-white/15 cursor-not-allowed" : "text-white/30"
                }`}
              >
                <span className="flex items-center justify-center gap-1.5">
                  <span>{emoji}</span>
                  <span>{label}</span>
                  {isScript && hasScript && (
                    <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#4fc3f7" }} />
                  )}
                </span>
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: "#4fc3f7" }} />
                )}
              </button>
            );
          })}
        </div>

        {/* Error banner */}
        {generateError && (
          <div className="mb-5 px-4 py-3 rounded-2xl text-xs leading-relaxed"
            style={{ background: "rgba(236,72,153,0.1)", border: "1px solid rgba(236,72,153,0.25)", color: "#EC4899" }}>
            ⚠ {generateError}
          </div>
        )}

        {activeTab === "prompt" && (
          <PromptTab
            promptText={promptText} setPromptText={setPromptText}
            generating={generating} onGenerate={handleGenerate}
            t={t}
          />
        )}
        {activeTab === "script" && (
          <ScriptTab
            blocks={scriptBlocks} voices={VOICES}
            onBlocksChange={setScriptBlocks}
            onProduce={handleProduce} isProducing={isProducing}
          />
        )}
      </div>
    </div>
  );
}
