import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@dantown/database";export function createSupabaseAdminClient() {const url = process.env.NEXT_PUBLIC_SUPABASE_URL;const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;if (!url || !serviceRoleKey) throw new Error("Supabase server environment variables are not configured.");return createClient<Database>(url, serviceRoleKey, { auth : { autoRefreshToken: false, persistSession: false } });
}
