import type { Metadata } from "next";
import { StorefrontShell } from "@/components/storefront";
import { CompareClient } from "@/components/compare/compare-client";

export const metadata: Metadata = {
  title: "Compare products",
  description: "Line up Dantown electrical, solar and lighting products side by side: price, stock and specifications.",
};

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ items?: string }> }) {
  const { items } = await searchParams;
  const initialSlugs = (items ?? "").split(",").map((slug) => slug.trim()).filter((slug) => /^[a-z0-9-]{1,160}$/i.test(slug)).slice(0, 4);
  return (
    <StorefrontShell>
      <section className="page-shell">
        <div className="page-hero compact">
          <div>
            <p className="eyebrow">Choose with confidence</p>
            <h1>Compare products</h1>
            <p>Price, stock and specifications side by side. Share the link with your electrician or family.</p>
          </div>
        </div>
        <CompareClient initialSlugs={initialSlugs} />
      </section>
    </StorefrontShell>
  );
}
