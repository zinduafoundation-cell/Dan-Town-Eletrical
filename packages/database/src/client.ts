import { createBrowserClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const isBuildEnvironment = process.env.NEXT_PHASE === "phase-production-build";
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  (isBuildEnvironment ? "https://build-placeholder.supabase.co" : undefined);
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  (isBuildEnvironment ? "build-placeholder-anon-key" : undefined);

if (!supabaseUrl) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
}

if (!supabaseAnonKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

export function createSupabaseBrowserClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase public environment variables are not configured.");
  }

  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}

export const supabase = createClient<Database>(
  supabaseUrl ?? "",
  supabaseAnonKey ?? ""
);