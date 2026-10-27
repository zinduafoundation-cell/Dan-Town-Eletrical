import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  createSupabaseServerClient: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: mocks.cookies,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));

import { POST as login } from "./login/route";
import { POST as logout } from "./logout/route";

describe("server authentication routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("signs in successfully and records the requested session persistence", async () => {
    const cookieSet = vi.fn();
    const signInWithPassword = vi.fn().mockResolvedValue({ error: null });
    mocks.cookies.mockResolvedValue({ set: cookieSet });
    mocks.createSupabaseServerClient.mockResolvedValue({ auth: { signInWithPassword } });

    const response = await login(
      new Request("https://shop.example/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "customer@example.com", password: "example-password", rememberMe: false }),
      }),
    );

    expect(response.status).toBe(200);
    expect(signInWithPassword).toHaveBeenCalledOnce();
    expect(mocks.createSupabaseServerClient).toHaveBeenCalledWith({ sessionPersistence: "session" });
    expect(cookieSet).toHaveBeenCalledWith(
      "dantown_session_persistence",
      "session",
      expect.objectContaining({ httpOnly: true, path: "/", sameSite: "lax", secure: true }),
    );
    expect(cookieSet.mock.calls[0][2]).not.toHaveProperty("maxAge");
  });

  it("does not write a session marker after failed login", async () => {
    const cookieSet = vi.fn();
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: { signInWithPassword: vi.fn().mockResolvedValue({ error: new Error("invalid credentials") }) },
    });
    mocks.cookies.mockResolvedValue({ set: cookieSet });

    const response = await login(
      new Request("https://shop.example/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "customer@example.com", password: "wrong-password", rememberMe: true }),
      }),
    );

    expect(response.status).toBe(401);
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it("signs out and clears all privileged-access cookies", async () => {
    const cookieSet = vi.fn();
    const signOut = vi.fn().mockResolvedValue({ error: null });
    mocks.cookies.mockResolvedValue({ set: cookieSet });
    mocks.createSupabaseServerClient.mockResolvedValue({ auth: { signOut } });

    const response = await logout();

    expect(response.status).toBe(200);
    expect(signOut).toHaveBeenCalledOnce();
    expect(cookieSet).toHaveBeenCalledWith("dantown_session_persistence", "", { path: "/", maxAge: 0 });
    expect(cookieSet).toHaveBeenCalledWith("dantown-privileged-access", "", { path: "/admin", maxAge: 0 });
    expect(cookieSet).toHaveBeenCalledWith("dantown-biometric-stepup", "", { path: "/", maxAge: 0 });
    expect(cookieSet).toHaveBeenCalledWith("dantown-passkey-challenge", "", { path: "/api/auth/passkey", maxAge: 0 });
  });
});
