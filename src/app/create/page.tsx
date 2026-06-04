"use client";

import { useState, useCallback } from "react";
import { useLanguage } from "@/context/LanguageContext";
import StarField from "@/components/ui/StarField";
import ScriptTab from "@/components/studio/ScriptTab";
import { VOICES, STORY_SETTINGS } from "@/lib/mockData";
import type { ScriptBlock } from "@/types";
import type { GenerateStoryRequest } from "@/app/api/generate-story/route";

type ActiveTab = "wizard" | "prompt" | "script";

// ─── Wizard tab ─────────────────────────────────────────────────────────────

interface WizardTabProps {
  hero: string; setHero: (v: string) => void;
  setting: string; setSetting: (v: string) => void;
  plot: string; setPlot: (v: string) => void;
  selectedVoice: string; setSelectedVoice: (v: string) => void;
  generating: boolean;
  onGenerate: () => void;
  language: string;
}

function WizardTab({ hero, setHero, setting, setSetting, plot, setPlot, selectedVoice, setSelectedVoice, generating, onGenerate, language }: WizardTabProps) {
  const canGenerate = hero.trim().length > 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Main character */}
      <div>
        <label className="text-white/40 text-[10px] font-semibold uppercase tracking-widest mb-2 block">
          {language === "he" ? "מי הגיבור?" : "Main Character"}
        </label>
        <input
          type="text"
          placeholder={language === "he" ? "לדוגמה: ילדה אמיצה…" : "Describe the main character, e.g., a brave girl"}
          value={hero}
          onChange={(e) => setHero(e.target.value)}
          className="w-full bg-bg-card border border-bg-border rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-purple/50 transition-colors"
        />
      </div>

      {/* Setting — horizontal scrolling chips */}
      <div>
        <label className="text-white/40 text-[10px] font-semibold uppercase tracking-widest mb-3 block">
          {language === "he" ? "סביבה" : "Setting"}
        </label>
        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
          {STORY_SETTINGS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSetting(setting === s.id ? "" : s.id)}
              className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-medium transition-all ${
                setting === s.id
                  ? "border-teal/60 bg-teal/10 text-teal shadow-teal-sm"
                  : "border-bg-border bg-bg-card text-white/45 hover:border-white/20"
              }`}
            >
              <span className="text-base">{s.emoji}</span>
              {language === "he" ? s.labelHe : s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Plot */}
      <div>
        <label className="text-white/40 text-[10px] font-semibold uppercase tracking-widest mb-2 block">
          {language === "he" ? "העלילה" : "The Plot"}
        </label>
        <textarea
          placeholder={language === "he" ? "מה יקרה בסיפור? (אופציונלי)" : "What happens? Leave blank and let the AI surprise you."}
          value={plot}
          onChange={(e) => setPlot(e.target.value)}
          rows={3}
          className="w-full bg-bg-card border border-bg-border rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-purple/50 transition-colors resize-none"
        />
      </div>

      {/* Voice player */}
      <div>
        <label className="text-white/40 text-[10px] font-semibold uppercase tracking-widest mb-3 block">
          {language === "he" ? "נגן קולי" : "Voice Player"}
        </label>
        <div className="flex gap-3">
          {VOICES.map((voice) => {
            const isSelected = selectedVoice === voice.id;
            return (
              <button
                key={voice.id}
                onClick={() => setSelectedVoice(voice.id)}
                className="flex flex-col items-center gap-1.5 flex-1"
              >
                {/* Dark circular avatar */}
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl border-2 transition-all ${
                    isSelected
                      ? "border-teal shadow-teal-sm bg-bg-elevated"
                      : "border-bg-border bg-bg-card"
                  }`}
                  style={isSelected ? { boxShadow: "0 0 0 3px rgba(0,212,255,0.15)" } : {}}
                >
                  {voice.avatarEmoji}
                </div>
                <span className={`text-[10px] font-medium ${isSelected ? "text-teal" : "text-white/35"}`}>
                  {language === "he" ? voice.nameHe : voice.name}
                </span>
                <span className={`text-[9px] capitalize ${isSelected ? "text-teal/60" : "text-white/20"}`}>
                  {voice.style}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Generate button — teal */}
      <button
        onClick={onGenerate}
        disabled={!canGenerate || generating}
        className={`w-full py-4 rounded-2xl font-semibold text-sm transition-all mt-1 ${
          canGenerate && !generating
            ? "text-bg"
            : "bg-bg-card text-white/20 border border-bg-border cursor-not-allowed"
        }`}
        style={
          canGenerate && !generating
            ? { background: "linear-gradient(135deg,#00D4FF,#0094B3)", boxShadow: "0 4px 24px rgba(0,212,255,0.35)" }
            : {}
        }
      >
        {generating ? (
          <span className="flex items-center justify-center gap-2">
            <span className="animate-pulse-slow">✨</span>
            {language === "he" ? "יוצר סיפור…" : "Generating script…"}
          </span>
        ) : (
          language === "he" ? "✨ צור סיפור" : "✨ Generate Story"
        )}
      </button>
    </div>
  );
}

