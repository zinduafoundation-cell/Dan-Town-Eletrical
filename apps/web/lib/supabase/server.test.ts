import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  createServerClient: vi.fn(),
  getPublicEnv: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: mocks.createServerClient,
}));

vi.mock("next/headers", () => ({
  cookies: mocks.cookies,
}));

vi.mock("../env", () => ({
  getPublicEnv: mocks.getPublicEnv,
}));

import { createSupabaseServerClient } from "./server";

describe("Supabase server session cookie propagation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPublicEnv.mockReturnValue({
      NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-test-key",
    });
  });

  it("writes refreshed auth cookies using the selected persistence lifetime", async () => {
    const cookieStore = {
      get: vi.fn().mockReturnValue({ value: "30-days" }),
      getAll: vi.fn().mockReturnValue([]),
      set: vi.fn(),
    };
    const serverClientOptions: { cookies?: { setAll: (cookies: unknown[]) => void } } = {};
    mocks.cookies.mockResolvedValue(cookieStore);
    mocks.createServerClient.mockImplementation((_url, _key, options) => {
      Object.assign(serverClientOptions, options);
      return {};
    });

    await createSupabaseServerClient();
    serverClientOptions.cookies?.setAll([
      { name: "sb-project-auth-token.0", value: "refreshed-session", options: { path: "/", maxAge: 60 } },
      { name: "sb-project-auth-token.1", value: "refresh-token", options: { path: "/", maxAge: 60 } },
    ]);

    expect(cookieStore.set).toHaveBeenCalledTimes(2);
    expect(cookieStore.set).toHaveBeenCalledWith(
      "sb-project-auth-token.0",
      "refreshed-session",
      expect.objectContaining({ maxAge: 30 * 24 * 60 * 60 }),
    );
    expect(cookieStore.set).toHaveBeenCalledWith(
      "sb-project-auth-token.1",
      "refresh-token",
      expect.objectContaining({ maxAge: 30 * 24 * 60 * 60 }),
    );
  });

  it("preserves cookie deletion when Supabase signs out or revokes a session", async () => {
    const cookieStore = {
      get: vi.fn().mockReturnValue({ value: "30-days" }),
      getAll: vi.fn().mockReturnValue([]),
      set: vi.fn(),
    };
    const serverClientOptions: { cookies?: { setAll: (cookies: unknown[]) => void } } = {};
    mocks.cookies.mockResolvedValue(cookieStore);
    mocks.createServerClient.mockImplementation((_url, _key, options) => {
      Object.assign(serverClientOptions, options);
      return {};
    });

    await createSupabaseServerClient();
    serverClientOptions.cookies?.setAll([
      { name: "sb-project-auth-token", value: "", options: { path: "/", maxAge: 0 } },
    ]);

    expect(cookieStore.set).toHaveBeenCalledWith(
      "sb-project-auth-token",
      "",
      { path: "/", maxAge: 0 },
    );
  });
});
