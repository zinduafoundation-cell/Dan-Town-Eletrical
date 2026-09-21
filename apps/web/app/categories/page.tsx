import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { StorefrontShell } from "@/components/storefront";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Categories",
  description: "Browse electrical products by category."
};

export default async function CategoriesPage() {
  const supabase = createSupabaseServiceClient();
  const [categories, { data: brandsData }] = await Promise.all([
    supabase.from("categories").select("id,name,slug,description,image_url,parent_id,sort_order").eq("is_active", true).order("sort_order", { ascending: true }).then(({ data }) => data ?? []),
    supabase.from("brands").select("id,name,slug,logo_url,description").eq("is_active", true).order("name", { ascending: true }).limit(8)
  ]);
  const rootCategories = categories.filter((category) => !category.parent_id);
  const childrenByParent = new Map<string, typeof categories>();
  categories.filter((category) => category.parent_id).forEach((category) => {
    const children = childrenByParent.get(category.parent_id!) ?? [];
    children.push(category);
    childrenByParent.set(category.parent_id!, children);
  });

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
          <strong>{categories.length} product families</strong>
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
                <p className="eyebrow">Product family</p>
                <h2><Link href={`/categories/${category.slug}`}>{category.name}</Link></h2>
                <p>{category.description || `Explore ${category.name.toLowerCase()} for homes, projects, and professional installations.`}</p>
                {children.length > 0 && <div className="subcategory-list">{children.slice(0, 5).map((child) => <Link key={child.slug} href={`/categories/${child.slug}`}>{child.name} <span>→</span></Link>)}</div>}
                <Link className="text-link" href={`/categories/${category.slug}`}>Explore family <span>→</span></Link>
              </div>
            </article>;
          })}
        </div>

        <section className="brand-discovery-section">
          <div className="section-heading"><div><p className="eyebrow">02 / Trusted makers</p><h2>Shop by brand.</h2></div><Link className="text-link" href="/brands">See all brands →</Link></div>
          <div className="brand-discovery-grid">{(brandsData ?? []).map((brand) => <Link key={brand.slug} href={`/brands/${brand.slug}`} className="brand-discovery-card">{brand.logo_url ? <Image src={brand.logo_url} alt={brand.name} width={64} height={64} unoptimized /> : <span>{brand.name.charAt(0)}</span>}<strong>{brand.name}</strong><small>View range →</small></Link>)}</div>
        </section>
      </section>
    </StorefrontShell>
  );
}
