import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@dantown/database";
import { publicEnv } from "../env";export async function createSupabaseServerClient() {const cookieStore = await cookies();return createServerClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL!, publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {cookies : {getAll() { return cookieStore.getAll(); },setAll(cookiesToSet) {try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch { /* Server Components cannot write cookies. */ }}}});
}export function createSupabaseServiceClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceKey) {
    return createClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
  }

  // Fallback for local builds/environments where the service role key isn't provided.
  // Use the public anon key instead — this retains read-only limitations and avoids
  // failing static prerender steps in environments without secrets.
  // Do not log secrets; only warn when falling back so developers notice the config gap.
  // In production deployments, SUPABASE_SERVICE_ROLE_KEY should be provided.
  console.warn(
    "SUPABASE_SERVICE_ROLE_KEY not set — falling back to public anon key for server client."
  );

  return createClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL!, publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}
