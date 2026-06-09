"use client";

import { useState, useCallback } from "react";
import { useLanguage } from "@/context/LanguageContext";
import StarField from "@/components/ui/StarField";
import ScriptTab from "@/components/studio/ScriptTab";
import { VOICES, STORY_SETTINGS } from "@/lib/mockData";
import type { ScriptBlock } from "@/types";
import type { GenerateStoryRequest } from "@/app/api/generate-story/route";

type ActiveTab = "wizard" | "prompt" | "script";

// Per-voice accent colors matching mockup
const VOICE_ACCENTS = ["#00D4FF", "#8B5CF6", "#EC4899", "#10D9A0"];

// Atmospheric gradient backgrounds for each setting card
const SETTING_BG: Record<string, string> = {
  "magic-forest": "radial-gradient(ellipse at 40% 30%, #0f4422 0%, #062414 60%, #020e06 100%)",
  "dinosaurs":    "radial-gradient(ellipse at 50% 65%, #1e4010 0%, #0e2208 55%, #060e03 100%)",
  "space":        "radial-gradient(ellipse at 50% 25%, #1e0d56 0%, #09062e 55%, #020118 100%)",
  "underwater":   "radial-gradient(ellipse at 50% 40%, #054266 0%, #022035 55%, #01101c 100%)",
  "dragons":      "radial-gradient(ellipse at 45% 35%, #441408 0%, #220a04 55%, #0e0402 100%)",
  "fairies":      "radial-gradient(ellipse at 50% 35%, #420d66 0%, #21083a 55%, #0e0418 100%)",
};

