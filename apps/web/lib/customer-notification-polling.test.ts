import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { createCustomerNotificationPoller } from "./customer-notification-polling";

function response(status: number, body: unknown) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  };
}

describe("customer notification polling", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("stops polling after an unauthenticated response", async () => {
    const request = vi.fn().mockResolvedValue(response(401, {}));
    const onUnauthorized = vi.fn();
    const poller = createCustomerNotificationPoller({
      request,
      onUnreadCount: vi.fn(),
      onUnauthorized,
      onForbidden: vi.fn(),
      onError: vi.fn(),
      intervalMs: 120_000,
    });

    poller.start();
    await vi.advanceTimersByTimeAsync(0);
    poller.refreshNow();
    await vi.advanceTimersByTimeAsync(120_000);

    expect(request).toHaveBeenCalledTimes(1);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("stops polling after a forbidden role response", async () => {
    const request = vi.fn().mockResolvedValue(response(403, { error: "Customer account access is required." }));
    const onForbidden = vi.fn();
    const onError = vi.fn();
    const poller = createCustomerNotificationPoller({
      request,
      onUnreadCount: vi.fn(),
      onUnauthorized: vi.fn(),
      onForbidden,
      onError,
      intervalMs: 120_000,
    });

    poller.start();
    await vi.advanceTimersByTimeAsync(0);
    poller.refreshNow();
    await vi.advanceTimersByTimeAsync(120_000);

    expect(request).toHaveBeenCalledOnce();
    expect(onForbidden).toHaveBeenCalledOnce();
    expect(onError).not.toHaveBeenCalled();
  });

  it("backs off after network errors and resumes the normal interval after recovery", async () => {
    const request = vi
      .fn()
      .mockRejectedValueOnce(new Error("network unavailable"))
      .mockResolvedValue(response(200, { unreadCount: 3 }));
    const onUnreadCount = vi.fn();
    const onError = vi.fn();
    const poller = createCustomerNotificationPoller({
      request,
      onUnreadCount,
      onUnauthorized: vi.fn(),
      onForbidden: vi.fn(),
      onError,
      intervalMs: 120_000,
      retryBaseMs: 5_000,
    });

    poller.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(4_999);
    expect(request).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(request).toHaveBeenCalledTimes(2);
    expect(onUnreadCount).toHaveBeenCalledWith(3);

    await vi.advanceTimersByTimeAsync(119_999);
    expect(request).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(request).toHaveBeenCalledTimes(3);
  });

  it("prevents concurrent requests and stops timers on unmount", async () => {
    let finishRequest: ((value: ReturnType<typeof response>) => void) | undefined;
    const request = vi.fn(
      () =>
        new Promise<ReturnType<typeof response>>((resolve) => {
          finishRequest = resolve;
        }),
    );
    const poller = createCustomerNotificationPoller({
      request,
      onUnreadCount: vi.fn(),
      onUnauthorized: vi.fn(),
      onForbidden: vi.fn(),
      onError: vi.fn(),
    });

    poller.start();
    poller.refreshNow();
    expect(request).toHaveBeenCalledTimes(1);

    finishRequest?.(response(200, { unreadCount: 0 }));
    await vi.advanceTimersByTimeAsync(0);
    poller.stop();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(request).toHaveBeenCalledTimes(1);
  });
});
