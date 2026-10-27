import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
}));

vi.mock("../supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
  createSupabaseServiceClient: vi.fn(),
}));

import { getAuthenticatedUserId } from "./server";

describe("getAuthenticatedUserId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an identity only after Supabase verifies the user", async () => {
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "customer-a" } },
          error: null,
        }),
      },
    };

    await expect(getAuthenticatedUserId(client as never)).resolves.toBe("customer-a");
    expect(client.auth.getUser).toHaveBeenCalledOnce();
  });

  it.each([
    { name: "missing", status: 400 },
    { name: "expired or invalid", status: 401 },
  ])("returns no identity for a $name session", async ({ status }) => {
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: Object.assign(new Error("No valid session"), { status }),
        }),
      },
    };

    await expect(getAuthenticatedUserId(client as never)).resolves.toBeNull();
  });

  it("surfaces authentication service failures instead of treating them as anonymous", async () => {
    const error = Object.assign(new Error("Auth service unavailable"), { status: 503 });
    const client = { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error }) } };

    await expect(getAuthenticatedUserId(client as never)).rejects.toBe(error);
  });
});
