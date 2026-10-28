import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: mocks.createServerClient,
}));

import { proxy } from "./proxy";

describe("Supabase proxy session refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "public-test-key");
  });

  it("passes refreshed auth cookies to both the response and downstream request", async () => {
    let proxyCookies: { setAll: (cookies: Array<{ name: string; value: string; options: { path: string } }>, headers: Record<string, string>) => void } | undefined;
    const getClaims = vi.fn(async () => {
      proxyCookies?.setAll(
        [{ name: "sb-project-auth-token", value: "refreshed-session", options: { path: "/" } }],
        { "Cache-Control": "private, no-store, max-age=0" },
      );
      return { data: { claims: { sub: "customer-1" } }, error: null };
    });
    mocks.createServerClient.mockImplementation((_url, _key, options) => {
      proxyCookies = options.cookies;
      return { auth: { getClaims } };
    });
    const request = new NextRequest("https://shop.example/account");
    request.cookies.set("sb-project-auth-token", "expired-session");

    const response = await proxy(request);

    expect(getClaims).toHaveBeenCalledOnce();
    expect(request.cookies.get("sb-project-auth-token")?.value).toBe("refreshed-session");
    expect(response.cookies.get("sb-project-auth-token")?.value).toBe("refreshed-session");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store, max-age=0");
  });
});
