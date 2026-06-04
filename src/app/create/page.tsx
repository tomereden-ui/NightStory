"use client";

import { useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import StarField from "@/components/ui/StarField";
import { VOICES } from "@/lib/mockData";

const SETTINGS = [
  { id: "magic-forest", label: "Magic Forest", labelHe: "יער קסום", emoji: "🌲" },
  { id: "dinosaurs", label: "Dinosaurs", labelHe: "דינוזאורים", emoji: "🦕" },
  { id: "space", label: "Space", labelHe: "חלל", emoji: "🚀" },
  { id: "underwater", label: "Underwater", labelHe: "מתחת למים", emoji: "🐚" },
  { id: "dragons", label: "Dragons", labelHe: "דרקונים", emoji: "🐉" },
  { id: "fairies", label: "Fairies", labelHe: "פיות", emoji: "🧚" },
];

export default function CreatePage() {
  const { language, isRTL } = useLanguage();
  const [hero, setHero] = useState("");
  const [setting, setSetting] = useState("");
  const [plot, setPlot] = useState("");
  const [selectedVoice, setSelectedVoice] = useState(VOICES[0].id);
  const [generating, setGenerating] = useState(false);
  const [done, setDone] = useState(false);

  const handleGenerate = () => {
    if (!hero.trim()) return;
    setGenerating(true);
    setTimeout(() => { setGenerating(false); setDone(true); }, 2500);
  };

  if (done) {
    return (
      <div className="relative min-h-full flex flex-col items-center justify-center px-5 text-center">
        <StarField count={40} />
        <div className="relative">
          <div className="text-7xl mb-4 animate-pulse-slow">✨</div>
          <h2 className="text-2xl font-bold text-white mb-2">Story Created!</h2>
          <p className="text-white/40 text-sm mb-8">Your magical story is ready to listen.</p>
          <div className="flex gap-3 justify-center">
            <a href="/player" className="btn-vivid text-sm px-6 py-3">▶ Listen Now</a>
            <button onClick={() => { setDone(false); setHero(""); setPlot(""); setSetting(""); }} className="btn-outline text-sm px-6 py-3">Create Another</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-full" dir={isRTL ? "rtl" : "ltr"}>
      <StarField count={30} />

      <div className="relative px-5 pt-12 pb-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <a href="/" className="w-8 h-8 rounded-full bg-bg-card border border-bg-border flex items-center justify-center text-white/40 hover:text-white transition-colors">
            ←
          </a>
          <div>
            <h1 className="text-xl font-bold text-white">
              {language === "he" ? "צור סיפור" : "Story Creator"}
            </h1>
            <p className="text-white/30 text-xs">
              {language === "he" ? "AI יכתוב עבורך" : "AI will write it for you"}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-5">
          {/* Hero */}
          <div>
            <label className="text-white/60 text-xs font-medium uppercase tracking-widest mb-2 block">
              {language === "he" ? "מי הגיבור?" : "Main Character"}
            </label>
            <input
              type="text"
              placeholder={language === "he" ? "לדוגמה: ילדה אמיצה..." : "e.g. a brave little girl..."}
              value={hero}
              onChange={(e) => setHero(e.target.value)}
              className="w-full bg-bg-card border border-bg-border rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-purple/50 transition-colors"
            />
          </div>

          {/* Setting */}
          <div>
            <label className="text-white/60 text-xs font-medium uppercase tracking-widest mb-2 block">
              {language === "he" ? "איפה זה קורה?" : "Setting"}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {SETTINGS.map((s) => (
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
            <label className="text-white/60 text-xs font-medium uppercase tracking-widest mb-2 block">
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

          {/* Voice */}
          <div>
            <label className="text-white/60 text-xs font-medium uppercase tracking-widest mb-2 block">
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
                  <span className={`text-[9px] ${selectedVoice === voice.id ? "text-teal" : "text-white/25"}`}>
                    {voice.style}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Generate */}
          <button
            onClick={handleGenerate}
            disabled={!hero.trim() || generating}
            className={`w-full py-4 rounded-2xl font-semibold text-sm transition-all ${
              hero.trim() && !generating
                ? "btn-vivid"
                : "bg-bg-card text-white/20 border border-bg-border cursor-not-allowed"
            }`}
          >
            {generating ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-pulse-slow">✨</span>
                {language === "he" ? "יוצר סיפור..." : "Generating story..."}
              </span>
            ) : (
              <span>✨ {language === "he" ? "צור סיפור" : "Generate Story"}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
