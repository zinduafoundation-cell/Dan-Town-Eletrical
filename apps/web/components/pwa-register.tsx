"use client";

import { useEffect } from "react";
import { getCentreOfflineAccess } from "@/lib/centre/offline-storage";
import { flushQueuedSales } from "@/lib/pos/offline-queue";

export function PWARegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let active = true;

    const prepareOfflineShell = async () => {
      const access = await getCentreOfflineAccess();
      if (!active || !access) return;
      const registration = await navigator.serviceWorker.ready;
      (registration.active ?? navigator.serviceWorker.controller)?.postMessage({
        type: "CACHE_CENTRE_OFFLINE_SHELL",
      });
    };

    const register = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
        await prepareOfflineShell();
      } catch (error) {
        console.error("Unable to register or prepare the Centre service worker.", error);
      }
    };

    const syncSales = () => {
      flushQueuedSales().catch((error) => console.error("Unable to sync offline sales.", error));
    };
    const onAccessUpdated = () => {
      prepareOfflineShell().catch((error) => console.error("Unable to cache the Centre offline page.", error));
      syncSales();
    };

    void register();
    window.addEventListener("online", syncSales);
    window.addEventListener("dantown-centre-access-updated", onAccessUpdated);
    window.addEventListener("dantown-pos-sync", syncSales);
    syncSales();

    return () => {
      active = false;
      window.removeEventListener("online", syncSales);
      window.removeEventListener("dantown-centre-access-updated", onAccessUpdated);
      window.removeEventListener("dantown-pos-sync", syncSales);
    };
  }, []);

  return null;
}
