type NotificationResponse = {
  status: number;
  ok: boolean;
  json: () => Promise<unknown>;
};

type PollingOptions = {
  request: () => Promise<NotificationResponse>;
  onUnreadCount: (count: number) => void;
  onUnauthorized: () => void;
  onError: (error: unknown) => void;
  intervalMs?: number;
  retryBaseMs?: number;
};

export function createCustomerNotificationPoller({
  request,
  onUnreadCount,
  onUnauthorized,
  onError,
  intervalMs = 120_000,
  retryBaseMs = 5_000,
}: PollingOptions) {
  let active = false;
  let inFlight = false;
  let unauthorized = false;
  let failures = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function clearTimer() {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function schedule(delay: number) {
    clearTimer();
    timer = setTimeout(() => {
      timer = null;
      void refresh();
    }, delay);
  }

  async function refresh(immediate = false) {
    if (!active || unauthorized || inFlight) return;
    if (immediate) clearTimer();
    inFlight = true;

    try {
      const response = await request();
      if (response.status === 401) {
        unauthorized = true;
        clearTimer();
        onUnauthorized();
        return;
      }

      const result = await response.json();
      if (!response.ok) {
        const message =
          typeof result === "object" &&
          result !== null &&
          "error" in result &&
          typeof result.error === "string"
            ? result.error
            : "Unable to load notifications.";
        throw new Error(message);
      }

      const unreadCount =
        typeof result === "object" &&
        result !== null &&
        "unreadCount" in result &&
        typeof result.unreadCount === "number"
          ? result.unreadCount
          : 0;
      failures = 0;
      onUnreadCount(unreadCount);
      schedule(intervalMs);
    } catch (error) {
      if (active) {
        failures += 1;
        onError(error);
        const exponent = Math.min(failures - 1, 5);
        schedule(Math.min(retryBaseMs * 2 ** exponent, intervalMs));
      }
    } finally {
      inFlight = false;
    }
  }

  return {
    start() {
      if (active) return;
      active = true;
      void refresh();
    },
    refreshNow() {
      void refresh(true);
    },
    stop() {
      active = false;
      clearTimer();
    },
  };
}
