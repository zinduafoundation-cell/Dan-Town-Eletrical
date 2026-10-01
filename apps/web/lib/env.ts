import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url().optional()
});

export function getPublicEnv() {
  return publicEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? (process.env.NODE_ENV === "test" ? "https://test.supabase.co" : undefined),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? (process.env.NODE_ENV === "test" ? "test-anon-key" : undefined),
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL
  });
}

function isLocalUrl(value: string) {
  try {
    const hostname = new URL(value).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

export function getAppUrl(request: Request) {
  const configuredUrl = getPublicEnv().NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (configuredUrl && !(process.env.NODE_ENV === "production" && isLocalUrl(configuredUrl))) {
    return configuredUrl;
  }

  const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (process.env.NODE_ENV === "production" && vercelUrl && !isLocalUrl(`https://${vercelUrl}`)) {
    return `https://${vercelUrl}`;
  }

  return new URL(request.url).origin;
}
