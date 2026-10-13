"use client";

import { useEffect } from "react";
import { clearAccountScopedBrowserData } from "@/lib/pending-payment";
import { clearCentreOfflineData } from "@/lib/centre/offline-storage";

export default function LogoutPage() {
  useEffect(() => {
    const clearOfflineData = async () => {
      clearAccountScopedBrowserData();
      try {
        await clearCentreOfflineData();
      } catch (error) {
        console.error("Unable to clear saved Centre data during sign-out.", error);
      }
    };
    void (async () => {
      await clearOfflineData();
      try {
        await fetch("/api/auth/logout", { method: "POST" });
      } catch (error) {
        console.error("Unable to end the server session during sign-out.", error);
      } finally {
        await clearOfflineData();
        window.location.replace(navigator.onLine ? "/" : "/centre/offline");
      }
    })();
  }, []);

  return <main className="auth-page"><p>Signing out...</p></main>;
}
