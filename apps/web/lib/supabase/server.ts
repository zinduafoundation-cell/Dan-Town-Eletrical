import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@dantown/database";
import { publicEnv } from "../env";export async function createSupabaseServerClient() {const cookieStore = await cookies();return createServerClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL!, publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {cookies : {getAll() { return cookieStore.getAll(); },setAll(cookiesToSet) {try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch { /* Server Components cannot write cookies. */ }}}});
}export function createSupabaseServiceClient() {const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;if (!serviceKey) {throw new Error("SUPABASE_SERVICE_ROLE_KEY environment variable is not set");}return createClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {auth : {autoRefreshToken : false,persistSession : false}});
}
