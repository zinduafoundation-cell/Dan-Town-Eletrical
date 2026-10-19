"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isDatabaseBackedPath } from "@/lib/database-backed-routes";

const DATABASE_REFRESH_INTERVAL_MS = 120_000;
const DATABASE_REFRESH_COOLDOWN_MS = 15_000;

export function DatabaseDataRefresh() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isDatabaseBackedPath(pathname)) return;

    let lastRefreshAt = 0;
    let refreshing = false;
    let queuedRefresh = false;
    let refreshTimeout: number | undefined;
    let idleRequestId: number | undefined;
    let fallbackTimeoutId: number | undefined;

    const performRefresh = () => {
      if (document.visibilityState !== "visible" || refreshing || !navigator.onLine) return;

      const now = Date.now();
      if (now - lastRefreshAt < DATABASE_REFRESH_COOLDOWN_MS) return;

      refreshing = true;
      lastRefreshAt = now;
      router.refresh();

      refreshTimeout = window.setTimeout(() => {
        refreshing = false;
      }, 3_000);
    };

    const queueRefresh = () => {
      if (queuedRefresh) return;
      queuedRefresh = true;

      const runQueuedRefresh = () => {
        queuedRefresh = false;
        performRefresh();
      };

      if (typeof window.requestIdleCallback === "function") {
        idleRequestId = window.requestIdleCallback(runQueuedRefresh, { timeout: 2_000 });
      } else {
        fallbackTimeoutId = window.setTimeout(runQueuedRefresh, 250);
      }
    };

    const refreshIfVisible = () => {
      if (document.visibilityState !== "visible" || !navigator.onLine) return;
      queueRefresh();
    };

    const interval = window.setInterval(() => {
      refreshIfVisible();
    }, DATABASE_REFRESH_INTERVAL_MS);

    window.addEventListener("focus", refreshIfVisible);
    window.addEventListener("online", refreshIfVisible);
    document.addEventListener("visibilitychange", refreshIfVisible);

    return () => {
      window.clearInterval(interval);
      if (refreshTimeout !== undefined) window.clearTimeout(refreshTimeout);
      if (fallbackTimeoutId !== undefined) window.clearTimeout(fallbackTimeoutId);
      if (idleRequestId !== undefined && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleRequestId);
      }
      window.removeEventListener("focus", refreshIfVisible);
      window.removeEventListener("online", refreshIfVisible);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [pathname, router]);

  return null;
}
