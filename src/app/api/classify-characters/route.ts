import { NextRequest, NextResponse } from "next/server";
import { classifyCharacters } from "@/lib/services/characterClassifier";

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "No API key" }, { status: 500 });

  let characters: string[], summary: string | undefined, scriptSample: string | undefined;
  try {
    ({ characters, summary, scriptSample } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (!characters?.length) return NextResponse.json({});

  const result = await classifyCharacters(characters, summary, scriptSample, apiKey);
  return NextResponse.json(result);
}
