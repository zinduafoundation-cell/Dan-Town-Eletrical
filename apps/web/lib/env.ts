import { z } from "zod";

const isBuildEnvironment = process.env.NEXT_PHASE === "phase-production-build";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000")
});

export const publicEnv = publicEnvSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL:
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    (process.env.NODE_ENV === "test" || isBuildEnvironment
      ? "https://build-placeholder.supabase.co"
      : undefined),
  NEXT_PUBLIC_SUPABASE_ANON_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    (process.env.NODE_ENV === "test" || isBuildEnvironment
      ? "build-placeholder-anon-key"
      : undefined),
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL
});
