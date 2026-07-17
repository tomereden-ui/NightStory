import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { TTS_ENGINES, DEFAULT_ENGINE_SETTINGS, DEFAULT_ENGINE_PRIORITY, type EngineSettings, type EnginePriority, type TtsEngine } from "@/config/ttsEngines";

export const dynamic = "force-dynamic";

const ENGINE_IDS = new Set<string>(TTS_ENGINES.map((e) => e.id));

// Tolerant of the migration not having been run yet (table missing, or the
// priority column not added yet) — same pattern as /api/voice-preview-samples,
// so the Voice Manager screen and production ttsService.ts both degrade to
// the DEFAULT_ constants instead of erroring.
export async function GET() {
  const settings: EngineSettings = { ...DEFAULT_ENGINE_SETTINGS };
  const priority: EnginePriority = { ...DEFAULT_ENGINE_PRIORITY };
  try {
    const { data, error } = await supabase.from("tts_engine_settings").select("engine, enabled, priority");
    if (!error) {
      for (const row of data ?? []) {
        if (!ENGINE_IDS.has(row.engine)) continue;
        settings[row.engine as TtsEngine] = row.enabled;
        if (row.priority === null || row.priority === undefined) {
          delete priority[row.engine as TtsEngine];
        } else {
          priority[row.engine as TtsEngine] = row.priority;
        }
      }
    }
  } catch {
    // Supabase not configured / table missing — fall back to defaults.
  }
  return NextResponse.json({ settings, priority }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  let body: { settings?: Partial<Record<string, boolean>>; priority?: Partial<Record<string, number | null>> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const settingsEntries = Object.entries(body.settings ?? {}).filter(([engine]) => ENGINE_IDS.has(engine));
  const priorityEntries = Object.entries(body.priority ?? {}).filter(([engine]) => ENGINE_IDS.has(engine));
  if (settingsEntries.length === 0 && priorityEntries.length === 0) {
    return NextResponse.json({ error: "settings or priority must include at least one known engine id." }, { status: 400 });
  }

  // Merge by engine so a single request touching both `enabled` and
  // `priority` for the same engine produces one upsert row, not two
  // conflicting ones in the same batch.
  const rowsByEngine = new Map<string, { engine: string; enabled?: boolean; priority?: number | null; updated_at: string }>();
  const now = new Date().toISOString();
  for (const [engine, enabled] of settingsEntries) {
    rowsByEngine.set(engine, { ...rowsByEngine.get(engine), engine, enabled: !!enabled, updated_at: now });
  }
  for (const [engine, priority] of priorityEntries) {
    rowsByEngine.set(engine, { ...rowsByEngine.get(engine), engine, priority: priority ?? null, updated_at: now });
  }

  const { error } = await supabase
    .from("tts_engine_settings")
    .upsert(Array.from(rowsByEngine.values()), { onConflict: "engine" });
  if (error) {
    return NextResponse.json({ error: `DB write failed: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