// ─── Prompt tab ──────────────────────────────────────────────────────────────

interface PromptTabProps {
  promptText: string; setPromptText: (v: string) => void;
  selectedVoice: string; setSelectedVoice: (v: string) => void;
  generating: boolean;
  onGenerate: () => void;
  language: string;
}

function PromptTab({ promptText, setPromptText, selectedVoice, setSelectedVoice, generating, onGenerate, language }: PromptTabProps) {
  const canGenerate = promptText.trim().length > 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <label className="text-white/40 text-[10px] font-semibold uppercase tracking-widest mb-2 block">
          {language === "he" ? "תאר את הסיפור" : "Describe your story"}
        </label>
        <textarea
          placeholder={language === "he"
            ? "כתוב כל מה שרוצים…"
            : "Tell me anything — characters, setting, mood, how it ends… AI will craft the rest."}
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          rows={8}
          className="w-full bg-bg-card border border-bg-border rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-teal/40 transition-colors resize-none leading-relaxed"
        />
        <p className="text-white/15 text-[10px] mt-1 text-right">
          {promptText.trim().split(/\s+/).filter(Boolean).length} words
        </p>
      </div>

      <div>
        <label className="text-white/40 text-[10px] font-semibold uppercase tracking-widest mb-3 block">
          {language === "he" ? "קול ראשי" : "Primary Voice"}
        </label>
        <div className="flex gap-3">
          {VOICES.map((voice) => {
            const isSelected = selectedVoice === voice.id;
            return (
              <button key={voice.id} onClick={() => setSelectedVoice(voice.id)} className="flex flex-col items-center gap-1.5 flex-1">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl border-2 transition-all ${
                    isSelected ? "border-teal bg-bg-elevated shadow-teal-sm" : "border-bg-border bg-bg-card"
                  }`}
                >
                  {voice.avatarEmoji}
                </div>
                <span className={`text-[10px] font-medium ${isSelected ? "text-teal" : "text-white/35"}`}>
                  {language === "he" ? voice.nameHe : voice.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <button
        onClick={onGenerate}
        disabled={!canGenerate || generating}
        className={`w-full py-4 rounded-2xl font-semibold text-sm transition-all ${
          canGenerate && !generating ? "text-bg" : "bg-bg-card text-white/20 border border-bg-border cursor-not-allowed"
        }`}
        style={canGenerate && !generating ? { background: "linear-gradient(135deg,#00D4FF,#0094B3)", boxShadow: "0 4px 24px rgba(0,212,255,0.35)" } : {}}
      >
        {generating ? (
          <span className="flex items-center justify-center gap-2"><span className="animate-pulse-slow">✨</span>Generating…</span>
        ) : "✨ Generate Story"}
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

  const [activeTab, setActiveTab] = useState<ActiveTab>("wizard");
  const [generating, setGenerating] = useState(false);
  const [scriptBlocks, setScriptBlocks] = useState<ScriptBlock[]>([]);
  const [isProducing, setIsProducing] = useState(false);
  const [done, setDone] = useState(false);

  const [generateError, setGenerateError] = useState<string | null>(null);
  const hasScript = scriptBlocks.length > 0;

  const handleGenerate = async () => {
    const hasInput = activeTab === "prompt" ? promptText.trim().length > 0 : hero.trim().length > 0;
    if (!hasInput) return;
    setGenerating(true);
    setGenerateError(null);

    const settingLabel = STORY_SETTINGS.find((s) => s.id === setting)?.label ?? setting;

    const body: GenerateStoryRequest = activeTab === "prompt"
      ? { mode: "prompt", promptText, primaryVoiceId: selectedVoice }
      : { mode: "wizard", hero, setting: settingLabel, plot, primaryVoiceId: selectedVoice };

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

  const handleProduce = useCallback((blocks: ScriptBlock[]) => {
    setIsProducing(true);
    console.info("[NightStory] Producing:", blocks);
    setTimeout(() => { setIsProducing(false); setDone(true); }, 3000);
  }, []);

  const handleReset = () => {
    setDone(false); setHero(""); setPlot(""); setSetting("");
    setPromptText(""); setScriptBlocks([]); setActiveTab("wizard");
  };

  if (done) {
    return (
      <div className="relative min-h-full flex flex-col items-center justify-center px-5 text-center">
        <StarField count={40} />
        <div className="relative">
          <div className="text-7xl mb-4 animate-pulse-slow">✨</div>
          <h2 className="text-2xl font-bold text-white mb-2">Story Produced!</h2>
          <p className="text-white/40 text-sm mb-8">Your magical story is ready to listen.</p>
          <div className="flex gap-3 justify-center">
            <a href="/player" className="btn-vivid text-sm px-6 py-3">▶ Listen Now</a>
            <button onClick={handleReset} className="btn-outline text-sm px-6 py-3">Create Another</button>
          </div>
        </div>
      </div>
    );
  }

  const TABS: { id: ActiveTab; label: string }[] = [
    { id: "wizard", label: language === "he" ? "אשף" : "Wizard" },
    { id: "prompt", label: language === "he" ? "טקסט חופשי" : "Text Prompt" },
    { id: "script", label: language === "he" ? "סיפור שנוצר" : "Generated Script" },
  ];

  return (
    <div className="relative min-h-full bg-bg" dir={isRTL ? "rtl" : "ltr"}>
      <StarField count={25} />

      <div className="relative px-5 pt-12 pb-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <a href="/" className="w-8 h-8 rounded-full bg-bg-card border border-bg-border flex items-center justify-center text-white/40 hover:text-white transition-colors">
            ←
          </a>
          <div>
            <h1 className="text-lg font-bold text-white">
              {language === "he" ? "צור סיפור" : "Story Creator"}
            </h1>
            <p className="text-white/30 text-xs">AI writes · you direct</p>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-bg-border mb-6">
          {TABS.map(({ id, label }) => {
            const isActive = activeTab === id;
            const isDisabled = id === "script" && !hasScript;
            return (
              <button
                key={id}
                onClick={() => !isDisabled && setActiveTab(id)}
                disabled={isDisabled}
                className={`relative flex-1 pb-3 text-xs font-semibold transition-colors ${
                  isActive ? "text-white" : isDisabled ? "text-white/15 cursor-not-allowed" : "text-white/35 hover:text-white/60"
                }`}
              >
                <span className="flex items-center justify-center gap-1.5">
                  {label}
                  {id === "script" && (
                    <span className={`w-1.5 h-1.5 rounded-full ${hasScript ? "bg-teal animate-pulse" : "bg-white/10"}`} />
                  )}
                </span>
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full" style={{ background: "linear-gradient(90deg,#00D4FF,#8B5CF6)" }} />
                )}
              </button>
            );
          })}
        </div>

        {/* API error banner */}
        {generateError && (
          <div className="mb-4 px-4 py-3 rounded-2xl bg-pink/10 border border-pink/30 text-pink text-xs leading-relaxed">
            ⚠ {generateError}
          </div>
        )}

        {activeTab === "wizard" && (
          <WizardTab hero={hero} setHero={setHero} setting={setting} setSetting={setSetting}
            plot={plot} setPlot={setPlot} selectedVoice={selectedVoice} setSelectedVoice={setSelectedVoice}
            generating={generating} onGenerate={handleGenerate} language={language} />
        )}
        {activeTab === "prompt" && (
          <PromptTab promptText={promptText} setPromptText={setPromptText}
            selectedVoice={selectedVoice} setSelectedVoice={setSelectedVoice}
            generating={generating} onGenerate={handleGenerate} language={language} />
        )}
        {activeTab === "script" && (
          <ScriptTab blocks={scriptBlocks} voices={VOICES} onBlocksChange={setScriptBlocks}
            onProduce={handleProduce} isProducing={isProducing} />
        )}
      </div>
    </div>
  );
}
