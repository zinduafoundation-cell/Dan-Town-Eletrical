import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
export { hasPermission, hasRole, requirePermission, requireRole, AuthorizationError } from "./authorization";
export type { AuthorizationContext } from "./authorization";

export function createAuthClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Supabase public environment variables are not configured.");
  }

  return createBrowserClient(url, key);
}
