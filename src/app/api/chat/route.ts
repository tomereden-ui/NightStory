import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";
import { trackGemini } from "@/lib/usageTracker";

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
}

function buildChildContext(p: ChildProfileCtx | null | undefined): string {
  if (!p || !p.name) return "";
  const parts: string[] = [`Child's name: ${p.name}`, `Age: ${p.age ?? "unknown"}`];
  if (p.gender && p.gender !== "other") parts.push(`Gender: ${p.gender}`);
  if (p.favorite_themes?.length) parts.push(`Favourite story themes: ${p.favorite_themes.join(", ")}`);
  if (p.interests) parts.push(`Interests: ${p.interests}`);
  return `\n\nACTIVE CHILD PROFILE\n====================\n${parts.join("\n")}\nUse this profile to personalise your greeting (use the child's name!) and to bias story suggestions toward their interests and age-appropriate language.`;
}

function loadChatGuide(): string {
  try {
    return fs.readFileSync(path.join(process.cwd(), "config", "gemini-chat-guide.txt"), "utf-8");
  } catch {
    return "You are Luna, a friendly story guide for a children's bedtime story app. Guide the user to describe their ideal story through a warm, playful conversation.";
  }
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured." }, { status: 500 });
  }

  let messages: ChatMessage[];
  let childProfile: ChildProfileCtx | null = null;
  try {
    const body = await req.json();
    messages = body.messages ?? [];
    childProfile = body.childProfile ?? null;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: loadChatGuide() + buildChildContext(childProfile),
    });

    // Empty messages = initial greeting trigger
    if (messages.length === 0) {
      const result = await model.generateContent("BEGIN_CONVERSATION");
      const tokens = result.response.usageMetadata?.totalTokenCount;
      if (tokens) trackGemini(tokens).catch(() => {});
      return NextResponse.json({ reply: result.response.text().trim(), storyReady: false });
    }

    // Build history from all messages except the last user message
    const history = messages.slice(0, -1).map((m) => ({
      role: m.role,
      parts: [{ text: m.content }],
    }));

    const chat = model.startChat({ history });
    const lastMessage = messages[messages.length - 1].content;

    const result = await chat.sendMessage(lastMessage);
    const tokens = result.response.usageMetadata?.totalTokenCount;
    if (tokens) trackGemini(tokens).catch(() => {});

    const raw = result.response.text();

    // Detect STORY_READY signal
    const readyMatch = raw.match(/\[STORY_READY\]([\s\S]*?)\[\/STORY_READY\]/);
    if (readyMatch) {
      let storyParams: Record<string, string> | undefined;
      try {
        storyParams = JSON.parse(readyMatch[1].trim());
      } catch { /* ignore — proceed without params */ }

      const reply = raw.replace(/\[STORY_READY\][\s\S]*?\[\/STORY_READY\]/, "").trim();
      return NextResponse.json({ reply, storyReady: true, storyParams });
    }

    return NextResponse.json({ reply: raw.trim(), storyReady: false });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
