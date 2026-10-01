import type { Metadata } from "next";
import { StorefrontShell } from "@/components/storefront";
import { SmartMatchClient } from "@/components/ai/smart-match-client";

export const metadata: Metadata = {
  title: "Dantown AI Smart Match",
  description: "Find Dantown Electrical products from a quotation, product photo or search.",
};

export default function SmartMatchPage() {
  return (
    <StorefrontShell>
      <SmartMatchClient />
    </StorefrontShell>
  );
}
