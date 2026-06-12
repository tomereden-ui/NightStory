"use client";

import { useState, useCallback } from "react";
import { useLanguage } from "@/context/LanguageContext";
import ScriptTab from "@/components/studio/ScriptTab";
import ProductionProgress from "@/components/studio/ProductionProgress";
import DramaPlayer from "@/components/studio/DramaPlayer";
import QuickCreateTab from "@/components/studio/QuickCreateTab";
import { VOICES, STORY_SETTINGS } from "@/lib/mockData";
import type { ScriptBlock } from "@/types";
import type { GenerateStoryRequest } from "@/app/api/generate-story/route";
import type { Job } from "@/lib/jobs";

type ActiveTab = "wizard" | "prompt" | "quick" | "script" | "producing" | "drama";

const VOICE_ACCENTS = ["#4fc3f7", "#8B5CF6", "#EC4899", "#10D9A0"];

// ─── Wizard tab ───────────────────────────────────────────────────────────────

function DurationSlider({ value, onChange, language }: { value: number; onChange: (v: number) => void; language: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-white/40 text-[10px] font-bold uppercase tracking-widest">
          {language === "he" ? "אורך הסיפור" : "Story Length"}
        </label>
        <span
          className="text-xs font-bold px-2.5 py-0.5 rounded-full"
          style={{ background: "rgba(79,195,247,0.12)", color: "#4fc3f7", border: "1px solid rgba(79,195,247,0.25)" }}
        >
          {value} {language === "he" ? "דק׳" : "min"}
        </span>
      </div>
      <input
        type="range" min={1} max={15} step={1} value={value}
        onChange={(e) => onChange(+e.target.value)}
        className="w-full cursor-pointer"
        style={{ accentColor: "#4fc3f7" }}
      />
      <div className="flex justify-between text-white/20 text-[10px] mt-1">
        <span>1 {language === "he" ? "דק׳" : "min"}</span>
        <span className="text-white/15">· · · · · · · · · · · · · ·</span>
        <span>15 {language === "he" ? "דק׳" : "min"}</span>
      </div>
    </div>
  );
}

interface WizardTabProps {
  hero: string; setHero: (v: string) => void;
  setting: string; setSetting: (v: string) => void;
  plot: string; setPlot: (v: string) => void;
  selectedVoice: string; setSelectedVoice: (v: string) => void;
  durationMinutes: number; setDurationMinutes: (v: number) => void;
  generating: boolean;
  onGenerate: () => void;
  language: string;
}

