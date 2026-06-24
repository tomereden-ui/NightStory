import { NextResponse } from "next/server";
import { generateWithImagen } from "@/lib/services/imagenClient";

export const dynamic = "force-dynamic";

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "No GEMINI_API_KEY" }, { status: 500 });

  const result = await generateWithImagen("a small red apple on a white table, simple", apiKey);
  if (!result) return NextResponse.json({ ok: false, error: "generateWithImagen returned null — check server logs" });

  return NextResponse.json({ ok: true, mimeType: result.mimeType, bytes: result.buf.length });
}
