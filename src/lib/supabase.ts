import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local"
    );
  }
  _client = createClient(url, serviceKey, { auth: { persistSession: false } });
  return _client;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getClient() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

let bucketsReady = false;
export async function ensureBuckets() {
  if (bucketsReady) return;
  for (const name of ["audio", "covers", "voice-avatars"]) {
    const { error } = await supabase.storage.createBucket(name, { public: true });
    if (error && !error.message.toLowerCase().includes("already exists")) {
      console.warn(`[Storage] bucket ${name}:`, error.message);
    }
  }
  bucketsReady = true;
}
