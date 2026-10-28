import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  isBskEmailAddress: vi.fn(),
  shouldBypassAuth: vi.fn(),
}));

vi.mock("@/lib/auth/server", () => ({
  isBskEmailAddress: mocks.isBskEmailAddress,
  shouldBypassAuth: mocks.shouldBypassAuth,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));

import { GET } from "./route";

describe("authentication session endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.shouldBypassAuth.mockReturnValue(false);
    mocks.isBskEmailAddress.mockReturnValue(false);
  });

  it("returns an explicit anonymous state without treating a missing session as an error", async () => {
    const getUser = vi.fn().mockResolvedValue({
      data: { user: null },
      error: { name: "AuthSessionMissingError", status: 400 },
    });
    mocks.createSupabaseServerClient.mockResolvedValue({ auth: { getUser } });

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      userId: null,
      canAccessWorkspace: false,
      state: "anonymous",
    });
    expect(getUser).toHaveBeenCalledOnce();
  });

  it("requires reauthentication for an invalid refresh token", async () => {
    const getUser = vi.fn().mockResolvedValue({
      data: { user: null },
      error: { name: "AuthApiError", status: 400, message: "Invalid Refresh Token: Refresh Token Not Found" },
    });
    mocks.createSupabaseServerClient.mockResolvedValue({ auth: { getUser } });

    const response = await GET();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      userId: null,
      state: "reauthentication_required",
    });
    expect(getUser).toHaveBeenCalledOnce();
  });

  it("looks up an authenticated user only once and returns the verified workspace status", async () => {
    const getUser = vi.fn().mockResolvedValue({
      data: { user: { id: "staff-1", email: "owner@example.com" } },
      error: null,
    });
    mocks.isBskEmailAddress.mockReturnValue(true);
    mocks.createSupabaseServerClient.mockResolvedValue({ auth: { getUser } });

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      userId: "staff-1",
      canAccessWorkspace: true,
      state: "authenticated",
    });
    expect(getUser).toHaveBeenCalledOnce();
  });

  it("returns unavailable rather than an anonymous success on connectivity errors", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.createSupabaseServerClient.mockRejectedValue(new Error("network unavailable"));

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ state: "unavailable" });
    errorLog.mockRestore();
  });
});
