"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * Keeps the installed Dantown Centre app on the Centre side. The app starts at
 * /centre?app=centre, which marks this window. If the installed app window
 * ever lands on a public shop page, it is sent back to the Centre.
 */
const CENTRE_PATHS = [
  "/centre",
  "/admin",
  "/pos",
  "/staff",
  "/business",
  "/business-center",
  "/login",
  "/logout",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/callback-error",
  "/auth",
  "/api",
  "/401",
  "/403"
];

const FLAG = "dantown-centre-app";

export function CentreAppGuard() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const onOfflineNavigation = (event: MouseEvent) => {
      if (navigator.onLine || !(event.target instanceof Element)) return;
      const anchor = event.target.closest("a");
      if (!anchor || anchor.target === "_blank") return;
      const destination = new URL(anchor.href, window.location.origin);
      if (destination.origin !== window.location.origin || destination.pathname === "/centre/offline") return;
      const privateRoute = ["/centre", "/admin", "/pos", "/staff", "/business", "/business-center", "/login", "/logout",
        "/register", "/forgot-password", "/reset-password", "/verify-email", "/callback-error", "/auth", "/api",
        "/401", "/403"].some((prefix) => destination.pathname === prefix || destination.pathname.startsWith(`${prefix}/`));
      if (!privateRoute) return;
      event.preventDefault();
      const offlineUrl = new URL("/centre/offline", window.location.origin);
      if (destination.pathname === "/logout") offlineUrl.searchParams.set("from", "/logout");
      else offlineUrl.searchParams.set("from", destination.pathname);
      window.location.assign(offlineUrl.href);
    };
    window.addEventListener("click", onOfflineNavigation, true);
    return () => window.removeEventListener("click", onOfflineNavigation, true);
  }, []);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (!standalone) return;

    try {
      if (new URLSearchParams(window.location.search).get("app") === "centre") {
        window.sessionStorage.setItem(FLAG, "1");
      }
      if (window.sessionStorage.getItem(FLAG) !== "1") return;
    } catch {
      return;
    }

    const inCentre = CENTRE_PATHS.some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"));
    if (!inCentre) router.replace("/centre");
  }, [pathname, router]);

  return null;
}
