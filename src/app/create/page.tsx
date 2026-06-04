"use client";

import { useState, useCallback } from "react";
import { useLanguage } from "@/context/LanguageContext";
import StarField from "@/components/ui/StarField";
import ScriptTab from "@/components/studio/ScriptTab";
import { VOICES, STORY_SETTINGS, generateMockScript } from "@/lib/mockData";
import type { ScriptBlock } from "@/types";

type ActiveTab = "wizard" | "prompt" | "script";

// ─── Wizard tab ────────────────────────────────────────────────────────────

interface WizardTabProps {
  hero: string; setHero: (v: string) => void;
  setting: string; setSetting: (v: string) => void;
  plot: string; setPlot: (v: string) => void;
  selectedVoice: string; setSelectedVoice: (v: string) => void;
  generating: boolean;
  onGenerate: () => void;
  language: string;
}

function WizardTab({
  hero, setHero, setting, setSetting, plot, setPlot,
  selectedVoice, setSelectedVoice, generating, onGenerate, language,
}: WizardTabProps) {
  const canGenerate = hero.trim().length > 0;
  return (
    <div className="flex flex-col gap-5">
      {/* Main character */}
      <div>
        <label className="text-white/40 text-[10px] font-semibold uppercase tracking-widest mb-2 block">
          {language === "he" ? "מי הגיבור?" : "Main Character"}
        </label>
        <input
          type="text"
          placeholder={language === "he" ? "לדוגמה: ילדה אמיצה…" : "e.g. a brave little girl…"}
          value={hero}
          onChange={(e) => setHero(e.target.value)}
          className="w-full bg-bg-card border border-bg-border rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-purple/50 transition-colors"
        />
      </div>

      {/* Setting grid */}
      <div>
        <label className="text-white/40 text-[10px] font-semibold uppercase tracking-widest mb-2 block">
          {language === "he" ? "איפה זה קורה?" : "Setting"}
        </label>
        <div className="grid grid-cols-3 gap-2">
          {STORY_SETTINGS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSetting(setting === s.id ? "" : s.id)}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
                setting === s.id
                  ? "border-purple bg-purple/15 shadow-purple-sm"
                  : "border-bg-border bg-bg-card hover:border-purple/30"
              }`}
            >
              <span className="text-2xl">{s.emoji}</span>
              <span className="text-[10px] text-white/50 font-medium">
                {language === "he" ? s.labelHe : s.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Plot */}
      <div>
        <label className="text-white/40 text-[10px] font-semibold uppercase tracking-widest mb-2 block">
          {language === "he" ? "מה קורה?" : "The Plot"}
        </label>
        <textarea
          placeholder={language === "he" ? "מה קורה בסיפור? (אופציונלי)" : "What happens in the story? (optional)"}
          value={plot}
          onChange={(e) => setPlot(e.target.value)}
          rows={3}
          className="w-full bg-bg-card border border-bg-border rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-purple/50 transition-colors resize-none"
        />
      </div>

      {/* Voice picker */}
      <div>
        <label className="text-white/40 text-[10px] font-semibold uppercase tracking-widest mb-2 block">
          {language === "he" ? "מי מספר?" : "Voice Player"}
        </label>
        <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-1">
          {VOICES.map((voice) => (
            <button
              key={voice.id}
              onClick={() => setSelectedVoice(voice.id)}
              className={`flex-shrink-0 flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl border transition-all ${
                selectedVoice === voice.id
                  ? "border-teal bg-teal/10 shadow-teal-sm"
                  : "border-bg-border bg-bg-card hover:border-teal/30"
              }`}
            >
              <span className="text-2xl">{voice.avatarEmoji}</span>
              <span className="text-[10px] text-white/60 font-medium">
                {language === "he" ? voice.nameHe : voice.name}
              </span>
              <span
                className={`text-[9px] capitalize ${
                  selectedVoice === voice.id ? "text-teal" : "text-white/25"
                }`}
              >
                {voice.style}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Generate */}
      <button
        onClick={onGenerate}
        disabled={!canGenerate || generating}
        className={`w-full py-4 rounded-2xl font-semibold text-sm transition-all ${
          canGenerate && !generating
            ? "btn-vivid"
            : "bg-bg-card text-white/20 border border-bg-border cursor-not-allowed"
        }`}
      >
        {generating ? (
          <span className="flex items-center justify-center gap-2">
            <span className="animate-pulse-slow">✨</span>
            {language === "he" ? "יוצר סיפור…" : "Generating script…"}
          </span>
        ) : (
          <span>✨ {language === "he" ? "צור סיפור" : "Generate Script"}</span>
        )}
      </button>
    </div>
  );
}

// ─── Prompt tab ─────────────────────────────────────────────────────────────

interface PromptTabProps {
  promptText: string; setPromptText: (v: string) => void;
  selectedVoice: string; setSelectedVoice: (v: string) => void;
  generating: boolean;
  onGenerate: () => void;
  language: string;
}

function PromptTab({
  promptText, setPromptText, selectedVoice, setSelectedVoice,
  generating, onGenerate, language,
}: PromptTabProps) {
  const canGenerate = promptText.trim().length > 0;
  return (
    <div className="flex flex-col gap-5">
      <div>
        <label className="text-white/40 text-[10px] font-semibold uppercase tracking-widest mb-2 block">
          {language === "he" ? "תאר את הסיפור" : "Describe your story"}
        </label>
        <textarea
          placeholder={
            language === "he"
              ? "כתוב כל מה שעל הלב…"
              : "Tell me anything — characters, setting, mood, ending… AI will craft the rest."
          }
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          rows={6}
          className="w-full bg-bg-card border border-bg-border rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-teal/40 transition-colors resize-none leading-relaxed"
          style={{
            boxShadow: promptText ? "0 0 0 1px rgba(0,212,255,0.08)" : "none",
          }}
        />
        <p className="text-white/15 text-[10px] mt-1.5 text-right">
          {promptText.trim().split(/\s+/).filter(Boolean).length} words
        </p>
      </div>

      {/* Voice */}
      <div>
        <label className="text-white/40 text-[10px] font-semibold uppercase tracking-widest mb-2 block">
          {language === "he" ? "קול ראשי" : "Primary Voice"}
        </label>
        <div className="flex gap-2.5 overflow-x-auto hide-scrollbar pb-1">
          {VOICES.map((voice) => (
            <button
              key={voice.id}
              onClick={() => setSelectedVoice(voice.id)}
              className={`flex-shrink-0 flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all ${
                selectedVoice === voice.id
                  ? "border-teal bg-teal/10 shadow-teal-sm"
                  : "border-bg-border bg-bg-card hover:border-teal/30"
              }`}
            >
              <span className="text-lg">{voice.avatarEmoji}</span>
              <div className="text-left">
                <p className={`text-xs font-medium ${selectedVoice === voice.id ? "text-teal" : "text-white/60"}`}>
                  {language === "he" ? voice.nameHe : voice.name}
                </p>
                <p className="text-[9px] text-white/25 capitalize">{voice.style}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={onGenerate}
        disabled={!canGenerate || generating}
        className={`w-full py-4 rounded-2xl font-semibold text-sm transition-all ${
          canGenerate && !generating
            ? "btn-vivid"
            : "bg-bg-card text-white/20 border border-bg-border cursor-not-allowed"
        }`}
      >
        {generating ? (
          <span className="flex items-center justify-center gap-2">
            <span className="animate-pulse-slow">✨</span>
            Generating script…
          </span>
        ) : (
          <span>✨ Generate Script</span>
        )}
      </button>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function CreatePage() {
  const { language, isRTL } = useLanguage();

  // Wizard inputs — persist across tab switches
  const [hero, setHero] = useState("");
  const [setting, setSetting] = useState("");
  const [plot, setPlot] = useState("");
  const [selectedVoice, setSelectedVoice] = useState(VOICES[0].id);
  const [promptText, setPromptText] = useState("");

  // Tab + generation state
  const [activeTab, setActiveTab] = useState<ActiveTab>("wizard");
  const [generating, setGenerating] = useState(false);
  const [scriptBlocks, setScriptBlocks] = useState<ScriptBlock[]>([]);
  const [isProducing, setIsProducing] = useState(false);
  const [done, setDone] = useState(false);

  const hasScript = scriptBlocks.length > 0;

  const handleGenerate = () => {
    const hasInput =
      activeTab === "prompt" ? promptText.trim().length > 0 : hero.trim().length > 0;
    if (!hasInput) return;

    setGenerating(true);
    setTimeout(() => {
      const blocks = generateMockScript(hero || "the hero", setting, selectedVoice);
      setScriptBlocks(blocks);
      setGenerating(false);
      setActiveTab("script");
    }, 2000);
  };

  const handleProduce = useCallback((blocks: ScriptBlock[]) => {
    setIsProducing(true);
    // Production: forward `blocks` to your audio generation service
    // e.g. await audioService.produce({ storyId: uuid(), blocks })
    console.info("[NightStory] Producing story blocks:", blocks);
    setTimeout(() => {
      setIsProducing(false);
      setDone(true);
    }, 3000);
  }, []);

  const handleReset = () => {
    setDone(false);
    setHero("");
    setPlot("");
    setSetting("");
    setPromptText("");
    setScriptBlocks([]);
    setActiveTab("wizard");
  };

  // ── Done screen ──────────────────────────────────────────────────────────
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
            <button onClick={handleReset} className="btn-outline text-sm px-6 py-3">
              Create Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Tab definitions ──────────────────────────────────────────────────────
  const TABS: { id: ActiveTab; label: string }[] = [
    { id: "wizard", label: "WIZARD" },
    { id: "prompt", label: "PROMPT" },
    { id: "script", label: "SCRIPT" },
  ];

  return (
    <div className="relative min-h-full" dir={isRTL ? "rtl" : "ltr"}>
      <StarField count={30} />

      <div className="relative px-5 pt-12 pb-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <a
            href="/"
            className="w-8 h-8 rounded-full bg-bg-card border border-bg-border flex items-center justify-center text-white/40 hover:text-white transition-colors"
          >
            ←
          </a>
          <div>
            <h1 className="text-xl font-bold text-white">
              {language === "he" ? "צור סיפור" : "Story Creator"}
            </h1>
            <p className="text-white/30 text-xs">
              {language === "he" ? "AI יכתוב עבורך" : "AI writes, you direct"}
            </p>
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
                className={`relative flex-1 pb-3 text-[11px] font-bold tracking-widest transition-colors ${
                  isActive
                    ? "text-teal"
                    : isDisabled
                    ? "text-white/15 cursor-not-allowed"
                    : "text-white/35 hover:text-white/60"
                }`}
              >
                <span className="flex items-center justify-center gap-1.5">
                  {label}
                  {/* dot: pulsing teal when script ready, muted when locked */}
                  {id === "script" && (
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        hasScript
                          ? "bg-teal animate-pulse"
                          : "bg-white/10"
                      }`}
                    />
                  )}
                </span>

                {/* Active underline */}
                {isActive && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                    style={{
                      background: "linear-gradient(90deg,#00D4FF,#8B5CF6)",
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        {activeTab === "wizard" && (
          <WizardTab
            hero={hero}
            setHero={setHero}
            setting={setting}
            setSetting={setSetting}
            plot={plot}
            setPlot={setPlot}
            selectedVoice={selectedVoice}
            setSelectedVoice={setSelectedVoice}
            generating={generating}
            onGenerate={handleGenerate}
            language={language}
          />
        )}

        {activeTab === "prompt" && (
          <PromptTab
            promptText={promptText}
            setPromptText={setPromptText}
            selectedVoice={selectedVoice}
            setSelectedVoice={setSelectedVoice}
            generating={generating}
            onGenerate={handleGenerate}
            language={language}
          />
        )}

        {activeTab === "script" && (
          <ScriptTab
            blocks={scriptBlocks}
            voices={VOICES}
            onBlocksChange={setScriptBlocks}
            onProduce={handleProduce}
            isProducing={isProducing}
          />
        )}
      </div>
    </div>
  );
}
