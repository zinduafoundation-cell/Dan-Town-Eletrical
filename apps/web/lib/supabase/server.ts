import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@dantown/database";
import { getPublicEnv } from "../env";
import {
  applySessionPersistence,
  AUTH_SESSION_PERSISTENCE_COOKIE,
  readSessionPersistence,
  type SessionPersistence,
} from "../auth/session-cookies";

export async function createSupabaseServerClient(options?: {
  sessionPersistence?: SessionPersistence;
}) {
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = getPublicEnv();
  const cookieStore = await cookies();
  const sessionPersistence =
    options?.sessionPersistence ??
    readSessionPersistence(cookieStore.get(AUTH_SESSION_PERSISTENCE_COOKIE)?.value);

  return createServerClient<Database>(
    NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options: cookieOptions }) => {
              cookieStore.set(name, value, applySessionPersistence(cookieOptions, sessionPersistence));
            });
          } catch {
            // Server Components cannot write cookies.
          }
        },
      },
    },
  );
}

export function createSupabaseServiceClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY environment variable is not set");
  }

  const { NEXT_PUBLIC_SUPABASE_URL } = getPublicEnv();
  return createClient<Database>(NEXT_PUBLIC_SUPABASE_URL, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
