export type SessionPersistence = "session" | "30-days";

export const AUTH_SESSION_PREFERENCE_COOKIE = "dantown_remember_session";
export const AUTH_SESSION_PERSISTENCE_COOKIE = "dantown_session_persistence";
export const AUTH_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export function readSessionPersistence(value: string | undefined): SessionPersistence | undefined {
  if (value === "session" || value === "30-days") return value;
  return undefined;
}

export function applySessionPersistence<T extends { maxAge?: number; expires?: Date }>(
  cookieOptions: T,
  persistence: SessionPersistence | undefined,
) {
  if (!persistence || cookieOptions.maxAge === 0) return cookieOptions;

  const sessionCookieOptions = { ...cookieOptions };
  delete sessionCookieOptions.maxAge;
  delete sessionCookieOptions.expires;
  return persistence === "30-days"
    ? { ...sessionCookieOptions, maxAge: AUTH_SESSION_MAX_AGE_SECONDS }
    : sessionCookieOptions;
}

export function persistenceMarkerCookieOptions(persistence: SessionPersistence, secure: boolean) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax" as const,
    secure,
    ...(persistence === "30-days" ? { maxAge: AUTH_SESSION_MAX_AGE_SECONDS } : {}),
  };
}
