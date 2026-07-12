import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { TTS_ENGINES, DEFAULT_ENGINE_SETTINGS, type EngineSettings, type TtsEngine } from "@/config/ttsEngines";

export const dynamic = "force-dynamic";

const ENGINE_IDS = new Set<string>(TTS_ENGINES.map((e) => e.id));

// Tolerant of the migration not having been run yet (table missing) — same
// pattern as /api/voice-preview-samples, so the Voice Manager screen and
// production ttsService.ts both degrade to DEFAULT_ENGINE_SETTINGS instead
// of erroring.
export async function GET() {
  const settings: EngineSettings = { ...DEFAULT_ENGINE_SETTINGS };
  try {
    const { data, error } = await supabase.from("tts_engine_settings").select("engine, enabled");
    if (!error) {
      for (const row of data ?? []) {
        if (ENGINE_IDS.has(row.engine)) settings[row.engine as TtsEngine] = row.enabled;
      }
    }
  } catch {
    // Supabase not configured / table missing — fall back to defaults.
  }
  return NextResponse.json({ settings }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  let body: { settings?: Partial<Record<string, boolean>> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const entries = Object.entries(body.settings ?? {}).filter(([engine]) => ENGINE_IDS.has(engine));
  if (entries.length === 0) {
    return NextResponse.json({ error: "settings must include at least one known engine id." }, { status: 400 });
  }

  const rows = entries.map(([engine, enabled]) => ({ engine, enabled: !!enabled, updated_at: new Date().toISOString() }));
  const { error } = await supabase.from("tts_engine_settings").upsert(rows, { onConflict: "engine" });
  if (error) {
    return NextResponse.json({ error: `DB write failed: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
