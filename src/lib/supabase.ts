import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false },
});

let bucketsReady = false;
export async function ensureBuckets() {
  if (bucketsReady) return;
  for (const name of ["audio", "covers"]) {
    const { error } = await supabase.storage.createBucket(name, { public: true });
    if (error && !error.message.toLowerCase().includes("already exists")) {
      console.warn(`[Storage] bucket ${name}:`, error.message);
    }
  }
  bucketsReady = true;
}
