"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isDatabaseBackedPath } from "@/lib/database-backed-routes";

export function DatabaseDataRefresh() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isDatabaseBackedPath(pathname)) return;

    let lastRefreshAt = 0;
    const refreshIfVisible = () => {
      if (document.visibilityState !== "visible") return;

      const now = Date.now();
      if (now - lastRefreshAt < 5000) return;

      lastRefreshAt = now;
      router.refresh();
    };

    const interval = window.setInterval(refreshIfVisible, 30_000);
    window.addEventListener("focus", refreshIfVisible);
    window.addEventListener("online", refreshIfVisible);
    document.addEventListener("visibilitychange", refreshIfVisible);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshIfVisible);
      window.removeEventListener("online", refreshIfVisible);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [pathname, router]);

  return null;
}
