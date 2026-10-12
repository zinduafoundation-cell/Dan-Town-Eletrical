import type { Metadata } from "next";

/**
 * Shared metadata that makes every Dantown Centre page installable as the
 * "Dantown Centre" app (separate from the public shop).
 */
export const centreAppMetadata: Metadata = {
  manifest: "/centre.webmanifest",
  applicationName: "Dantown Centre",
  appleWebApp: {
    capable: true,
    title: "Dantown Centre",
    statusBarStyle: "black-translucent"
  },
  icons: {
    icon: "/centre-icon-192.png",
    apple: "/centre-apple-touch-icon.png"
  },
  robots: { index: false, follow: false }
};
