import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// Kept in sync with the seed value in supabase/app-settings-migration.sql —
// used whenever the table/row isn't there yet (migration not run).
const DEFAULT_APP_VERSION = "1.3.0";

// Tolerant of the migration not having been run yet (table missing), same
// pattern as /api/admin/tts-engine-settings.
export async function GET() {
  let version = DEFAULT_APP_VERSION;
  try {
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "app_version")
      .maybeSingle();
    if (!error && data?.value) version = data.value;
  } catch {
    // Supabase not configured / table missing — fall back to default.
  }
  return NextResponse.json({ version }, { headers: { "Cache-Control": "no-store" } });
}
