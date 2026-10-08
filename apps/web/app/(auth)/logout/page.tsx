"use client";

import { useEffect } from "react";
import { clearAccountScopedBrowserData } from "@/lib/pending-payment";

export default function LogoutPage() {
  useEffect(() => {
    // Wipe everything tied to the account first, then end the server session.
    clearAccountScopedBrowserData();
    fetch("/api/auth/logout", { method: "POST" }).finally(() => {
      clearAccountScopedBrowserData();
      // Hard navigation so the whole app (cart, reminders, menus) restarts as a guest.
      window.location.replace("/");
    });
  }, []);

  return <main className="auth-page"><p>Signing out...</p></main>;
}
