import type { Metadata } from "next";
import { StorefrontShell } from "@/components/storefront";
import { getCatalogBrands } from "@dantown/database";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { BrandsBrowser } from "@/components/brands/brands-browser";

export const metadata: Metadata = {
  title: "Brands",
  description: "Explore trusted electrical brands available through Dantown."
};

export const dynamic = "force-dynamic";

export default async function BrandsPage() {
  const supabase = createSupabaseServiceClient();
  const brands = await getCatalogBrands(supabase);
  const { data: productRows } = await supabase.from("products").select("brand_id").eq("is_active", true).eq("status", "ACTIVE");
  const productCounts = new Map<string, number>();
  for (const product of productRows ?? []) if (product.brand_id) productCounts.set(product.brand_id, (productCounts.get(product.brand_id) ?? 0) + 1);
  const brandsWithCounts = brands.map((brand) => ({ ...brand, productCount: productCounts.get(brand.id) ?? 0 }));

  return (
    <StorefrontShell>
      <section className="page-shell">
        <div className="page-hero compact">
          <div>
            <p className="eyebrow">Our brands</p>
            <h1>Trusted suppliers, dependable quality.</h1>
          </div>
        </div>

        <BrandsBrowser brands={brandsWithCounts} />
      </section>
    </StorefrontShell>
  );
}