function WizardTab({ hero, setHero, setting, setSetting, plot, setPlot, selectedVoice, setSelectedVoice, durationMinutes, setDurationMinutes, generating, onGenerate, language }: WizardTabProps) {
  const canGenerate = hero.trim().length > 0;

  return (
    <div className="flex flex-col gap-7">
      {/* Main Character */}
      <div>
        <label className="block text-white/40 text-[10px] font-bold uppercase tracking-widest mb-2">
          {language === "he" ? "דמות ראשית" : "Main Character"}
        </label>
        <input
          type="text"
          placeholder={language === "he" ? "שם הדמות הראשית… (לדוגמה, ליאו)" : "Name the main character... (e.g., Leo)"}
          value={hero}
          onChange={(e) => setHero(e.target.value)}
          className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition-colors"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(79,195,247,0.4)")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}
        />
      </div>

      {/* Setting — horizontal chips */}
      <div>
        <label className="block text-white/40 text-[10px] font-bold uppercase tracking-widest mb-3">
          {language === "he" ? "סביבה" : "Setting"}
        </label>
        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
          {STORY_SETTINGS.map((s) => {
            const isSelected = setting === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setSetting(isSelected ? "" : s.id)}
                className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium transition-all active:scale-95"
                style={isSelected ? {
                  background: "rgba(79,195,247,0.14)",
                  border: "1px solid rgba(79,195,247,0.4)",
                  color: "#4fc3f7",
                } : {
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "rgba(255,255,255,0.55)",
                }}
              >
                <span>{s.emoji}</span>
                <span>{language === "he" ? s.labelHe : s.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* The Plot */}
      <div>
        <label className="block text-white/40 text-[10px] font-bold uppercase tracking-widest mb-2">
          {language === "he" ? "עלילה" : "The Plot"}
        </label>
        <textarea
          placeholder={language === "he" ? "מה קורה הלילה?" : "What is tonight's adventure?"}
          value={plot}
          onChange={(e) => setPlot(e.target.value)}
          rows={4}
          className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 outline-none resize-none transition-colors leading-relaxed"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(79,195,247,0.4)")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}
        />
      </div>

      {/* Voice Player */}
      <div>
        <label className="block text-white/40 text-[10px] font-bold uppercase tracking-widest mb-4">
          {language === "he" ? "קריין" : "Voice Player"}
        </label>
        <div className="flex gap-4">
          {VOICES.map((voice, idx) => {
            const isSelected = selectedVoice === voice.id;
            const accent = VOICE_ACCENTS[idx] ?? "#4fc3f7";
            return (
              <button
                key={voice.id}
                onClick={() => setSelectedVoice(voice.id)}
                className="flex flex-col items-center gap-2 flex-1"
              >
                <div
                  className="w-13 h-13 rounded-full flex items-center justify-center text-xl transition-all"
                  style={isSelected ? {
                    width: 52, height: 52,
                    background: "rgba(255,255,255,0.08)",
                    border: `2px solid ${accent}`,
                    boxShadow: `0 0 0 3px ${accent}22`,
                  } : {
                    width: 52, height: 52,
                    background: "rgba(255,255,255,0.05)",
                    border: "2px solid rgba(255,255,255,0.1)",
                  }}
                >
                  {voice.avatarEmoji}
                </div>
                <span
                  className="text-[10px] font-semibold uppercase tracking-wide"
                  style={{ color: isSelected ? accent : "rgba(255,255,255,0.35)" }}
                >
                  {language === "he" ? voice.nameHe : voice.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Duration slider */}
      <DurationSlider value={durationMinutes} onChange={setDurationMinutes} language={language} />

      {/* Generate button */}
      <button
        onClick={onGenerate}
        disabled={!canGenerate || generating}
        className="w-full py-4 rounded-2xl font-semibold text-sm transition-all active:scale-[0.98]"
        style={canGenerate && !generating ? {
          background: "linear-gradient(90deg,#4fc3f7,#2a8cb5)",
          color: "#05080F",
          boxShadow: "0 4px 24px rgba(79,195,247,0.35)",
        } : {
          background: "rgba(255,255,255,0.05)",
          color: "rgba(255,255,255,0.2)",
          border: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        {generating ? (
          <span className="flex items-center justify-center gap-2">
            <span className="animate-pulse">✨</span>
            {language === "he" ? "יוצר סיפור…" : "Generating story…"}
          </span>
        ) : (
          language === "he" ? "צור סיפור" : "GENERATE STORY"
        )}
      </button>
    </div>
  );
}

// ─── Prompt tab ───────────────────────────────────────────────────────────────

interface PromptTabProps {
  promptText: string; setPromptText: (v: string) => void;
  selectedVoice: string; setSelectedVoice: (v: string) => void;
  durationMinutes: number; setDurationMinutes: (v: number) => void;
  generating: boolean;
  onGenerate: () => void;
  language: string;
}

function PromptTab({ promptText, setPromptText, selectedVoice, setSelectedVoice, durationMinutes, setDurationMinutes, generating, onGenerate, language }: PromptTabProps) {
  const canGenerate = promptText.trim().length > 0;

  return (
    <div className="flex flex-col gap-7">
      <div>
        <label className="block text-white/40 text-[10px] font-bold uppercase tracking-widest mb-2">
          {language === "he" ? "ספר לי על הסיפור" : "Tell me about the story"}
        </label>
        <textarea
          placeholder={language === "he"
            ? "כתוב כל מה שרוצים — דמויות, מקום, מצב רוח, סוף…"
            : "Describe anything — characters, setting, mood, how it ends…"}
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          rows={9}
          className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 outline-none resize-none leading-relaxed"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(79,195,247,0.4)")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}
        />
        <p className="text-white/15 text-[10px] mt-1 text-right">
          {promptText.trim().split(/\s+/).filter(Boolean).length} words
        </p>
      </div>

      {/* Voice Player */}
      <div>
        <label className="block text-white/40 text-[10px] font-bold uppercase tracking-widest mb-4">
          {language === "he" ? "קריין" : "Voice Player"}
        </label>
        <div className="flex gap-4">
          {VOICES.map((voice, idx) => {
            const isSelected = selectedVoice === voice.id;
            const accent = VOICE_ACCENTS[idx] ?? "#4fc3f7";
            return (
              <button key={voice.id} onClick={() => setSelectedVoice(voice.id)} className="flex flex-col items-center gap-2 flex-1">
                <div
                  className="rounded-full flex items-center justify-center text-xl transition-all"
                  style={isSelected ? {
                    width: 52, height: 52,
                    background: "rgba(255,255,255,0.08)",
                    border: `2px solid ${accent}`,
                    boxShadow: `0 0 0 3px ${accent}22`,
                  } : {
                    width: 52, height: 52,
                    background: "rgba(255,255,255,0.05)",
                    border: "2px solid rgba(255,255,255,0.1)",
                  }}
                >
                  {voice.avatarEmoji}
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-wide"
                  style={{ color: isSelected ? accent : "rgba(255,255,255,0.35)" }}>
                  {language === "he" ? voice.nameHe : voice.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Duration slider */}
      <DurationSlider value={durationMinutes} onChange={setDurationMinutes} language={language} />

      <button
        onClick={onGenerate}
        disabled={!canGenerate || generating}
        className="w-full py-4 rounded-2xl font-semibold text-sm transition-all active:scale-[0.98]"
        style={canGenerate && !generating ? {
          background: "linear-gradient(90deg,#4fc3f7,#2a8cb5)",
          color: "#05080F",
          boxShadow: "0 4px 24px rgba(79,195,247,0.35)",
        } : {
          background: "rgba(255,255,255,0.05)",
          color: "rgba(255,255,255,0.2)",
          border: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        {generating ? (
          <span className="flex items-center justify-center gap-2">
            <span className="animate-pulse">✨</span>Generating…
          </span>
        ) : "GENERATE STORY"}
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CreatePage() {
  const { language, isRTL } = useLanguage();

  const [hero, setHero] = useState("");
  const [setting, setSetting] = useState("");
  const [plot, setPlot] = useState("");
  const [selectedVoice, setSelectedVoice] = useState(VOICES[0].id);
  const [promptText, setPromptText] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(1);

  const [activeTab, setActiveTab] = useState<ActiveTab>("wizard");
  const [generating, setGenerating] = useState(false);
  const [scriptBlocks, setScriptBlocks] = useState<ScriptBlock[]>([]);
  const [isProducing, setIsProducing] = useState(false);
  const [productionJobId, setProductionJobId] = useState<string | null>(null);
  const [completedJob, setCompletedJob] = useState<Job | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const hasScript = scriptBlocks.length > 0;

  const handleGenerate = async () => {
    const hasInput = activeTab === "prompt" ? promptText.trim().length > 0 : hero.trim().length > 0;
    if (!hasInput) return;
    setGenerating(true);
    setGenerateError(null);

    const settingLabel = STORY_SETTINGS.find((s) => s.id === setting)?.label ?? setting;
    const body: GenerateStoryRequest = activeTab === "prompt"
      ? { mode: "prompt", promptText, primaryVoiceId: selectedVoice, durationMinutes }
      : { mode: "wizard", hero, setting: settingLabel, plot, primaryVoiceId: selectedVoice, durationMinutes };

    try {
      const res = await fetch("/api/generate-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
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

  const handleGenerateWithPrompt = useCallback(async (text: string, duration: number) => {
    setGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetch("/api/generate-story", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "prompt", promptText: text, primaryVoiceId: selectedVoice, durationMinutes: duration }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setScriptBlocks(data.blocks as ScriptBlock[]);
      setActiveTab("script");
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setGenerating(false);
    }
  }, [selectedVoice]);

  const handleProduce = useCallback(async (blocks: ScriptBlock[]) => {
    setIsProducing(true);
    setGenerateError(null);
    setActiveTab("producing");
    try {
      const res = await fetch("/api/produce-drama", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks }),
      });
      const text = await res.text();
      let data: { jobId?: string; error?: string } = {};
      try { data = JSON.parse(text); } catch {
        throw new Error(`Server error (${res.status}): ${text.slice(0, 300)}`);
      }
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
    setHero(""); setPlot(""); setSetting("");
    setPromptText(""); setScriptBlocks([]); setActiveTab("wizard");
    setGenerateError(null); setProductionJobId(null); setCompletedJob(null);
    setIsProducing(false); setDurationMinutes(5);
  };

  // Generating overlay
  if (generating) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center px-8 text-center" style={{ background: "transparent" }}>
        <div className="flex flex-col items-center gap-6">
          <div className="relative w-24 h-24 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full animate-ping opacity-20"
              style={{ background: "radial-gradient(circle,#4fc3f7,#0088AA)" }} />
            <div className="absolute inset-2 rounded-full opacity-40 animate-pulse"
              style={{ background: "radial-gradient(circle,#4fc3f7,#0088AA)" }} />
            <span className="relative text-5xl animate-pulse">✨</span>
          </div>
          <div>
            <h2 className="text-white text-xl font-bold mb-2">
              {language === "he" ? "יוצר את הסיפור שלך…" : "Crafting your story…"}
            </h2>
            <p className="text-white/35 text-sm">
              {language === "he" ? "זה ייקח כמה שניות" : "Weaving words into magic…"}
            </p>
          </div>
          <div className="flex gap-2">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="w-2 h-2 rounded-full"
                style={{
                  background: "linear-gradient(135deg,#4fc3f7,#0088AA)",
                  animation: `bounce 1s ease-in-out ${i * 0.15}s infinite`,
                }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Production in progress
  if (activeTab === "producing" && productionJobId) {
    return (
      <div className="min-h-full" style={{ background: "transparent" }} dir={isRTL ? "rtl" : "ltr"}>
        <div className="px-5 pt-12 pb-8">
          <div className="flex items-center mb-7">
            <button onClick={() => { setActiveTab("script"); setIsProducing(false); setProductionJobId(null); }}
              className="w-8 h-8 flex items-center justify-center text-white/50 text-base">←</button>
            <h1 className="flex-1 text-center text-base font-semibold text-white tracking-wide">Producing Drama</h1>
            <div className="w-8" />
          </div>
          <ProductionProgress
            jobId={productionJobId}
            onDone={handleProductionDone}
            onError={handleProductionError}
          />
        </div>
      </div>
    );
  }

  // Completed drama
  if (activeTab === "drama" && completedJob) {
    return (
      <div className="min-h-full" style={{ background: "transparent" }} dir={isRTL ? "rtl" : "ltr"}>
        <div className="px-5 pt-12 pb-8">
          <div className="flex items-center mb-7">
            <button onClick={handleReset}
              className="w-8 h-8 flex items-center justify-center text-white/50 text-base">←</button>
            <h1 className="flex-1 text-center text-base font-semibold text-white tracking-wide">Drama Ready</h1>
            <div className="w-8" />
          </div>
          <DramaPlayer job={completedJob} onGenerateAnother={handleReset} />
        </div>
      </div>
    );
  }

  const TABS: { id: ActiveTab; label: string }[] = [
    { id: "wizard", label: language === "he" ? "אשף" : "Guided Wizard" },
    { id: "prompt", label: language === "he" ? "טקסט חופשי" : "Text Prompt" },
    { id: "quick",  label: language === "he" ? "בקליק" : "Quick" },
    { id: "script", label: language === "he" ? "סיפור שנוצר" : "Script" },
  ];

  return (
    <div className="min-h-full" style={{ background: "transparent" }} dir={isRTL ? "rtl" : "ltr"}>
      <div className="px-5 pt-12 pb-8">
        {/* Header */}
        <div className="flex items-center mb-7">
          <a
            href="/library"
            className="w-8 h-8 flex items-center justify-center text-white/50 text-base"
          >
            ←
          </a>
          <h1 className="flex-1 text-center text-base font-semibold text-white tracking-wide">
            {language === "he" ? "יוצר סיפורים" : "Story Creator"}
          </h1>
          <div className="w-8" />
        </div>

        {/* Tab bar */}
        <div className="flex mb-7" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          {TABS.map(({ id, label }) => {
            const isActive = activeTab === id;
            const isDisabled = id === "script" && !hasScript;
            return (
              <button
                key={id}
                onClick={() => !isDisabled && setActiveTab(id)}
                disabled={isDisabled}
                className={`relative flex-1 pb-3 text-[11px] font-bold tracking-wider uppercase transition-colors ${
                  isActive ? "text-white" : isDisabled ? "text-white/15 cursor-not-allowed" : "text-white/30"
                }`}
              >
                <span className="flex items-center justify-center gap-1.5">
                  {label}
                  {id === "script" && hasScript && (
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

        {activeTab === "wizard" && (
          <WizardTab hero={hero} setHero={setHero} setting={setting} setSetting={setSetting}
            plot={plot} setPlot={setPlot} selectedVoice={selectedVoice} setSelectedVoice={setSelectedVoice}
            durationMinutes={durationMinutes} setDurationMinutes={setDurationMinutes}
            generating={generating} onGenerate={handleGenerate} language={language} />
        )}
        {activeTab === "prompt" && (
          <PromptTab promptText={promptText} setPromptText={setPromptText}
            selectedVoice={selectedVoice} setSelectedVoice={setSelectedVoice}
            durationMinutes={durationMinutes} setDurationMinutes={setDurationMinutes}
            generating={generating} onGenerate={handleGenerate} language={language} />
        )}
        {activeTab === "quick" && (
          <QuickCreateTab onGenerate={handleGenerateWithPrompt} generating={generating} language={language} />
        )}
        {activeTab === "script" && (
          <ScriptTab blocks={scriptBlocks} voices={VOICES} onBlocksChange={setScriptBlocks}
            onProduce={handleProduce} isProducing={isProducing} />
        )}
      </div>
    </div>
  );
}
