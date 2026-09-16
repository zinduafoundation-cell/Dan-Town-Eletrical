import type { Metadata } from "next";
import Link from "next/link";
import {
  SearchForm,
  ProductCard,
  SectionHeading,
  StorefrontShell
} from "@/components/storefront";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getCatalogCategories,
  getCatalogProducts,
  getCatalogProductCount
} from "@dantown/database";

export const metadata: Metadata = {
  title: "Shop",
  description:
    "Explore premium electrical supplies, lighting and power solutions from Dantown."
};

type ShopPageProps = {
  searchParams: Promise<{
    q?: string;
    category?: string;
    sort?: string;
    page?: string;
  }>;
};

export default async function ShopPage({
  searchParams
}: ShopPageProps) {
  const params = await searchParams;

  const term = params.q ?? "";
  const category = params.category ?? "";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const pageSize = 48;

  const sort =
    params.sort === "low"
      ? "low"
      : params.sort === "high"
        ? "high"
        : "featured";

  const supabase = await createSupabaseServerClient();

  const [products, categories, productCount] = await Promise.all([
    getCatalogProducts(supabase, {
      search: term,
      category: category || undefined,
      sort,
      page,
      pageSize
    }),
    getCatalogCategories(supabase),
    getCatalogProductCount(supabase, {
      search: term,
      category: category || undefined
    })
  ]);
  const productTotalLabel =
    productCount >= 1000
      ? "1,000+"
      : productCount >= 400
        ? "400+"
        : String(productCount);

  return (
    <StorefrontShell>
      <section className="page-shell">
        <div className="page-hero compact">
          <div>
            <p className="eyebrow">Shop everything</p>
            <h1>Premium electrical supply</h1>
          </div>

          <SearchForm initialValue={term} />
        </div>

        <div className="shop-layout">
          <aside className="filter-panel">
            <h3>Categories</h3>

            <div className="chip-group">
              <Link
                href={{
                  pathname: "/shop",
                  query: {
                    q: term || undefined
                  }
                }}
                className={`filter-chip ${!category ? "active" : ""}`}
              >
                All products
              </Link>

              {categories.map((item) => (
                <Link
                  key={item.id}
                  href={{
                    pathname: "/shop",
                    query: {
                      category: item.slug,
                      q: term || undefined,
                      sort: params.sort || undefined,
                      page: undefined
                    }
                  }}
                  className={`filter-chip ${
                    category === item.slug ? "active" : ""
                  }`}
                >
                  {item.name}
                </Link>
              ))}
            </div>

            <h3>Sort</h3>

            <div className="chip-group">
              <Link
                href={{
                  pathname: "/shop",
                  query: {
                    q: term || undefined,
                    category: category || undefined,
                    page: undefined
                  }
                }}
                className={`filter-chip ${
                  sort === "featured" ? "active" : ""
                }`}
              >
                Featured
              </Link>

              <Link
                href={{
                  pathname: "/shop",
                  query: {
                    q: term || undefined,
                    category: category || undefined,
                    page: undefined,
                    sort: "low"
                  }
                }}
                className={`filter-chip ${
                  sort === "low" ? "active" : ""
                }`}
              >
                Price: Low to High
              </Link>

              <Link
                href={{
                  pathname: "/shop",
                  query: {
                    q: term || undefined,
                    category: category || undefined,
                    sort: "high",
                    page: undefined
                  }
                }}
                className={`filter-chip ${
                  sort === "high" ? "active" : ""
                }`}
              >
                Price: High to Low
              </Link>
            </div>

            <div className="mini-stat">
              <span>Showing</span>
              <strong>{productTotalLabel}</strong>
            </div>
          </aside>

          <div className="catalog-panel">
            <SectionHeading
              kicker="Browse"
              title={`${productTotalLabel} products available`}
            />

            {products.length ? (
              <div className="product-grid catalog-grid">
                {products.map((product) => (
                  <ProductCard product={product} key={product.id} />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <h3>No products match your filters.</h3>
                <p>
                  Try a different search term, choose another category, or
                  check back soon for new stock.
                </p>
              </div>
            )}

            <nav className="catalog-pagination" aria-label="Product pages">
              {page > 1 ? (
                <Link
                  className="button button-secondary"
                  href={{
                    pathname: "/shop",
                    query: {
                      q: term || undefined,
                      category: category || undefined,
                      sort: params.sort || undefined,
                      page: page - 1
                    }
                  }}
                >
                  Previous
                </Link>
              ) : null}
              {products.length === pageSize ? (
                <Link
                  className="button button-primary"
                  href={{
                    pathname: "/shop",
                    query: {
                      q: term || undefined,
                      category: category || undefined,
                      sort: params.sort || undefined,
                      page: page + 1
                    }
                  }}
                >
                  Next products
                </Link>
              ) : null}
            </nav>
          </div>
        </div>
      </section>
    </StorefrontShell>
  );
}