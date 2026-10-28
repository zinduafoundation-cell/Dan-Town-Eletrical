import { afterEach, describe, expect, it, vi } from "vitest";
import { getCurrentSessionUserId } from "./auth-session-provider";

describe("shared authentication session lookup", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shares one in-flight request between storefront consumers", async () => {
    let resolveResponse: ((response: Response) => void) | undefined;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveResponse = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const first = getCurrentSessionUserId();
    const second = getCurrentSessionUserId();
    expect(fetchMock).toHaveBeenCalledOnce();

    resolveResponse?.(new Response(JSON.stringify({ userId: "customer-1" }), { status: 200 }));
    await expect(Promise.all([first, second])).resolves.toEqual(["customer-1", "customer-1"]);
  });
});
