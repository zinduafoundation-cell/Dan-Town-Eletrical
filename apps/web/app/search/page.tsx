import type { Metadata } from "next";
import Link from "next/link";
import { ProductCard, SearchForm, StorefrontShell } from "@/components/storefront";
import { getCatalogProducts } from "@dantown/database";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Search",
  description: "Search Dantown products by category, brand, product name and specifications.",
};

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q: string }> }) {
  const params = await searchParams;
  const q = params.q ?? "";
  const supabase = createSupabaseServiceClient();
  const results = await getCatalogProducts(supabase, { search: q });

  return (
    <StorefrontShell>
      <section className="page-shell">
        <div className="page-hero compact">
          <div>
            <p className="eyebrow">Search</p>
            <h1>{q ? `Results for “${q}”` : "Find the right product"}</h1>
            <p>
              Searching from a quotation or photo?{" "}
              <Link href="/ai/smart-match">Try Dantown AI Smart Match.</Link>
            </p>
          </div>
          <SearchForm initialValue={q} />
        </div>
        {results.length ? (
          <div className="product-grid catalog-grid">
            {results.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>
        ) : (
          <div className="empty-state">
            <h3>No products found.</h3>
            <p>Try another keyword, brand or category name.</p>
          </div>
        )}
      </section>
    </StorefrontShell>
  );
}
