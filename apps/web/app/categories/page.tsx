import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { StorefrontShell } from "@/components/storefront";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { ArrowUpRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Categories",
  description: "Browse electrical products by category."
};

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const supabase = createSupabaseServiceClient();
  const [categoriesResult, brandsResult] = await Promise.all([
    supabase.from("categories").select("id,name,slug,description,image_url,parent_id,sort_order").eq("is_active", true).order("sort_order", { ascending: true }),
    supabase.from("brands").select("id,name,slug,logo_url").eq("is_active", true).order("name", { ascending: true }),
  ]);
  if (categoriesResult.error) throw new Error("Product categories could not be loaded.");
  if (brandsResult.error) throw new Error("Brand directory could not be loaded.");

  const categories = categoriesResult.data;
  const brands = brandsResult.data;
  const productCountRows = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from("products")
      .select("brand_id,category_id")
      .eq("is_active", true)
      .eq("status", "ACTIVE")
      .range(offset, offset + 999);
    if (error) throw new Error("Storefront product counts could not be loaded.");
    productCountRows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }

  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const productCountByCategory = new Map<string, number>();
  const productCountByBrand = new Map<string, number>();
  for (const product of productCountRows) {
    if (product.brand_id) {
      productCountByBrand.set(product.brand_id, (productCountByBrand.get(product.brand_id) ?? 0) + 1);
    }
    if (product.category_id) {
      let categoryId: string | null = product.category_id;
      const visited = new Set<string>();
      while (categoryId) {
        if (visited.has(categoryId)) break;
        visited.add(categoryId);
        productCountByCategory.set(categoryId, (productCountByCategory.get(categoryId) ?? 0) + 1);
        categoryId = categoryById.get(categoryId)?.parent_id ?? null;
      }
    }
  }

  const rootCategories = categories.filter((category) => !category.parent_id);
  const childrenByParent = new Map<string, typeof categories>();
  categories.filter((category) => category.parent_id).forEach((category) => {
    const children = childrenByParent.get(category.parent_id!) ?? [];
    children.push(category);
    childrenByParent.set(category.parent_id!, children);
  });
  const featuredBrands = brands
    .map((brand) => ({ ...brand, productCount: productCountByBrand.get(brand.id) ?? 0 }))
    .filter((brand) => brand.productCount > 0)
    .sort((left, right) => right.productCount - left.productCount || left.name.localeCompare(right.name))
    .slice(0, 12);

  return (
    <StorefrontShell>
      <section className="page-shell">
        <div className="page-hero compact">
          <div>
            <p className="eyebrow">Product categories</p>
            <h1>Find what you need.</h1>
          </div>
        </div>

        <div className="catalog-intro-strip">
          <span>01</span>
          <p>Start with the system you are working on. Then narrow down to the exact fitting, finish, rating, or brand.</p>
          <strong>{rootCategories.length} product families</strong>
        </div>

        <div className="category-family-grid">
          {rootCategories.map((category, index) => {
            const children = childrenByParent.get(category.id) ?? [];
            return <article key={category.slug} className={`category-family-card category-family-${index % 4}`}>
              <Link href={`/categories/${category.slug}`} className="category-family-image">
                {category.image_url ? <Image src={category.image_url} alt="" fill sizes="(max-width: 760px) 100vw, 50vw" unoptimized /> : <span>{String(index + 1).padStart(2, "0")}</span>}
                <span className="category-family-arrow">↗</span>
              </Link>
              <div className="category-family-copy">
                <p className="eyebrow">{productCountByCategory.get(category.id) ?? 0} products</p>
                <h2><Link href={`/categories/${category.slug}`}>{category.name}</Link></h2>
                <p>{category.description || `Explore ${category.name.toLowerCase()} for homes, projects, and professional installations.`}</p>
                {children.length > 0 && <div className="subcategory-list" aria-label={`${category.name} subcategories`}>{children.map((child) => <Link key={child.slug} href={`/categories/${child.slug}`} className="subcategory-card">
                  <span className="subcategory-card-image">
                    {child.image_url ? <Image src={child.image_url} alt="" fill sizes="(max-width: 760px) 35vw, 16vw" unoptimized /> : <span aria-hidden="true">{child.name.charAt(0)}</span>}
                    <span className="subcategory-card-arrow" aria-hidden="true">↗</span>
                  </span>
                  <span className="subcategory-card-name">
                    <span>{child.name}</span>
                    <small>{productCountByCategory.get(child.id) ?? 0} products</small>
                    <span aria-hidden="true">→</span>
                  </span>
                </Link>)}</div>}
                <Link className="text-link" href={`/categories/${category.slug}`}>Explore family <span>→</span></Link>
              </div>
            </article>;
          })}
        </div>

        <section className="brand-discovery-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">02 / Find the right maker</p>
              <h2>Shop by brand.</h2>
              <p className="brand-discovery-description">Find a maker, see how many products are listed, and open its full range.</p>
            </div>
            <Link className="brand-discovery-all" href="/brands">
              Browse all {brands.length} brands <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </div>
          {featuredBrands.length ? (
            <div className="brand-discovery-grid">
              {featuredBrands.map((brand) => (
                <Link key={brand.slug} href={`/brands/${brand.slug}`} className="brand-discovery-card">
                  <span className="brand-discovery-logo">
                    {brand.logo_url
                      ? <Image src={brand.logo_url} alt={`${brand.name} logo`} fill sizes="(max-width: 560px) 40vw, 120px" unoptimized />
                      : <span aria-hidden="true">{brand.name.charAt(0)}</span>}
                  </span>
                  <strong>{brand.name}</strong>
                  <small>{brand.productCount} product{brand.productCount === 1 ? "" : "s"} <span aria-hidden="true">→</span></small>
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <h3>Brand listings are being updated.</h3>
              <p>Visit the full brand directory to browse available makers.</p>
            </div>
          )}
        </section>
      </section>
    </StorefrontShell>
  );
}
