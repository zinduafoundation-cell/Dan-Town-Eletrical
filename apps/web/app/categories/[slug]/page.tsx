import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ProductCard, StorefrontShell } from "@/components/storefront";
import { getCatalogCategoryBySlug, getCatalogProducts } from "@dantown/database";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = createSupabaseServiceClient();
  const category = await getCatalogCategoryBySlug(supabase, slug);
  if (!category) return { title: "Category not found" };
  return {
    title: category.name,
    description: category.description
  } satisfies Metadata;
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = createSupabaseServiceClient();
  
  const category = await getCatalogCategoryBySlug(supabase, slug);
  if (!category) notFound();

  const [items, { data: childCategories }] = await Promise.all([
    getCatalogProducts(supabase, { category: slug }),
    supabase.from("categories").select("name,slug,image_url").eq("parent_id", category.id).eq("is_active", true).order("sort_order", { ascending: true })
  ]);

  return (
    <StorefrontShell>
      <section className="page-shell">
        <div className="category-detail-hero">
          <div className="category-detail-image">{category.image_url ? <Image src={category.image_url} alt="" fill sizes="(max-width: 760px) 110px, 40vw" unoptimized /> : <span>{category.name.charAt(0)}</span>}</div>
          <div className="category-detail-copy">
            <p className="eyebrow">Category</p>
            <h1>{category.name}</h1>
            <p>{category.description || `Shop the ${category.name.toLowerCase()} range for reliable installations and projects.`}</p>
            {childCategories?.length ? <div className="detail-subcategory-row">{childCategories.map((child) => <a key={child.slug} href={`/categories/${child.slug}`}>{child.name} <span>→</span></a>)}</div> : null}
          </div>
        </div>

        <div className="product-grid catalog-grid">
          {items.length ? items.map((product) => <ProductCard key={product.id} product={product} />) : <div className="empty-state"><h3>Coming soon.</h3><p>We are preparing this category with more supply lines.</p></div>}
        </div>
      </section>
    </StorefrontShell>
  );
}
