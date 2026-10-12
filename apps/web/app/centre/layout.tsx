import type { Metadata } from "next";
import type { ReactNode } from "react";
import { centreAppMetadata } from "@/lib/centre/pwa";

export const metadata: Metadata = {
  ...centreAppMetadata,
  title: { absolute: "Dantown Centre" },
  description: "Dantown Centre: orders, POS, inventory, customers and operations in one app."
};

export default function CentreLayout({ children }: { children: ReactNode }) {
  return children;
}
