import type { Metadata } from "next";
import { requireAuthenticated } from "../../../lib/auth/server";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { getCatalogProducts } from "@dantown/database";
import { ProductCard, StorefrontShell } from "@/components/storefront";

export const metadata: Metadata = {
  title: "Wishlist",
  description: "Saved electrical products and project essentials for your next order.",
};

export const dynamic = "force-dynamic";

export default async function WishlistPage() {
  const context = await requireAuthenticated();
  const supabase = await createSupabaseServerClient();
  const { data: wishlist } = await supabase.from("wishlists").select("id").eq("user_id", context.userId).maybeSingle();
  const { data: items = [] } = wishlist
    ? await supabase.from("wishlist_items").select("product_id").eq("wishlist_id", wishlist.id)
    : { data: [] };

  const productIds = (items ?? []).map((item) => item.product_id);
  const favorites = productIds.length
    ? await getCatalogProducts(supabase, { productIds, pageSize: Math.min(productIds.length, 60), allowFallback: false })
    : [];

  return (
    <StorefrontShell>
      <section className="page-shell">
        <div className="page-hero compact">
          <div>
            <p className="eyebrow">Wishlist</p>
            <h1>Your saved products</h1>
          </div>
        </div>

        {favorites.length ? (
          <div className="product-grid catalog-grid">
            {favorites.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h3>No saved products yet.</h3>
            <p>Save products while browsing to keep them close for your next order.</p>
          </div>
        )}
      </section>
    </StorefrontShell>
  );
}
