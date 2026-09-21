import type { Metadata } from "next";
import { ProductCard, SearchForm, StorefrontShell } from "@/components/storefront";
import { getCatalogProducts } from "@dantown/database";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Deals & Offers",
  description: "Discover special deals and limited-time offers on electrical supplies from Dantown."
};

type DealsPageProps = { searchParams: Promise<{ q?: string; sort?: string }> };

export default async function DealsPage({ searchParams }: DealsPageProps) {
  const params = await searchParams;
  const term = params.q ?? "";
  const sort = params.sort === "low" || params.sort === "high" ? params.sort : "featured";
  const products = (await getCatalogProducts(createSupabaseServiceClient(), { search: term, sort }))
    .filter((product) => product.promotional_price !== null && product.promotional_price < product.retail_price);

  return (
    <StorefrontShell>
      <section className="page-shell">
        <div className="page-hero compact">
          <div><p className="eyebrow">Limited time offers</p><h1>Special deals on premium supplies.</h1><p>Shop exclusive discounts on selected electrical products and solutions.</p></div>
        </div>
        <div className="search-section"><SearchForm initialValue={term} /></div>
        <div className="product-grid catalog-grid">
          {products.length ? products.map((product) => <ProductCard key={product.id} product={product} />) : <div className="empty-state"><h3>No deals available</h3><p>Check back soon for exclusive offers on your favorite products.</p></div>}
        </div>
      </section>
    </StorefrontShell>
  );
}
