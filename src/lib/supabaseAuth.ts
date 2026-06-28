import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Browser-side client using the anon key — subject to RLS.
// Separate from the server-side service-role client in supabase.ts.
export const supabaseAuth = createClient(url, anonKey);
