import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";
import { trackGemini } from "@/lib/usageTracker";
import { LANGUAGE_META } from "@/lib/i18n";
import type { Language } from "@/types";

export const dynamic = "force-dynamic";

interface ChatMessage {
  role: "user" | "model";
  content: string;
}

interface ChildProfileCtx {
  name?: string;
  age?: number;
  gender?: string;
  favorite_themes?: string[];
  interests?: string;
  avoid?: string;
}

function buildChildContext(p: ChildProfileCtx | null | undefined): string {
  if (!p || !p.name) return "";
  const parts: string[] = [`Child's name: ${p.name}`, `Age: ${p.age ?? "unknown"}`];
  if (p.gender && p.gender !== "other") parts.push(`Gender: ${p.gender}`);
  if (p.favorite_themes?.length) parts.push(`Favourite story themes: ${p.favorite_themes.join(", ")}`);
  if (p.interests) parts.push(`Interests: ${p.interests}`);
  const avoidPart = p.avoid
    ? `\n\nCONTENT TO STRICTLY AVOID\n--------------------------\n${p.avoid}\nNEVER include these elements in any story suggestion or generated story. This is a hard rule — not a preference.`
    : "";
  return `\n\nACTIVE CHILD PROFILE\n====================\n${parts.join("\n")}\nUse this profile to personalise your greeting (use the child's name!) and to bias story suggestions toward their interests and age-appropriate language. In languages with grammatical gender (Hebrew, Arabic, French, Spanish, Italian, Portuguese, German, etc.), any adjective, endearment, or verb form addressed directly TO the child (e.g. "sweet {name}") must agree with the Gender field above — never default to the masculine form for a girl. If Gender is not given, use neutral phrasing or the child's name alone instead of guessing. This is separate from the story's own protagonist, whose gender is governed only by what the user describes in the story.${avoidPart}`;
}

function loadChatGuide(): string {
  try {
    return fs.readFileSync(path.join(process.cwd(), "config", "gemini-chat-guide.txt"), "utf-8");
  } catch {
    return "You are Luna, a friendly story guide for a children's bedtime story app. Guide the user to describe their ideal story through a warm, playful conversation.";
  }
}

// When the user has explicitly picked a language (via the reset+language
// control in the chat panel), that choice must win over the guide's default
// "mirror the user's language" rule — otherwise the greeting (which has no
// user text yet to mirror) can't be steered at all.
function languageOverride(language?: string): string {
  if (!language) return "";
  const meta = LANGUAGE_META[language as Language];
  if (!meta) return "";
  return `\n\nLANGUAGE OVERRIDE\n=================\nAlways respond in ${meta.label} (${meta.nativeName}), regardless of what language the user writes in. This takes priority over the "mirror the user's language" rule above.`;
}

// Once Luna herself judges there's enough to go on (storyReady), the UI
// still asks "anything else, or ready?" -- normally answered by tapping a
// quick-reply chip. But if the user's own last message already says so in
// plain words ("yes let's go", "start it now", etc., in any language),
// that should count as the same confirmation instead of forcing a redundant
// tap. This is a tiny, separate, cheap classification call (not part of the
// main conversational reply) so it never leaks into what Luna actually says.
async function detectExplicitGoAhead(genAI: GoogleGenerativeAI, lastUserMessage: string): Promise<boolean> {
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-3.5-flash",
      systemInstruction: `Does this message from a parent explicitly say they're ready/want to proceed with creating the story now (e.g. "yes let's go", "create it", "start now", "go ahead", "that's everything, make it"), in any language? Answer with ONLY the single word true or false — nothing else.`,
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 5,
        // @ts-expect-error thinkingConfig is valid but not yet in the SDK's typedefs
        thinkingConfig: { thinkingBudget: 0 },
      },
    });
    const result = await model.generateContent(lastUserMessage);
    const tokens = result.response.usageMetadata?.totalTokenCount;
    if (tokens) trackGemini(tokens).catch(() => {});
    return result.response.text().trim().toLowerCase().startsWith("true");
  } catch {
    // A classification hiccup shouldn't block anything -- the quick-reply
    // chip is still there as the normal path.
    return false;
  }
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured." }, { status: 500 });
  }

  let messages: ChatMessage[];
  let childProfile: ChildProfileCtx | null = null;
  let language: string | undefined;
  try {
    const body = await req.json();
    messages = body.messages ?? [];
    childProfile = body.childProfile ?? null;
    language = body.language ?? undefined;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-3.5-flash",
      systemInstruction: loadChatGuide() + buildChildContext(childProfile) + languageOverride(language),
      generationConfig: {
        // Luna's replies are short conversational turns following an explicit
        // guide — no reasoning chain needed. Without any generationConfig,
        // gemini-3.5-flash thinks by default, adding seconds of dead air to
        // every single chat turn.
        // @ts-expect-error thinkingConfig is valid but not yet in the SDK's typedefs
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    // Empty messages = initial greeting trigger
    if (messages.length === 0) {
      const result = await model.generateContent("BEGIN_CONVERSATION");
      const tokens = result.response.usageMetadata?.totalTokenCount;
      if (tokens) trackGemini(tokens).catch(() => {});
      return NextResponse.json({ reply: result.response.text().trim(), storyReady: false });
    }

    // Build history from all messages except the last user message.
    // Gemini requires history to start with a user turn — if the first stored
    // message is the model greeting, prepend the synthetic trigger it responded to.
    const rawHistory = messages.slice(0, -1).map((m) => ({
      role: m.role as "user" | "model",
      parts: [{ text: m.content }],
    }));
    const history = rawHistory.length > 0 && rawHistory[0].role === "model"
      ? [{ role: "user" as const, parts: [{ text: "BEGIN_CONVERSATION" }] }, ...rawHistory]
      : rawHistory;

    const chat = model.startChat({ history });
    const lastMessage = messages[messages.length - 1].content;

    const result = await chat.sendMessage(lastMessage);
    const tokens = result.response.usageMetadata?.totalTokenCount;
    if (tokens) trackGemini(tokens).catch(() => {});

    const raw = result.response.text();

    // Detect STORY_READY signal
    const readyMatch = raw.match(/\[STORY_READY\]([\s\S]*?)\[\/STORY_READY\]/);
    if (readyMatch) {
      let parsed: (Record<string, string> & { clarificationChips?: unknown }) | undefined;
      try {
        parsed = JSON.parse(readyMatch[1].trim());
      } catch { /* ignore — proceed without params */ }

      // Smart Chip Strategy — when the guide is still resolving a typo or
      // invented word, it bundles guess options into the same block instead
      // of a separate signal. That's a mid-clarification pause, not a truly
      // finished concept, so it's surfaced as its own field and storyReady
      // stays false until the user picks (or re-confirms) a word.
      const clarificationChips = Array.isArray(parsed?.clarificationChips)
        ? parsed.clarificationChips.map((c) => String(c).trim()).filter(Boolean).slice(0, 4)
        : [];
      const { clarificationChips: _omit, ...storyParams } = parsed ?? {};
      const reply = raw.replace(/\[STORY_READY\][\s\S]*?\[\/STORY_READY\]/, "").trim();

      if (clarificationChips.length > 0) {
        return NextResponse.json({ reply, storyReady: false, clarificationChips });
      }

      const userConfirmedReady = await detectExplicitGoAhead(genAI, lastMessage);
      return NextResponse.json({ reply, storyReady: true, storyParams, userConfirmedReady });
    }

    return NextResponse.json({ reply: raw.trim(), storyReady: false });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