// ─── Wizard tab ──────────────────────────────────────────────────────────────

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
      {/* Who is the hero? */}
      <div>
        <label className="text-white/40 text-[10px] font-semibold uppercase tracking-widest mb-2 block">
          {language === "he" ? "מי הגיבור?" : "Who is the hero?"}
        </label>
        <div className="relative">
          <input
            type="text"
            placeholder={language === "he" ? "לדוגמה: ילדה אמיצה בשם מיה…" : "e.g. a brave little girl named Mia…"}
            value={hero}
            onChange={(e) => setHero(e.target.value)}
            className="w-full bg-bg-card border border-bg-border rounded-xl px-4 py-3 pr-10 text-sm text-white placeholder-white/20 outline-none focus:border-purple/50 transition-colors"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-purple/50 text-base pointer-events-none">✨</span>
        </div>
      </div>

      {/* Where does it happen? — 3-column image grid */}
      <div>
        <label className="text-white/40 text-[10px] font-semibold uppercase tracking-widest mb-3 block">
          {language === "he" ? "איפה זה קורה?" : "Where does it happen?"}
        </label>
        <div className="grid grid-cols-3 gap-2.5">
          {STORY_SETTINGS.map((s) => {
            const isSelected = setting === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setSetting(isSelected ? "" : s.id)}
                className={`relative aspect-square flex flex-col items-center justify-end pb-2.5 rounded-2xl overflow-hidden border-2 transition-all active:scale-95 ${
                  isSelected ? "border-purple/60 scale-[1.03]" : "border-white/5 hover:border-white/15"
                }`}
                style={{ background: SETTING_BG[s.id] ?? "#0E1225" }}
              >
                {/* Glow overlay on select */}
                {isSelected && (
                  <div className="absolute inset-0 pointer-events-none"
                    style={{ background: "radial-gradient(circle at 50% 40%, rgba(139,92,246,0.28), transparent 70%)" }} />
                )}
                {/* Emoji */}
                <span className="absolute inset-0 flex items-center justify-center text-4xl" style={{ paddingBottom: "18px" }}>
                  {s.emoji}
                </span>
                {/* Label */}
                <span className={`relative z-10 text-[10px] font-semibold ${isSelected ? "text-purple-bright" : "text-white/55"}`}>
                  {language === "he" ? s.labelHe : s.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* What happens? */}
      <div>
        <label className="text-white/40 text-[10px] font-semibold uppercase tracking-widest mb-2 block">
          {language === "he" ? "מה יקרה?" : "What happens?"}
        </label>
        <textarea
          placeholder={language === "he" ? "תאר את העלילה… (אופציונלי)" : "Describe the plot… or leave blank for a surprise!"}
          value={plot}
          onChange={(e) => setPlot(e.target.value)}
          rows={3}
          className="w-full bg-bg-card border border-bg-border rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-purple/50 transition-colors resize-none"
        />
      </div>

      {/* Who is reading? — per-voice accent colors */}
      <div>
        <label className="text-white/40 text-[10px] font-semibold uppercase tracking-widest mb-3 block">
          {language === "he" ? "מי מספר?" : "Who is reading?"}
        </label>
        <div className="flex gap-3">
          {VOICES.map((voice, idx) => {
            const isSelected = selectedVoice === voice.id;
            const accent = VOICE_ACCENTS[idx] ?? "#8B5CF6";
            return (
              <button
                key={voice.id}
                onClick={() => setSelectedVoice(voice.id)}
                className="flex flex-col items-center gap-1.5 flex-1"
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-2xl transition-all"
                  style={
                    isSelected
                      ? { border: `2px solid ${accent}`, background: "#131729", boxShadow: `0 0 0 3px ${accent}28, 0 0 14px ${accent}40` }
                      : { border: "2px solid rgba(255,255,255,0.08)", background: "#0E1225" }
                  }
                >
                  {voice.avatarEmoji}
                </div>
                <span className="text-[10px] font-medium transition-colors" style={{ color: isSelected ? accent : "rgba(255,255,255,0.35)" }}>
                  {language === "he" ? voice.nameHe : voice.name}
                </span>
                <span className="text-[9px] capitalize text-white/20">{voice.style}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Generate button — purple/pink */}
      <button
        onClick={onGenerate}
        disabled={!canGenerate || generating}
        className={`w-full py-4 rounded-2xl font-semibold text-sm transition-all active:scale-[0.98] ${
          canGenerate && !generating ? "text-white" : "bg-bg-card text-white/20 border border-bg-border cursor-not-allowed"
        }`}
        style={
          canGenerate && !generating
            ? { background: "linear-gradient(135deg,#8B5CF6,#EC4899)", boxShadow: "0 4px 24px rgba(139,92,246,0.45)" }
            : {}
        }
      >
        {generating ? (
          <span className="flex items-center justify-center gap-2">
            <span className="animate-pulse-slow">✨</span>
            {language === "he" ? "יוצר סיפור…" : "Generating story…"}
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
          {language === "he" ? "ספר לי על הסיפור" : "Tell me about the story"}
        </label>
        <textarea
          placeholder={language === "he"
            ? "כתוב כל מה שרוצים — דמויות, מקום, מצב רוח, סוף…"
            : "Describe anything — characters, setting, mood, how it ends… AI will craft the rest."}
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          rows={8}
          className="w-full bg-bg-card border border-bg-border rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-purple/40 transition-colors resize-none leading-relaxed"
        />
        <p className="text-white/15 text-[10px] mt-1 text-right">
          {promptText.trim().split(/\s+/).filter(Boolean).length} words
        </p>
      </div>

      <div>
        <label className="text-white/40 text-[10px] font-semibold uppercase tracking-widest mb-3 block">
          {language === "he" ? "מי מספר?" : "Who is reading?"}
        </label>
        <div className="flex gap-3">
          {VOICES.map((voice, idx) => {
            const isSelected = selectedVoice === voice.id;
            const accent = VOICE_ACCENTS[idx] ?? "#8B5CF6";
            return (
              <button key={voice.id} onClick={() => setSelectedVoice(voice.id)} className="flex flex-col items-center gap-1.5 flex-1">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-2xl transition-all"
                  style={
                    isSelected
                      ? { border: `2px solid ${accent}`, background: "#131729", boxShadow: `0 0 0 3px ${accent}28` }
                      : { border: "2px solid rgba(255,255,255,0.08)", background: "#0E1225" }
                  }
                >
                  {voice.avatarEmoji}
                </div>
                <span className="text-[10px] font-medium" style={{ color: isSelected ? accent : "rgba(255,255,255,0.35)" }}>
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
        className={`w-full py-4 rounded-2xl font-semibold text-sm transition-all active:scale-[0.98] ${
          canGenerate && !generating ? "text-white" : "bg-bg-card text-white/20 border border-bg-border cursor-not-allowed"
        }`}
        style={canGenerate && !generating ? { background: "linear-gradient(135deg,#8B5CF6,#EC4899)", boxShadow: "0 4px 24px rgba(139,92,246,0.45)" } : {}}
      >
        {generating ? (
          <span className="flex items-center justify-center gap-2"><span className="animate-pulse-slow">✨</span>Generating story…</span>
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
    setGenerateError(null);
  };

  if (done) {
    return (
      <div className="relative min-h-full flex flex-col items-center justify-center px-5 text-center">
        <StarField count={40} />
        <div className="relative">
          <div className="text-7xl mb-4 animate-pulse-slow">✨</div>
          <h2 className="text-2xl font-bold text-white mb-2">Story Ready!</h2>
          <p className="text-white/40 text-sm mb-8">Your magical story is ready to listen.</p>
          <div className="flex gap-3 justify-center">
            <a href="/player" className="text-white text-sm font-semibold px-6 py-3 rounded-2xl"
              style={{ background: "linear-gradient(135deg,#8B5CF6,#EC4899)", boxShadow: "0 4px 20px rgba(139,92,246,0.4)" }}>
              ▶ Listen Now
            </a>
            <button onClick={handleReset}
              className="text-white/60 text-sm font-semibold px-6 py-3 rounded-2xl border border-white/10 hover:border-white/25 transition-all">
              Create Another
            </button>
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

  // Generating overlay
  if (generating) {
    const messages = [
      "Weaving your story…",
      "Giving voice to the characters…",
      "Painting the setting with words…",
      "Sprinkling a little magic…",
    ];
    return (
      <div className="relative min-h-full bg-bg flex flex-col items-center justify-center px-8 text-center">
        <StarField count={50} />
        <div className="relative flex flex-col items-center gap-6">
          {/* Pulsing orb */}
          <div className="relative w-24 h-24 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full animate-ping opacity-20"
              style={{ background: "radial-gradient(circle, #8B5CF6, #EC4899)" }} />
            <div className="absolute inset-2 rounded-full opacity-40 animate-pulse"
              style={{ background: "radial-gradient(circle, #8B5CF6, #EC4899)" }} />
            <span className="relative text-5xl animate-pulse-slow">✨</span>
          </div>

          <div>
            <h2 className="text-white text-xl font-bold mb-2">
              {language === "he" ? "יוצר את הסיפור שלך…" : "Crafting your story…"}
            </h2>
            <p className="text-white/35 text-sm">
              {language === "he" ? "זה ייקח כמה שניות" : messages[Math.floor(Date.now() / 1000) % messages.length]}
            </p>
          </div>

          {/* Animated dots */}
          <div className="flex gap-2">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="w-2 h-2 rounded-full"
                style={{
                  background: "linear-gradient(135deg,#8B5CF6,#EC4899)",
                  animation: `bounce 1s ease-in-out ${i * 0.15}s infinite`,
                }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-full bg-bg" dir={isRTL ? "rtl" : "ltr"}>
      <StarField count={25} />

      <div className="relative px-5 pt-12 pb-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <a href="/" className="w-8 h-8 rounded-full bg-bg-card border border-bg-border flex items-center justify-center text-white/40 hover:text-white transition-colors flex-shrink-0">
            ←
          </a>
          <div>
            <h1 className="text-base font-bold text-white leading-tight">
              {language === "he" ? "ספר סיפור" : "Tell a Story"}
            </h1>
            <p className="text-white/30 text-[11px]">
              {language === "he" ? "בואו ניצור חלום הלילה ✨" : "Let's create a dream tonight ✨"}
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
                className={`relative flex-1 pb-3 text-[11px] font-semibold transition-colors ${
                  isActive ? "text-white" : isDisabled ? "text-white/15 cursor-not-allowed" : "text-white/35 hover:text-white/60"
                }`}
              >
                <span className="flex items-center justify-center gap-1.5">
                  {label}
                  {id === "script" && (
                    <span className={`w-1.5 h-1.5 rounded-full ${hasScript ? "bg-purple animate-pulse" : "bg-white/10"}`} />
                  )}
                </span>
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                    style={{ background: "linear-gradient(90deg,#8B5CF6,#EC4899)" }} />
                )}
              </button>
            );
          })}
        </div>

        {/* Error banner */}
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
