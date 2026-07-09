import fs from "fs";
import path from "path";
import type { ScriptBlock, StoryScene } from "@/types";
import { geminiPost, geminiText } from "@/lib/geminiClient";

// Scene-breakdown policy lives in config/story-guidance.txt (the single source
// of truth for all narrative-generation rules) — extracted here so an edit to
// that file doesn't require a code change to take effect.
function readSceneGuidance(): string {
  try {
    const full = fs.readFileSync(path.join(process.cwd(), "config", "story-guidance.txt"), "utf-8");
    const marker = "SCENE BREAKDOWN (POST-PRODUCTION SCENE MAP)";
    const idx = full.indexOf(marker);
    return idx === -1 ? "" : full.slice(idx).trim();
  } catch {
    return "";
  }
}

export async function generateScenes(blocks: ScriptBlock[], geminiKey: string): Promise<StoryScene[]> {
  const script = blocks
    .map((b, i) => `[${i}] ${b.characterName}: ${b.textPayload}`)
    .join("\n");

  const guidance = readSceneGuidance();
  const prompt = `${guidance}

The script below has ${blocks.length} blocks, indexed 0 to ${blocks.length - 1} — lineRange must cover exactly this range.

Script:
${script}`;

  try {
    const { data } = await geminiPost(geminiKey, "gemini-3.5-flash", {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      // thinkingBudget 0: scene segmentation follows explicit written rules,
      // and this runs inside produce-drama's parallel planning step where the
      // slowest call gates the whole phase — default-on thinking was quietly
      // making this the long pole.
      generationConfig: { temperature: 0.4, thinkingConfig: { thinkingBudget: 0 } },
    });
    const text = geminiText(data).replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    const raw = JSON.parse(text) as Array<{
      sceneNumber: number; title: string; summary: string;
      primaryMood: string; sfxTags: string[];
      lineRange: { start: number; end: number };
    }>;
    return raw.map((s) => {
      const { start, end } = s.lineRange ?? { start: 0, end: blocks.length - 1 };
      const sceneBlocks = blocks.slice(start, end + 1).filter((b) => b.characterName !== "SFX");
      const words = sceneBlocks.reduce((sum, b) => sum + b.textPayload.trim().split(/\s+/).filter(Boolean).length, 0);
      return { ...s, estimatedDurationSeconds: Math.ceil(words / (130 / 60)) };
    });
  } catch (err) {
    console.warn(`[sceneGenerator] generateScenes failed:`, err);
    return [];
  }
}
