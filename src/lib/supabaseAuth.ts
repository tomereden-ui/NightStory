import { createBrowserClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Browser-side client using the anon key — subject to RLS.
// Uses @supabase/ssr createBrowserClient so the session is stored in cookies
// (rather than localStorage), making it readable by Next.js middleware for
// route-level auth protection.
export const supabaseAuth = createBrowserClient(url, anonKey);
