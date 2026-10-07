import { describe, expect, it } from "vitest";
import {
  applySessionPersistence,
  AUTH_SESSION_MAX_AGE_SECONDS,
  persistenceMarkerCookieOptions,
  readSessionPersistence,
} from "./session-cookies";

describe("auth session persistence", () => {
  it("sets auth cookies to expire after 30 days when requested", () => {
    expect(applySessionPersistence({ path: "/", maxAge: 400 * 24 * 60 * 60 }, "30-days")).toEqual({
      path: "/",
      maxAge: AUTH_SESSION_MAX_AGE_SECONDS,
    });
  });

  it("removes persistent expiry for a browser-session-only login", () => {
    expect(applySessionPersistence({ path: "/", maxAge: 400 * 24 * 60 * 60 }, "session")).toEqual({
      path: "/",
    });
  });

  it("leaves unrelated auth-cookie behavior unchanged when no preference exists", () => {
    const options = { path: "/", maxAge: 400 * 24 * 60 * 60 };
    expect(applySessionPersistence(options, undefined)).toBe(options);
    expect(readSessionPersistence("other")).toBeUndefined();
  });

  it("preserves Supabase cookie deletion options during sign-out", () => {
    const removalOptions = { path: "/", maxAge: 0 };
    expect(applySessionPersistence(removalOptions, "30-days")).toBe(removalOptions);
  });

  it("creates an HttpOnly persistence marker with the requested lifetime", () => {
    expect(persistenceMarkerCookieOptions("30-days", true)).toEqual({
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: true,
      maxAge: AUTH_SESSION_MAX_AGE_SECONDS,
    });
  });
});
