import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard, StorefrontShell } from "@/components/storefront";
import { getCatalogBrandBySlug, getCatalogProducts } from "@dantown/database";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

type BrandPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: BrandPageProps) {
  const { slug } = await params;
  const supabase = createSupabaseServiceClient();
  const brand = await getCatalogBrandBySlug(supabase, slug);

  if (!brand) return { title: "Brand not found" };

  return {
    title: brand.name,
    description: brand.description
  } satisfies Metadata;
}

export default async function BrandDetailPage({ params }: BrandPageProps) {
  const { slug } = await params;
  const supabase = createSupabaseServiceClient();
  const brand = await getCatalogBrandBySlug(supabase, slug);

  if (!brand) notFound();

  const items = await getCatalogProducts(supabase, { brand: slug });

  return (
    <StorefrontShell>
      <section className="page-shell">
        <div className="brand-detail-hero">
          <div className="brand-mark-wrapper large">
            {brand.logo_url ? (
              <Image
                src={brand.logo_url}
                alt={`${brand.name} logo`}
                fill
                sizes="(max-width: 440px) 90vw, (max-width: 760px) 32vw, 220px"
                unoptimized
              />
            ) : (
              <span aria-hidden="true">{brand.name.charAt(0)}</span>
            )}
          </div>
          <div className="brand-detail-copy">
            <p className="eyebrow">Brand</p>
            <h1>{brand.name}</h1>
            <p>{brand.description || "A trusted maker in the Dantown Electrical range."}</p>
          </div>
        </div>
        {items.length ? (
          <div className="product-grid catalog-grid">
            {items.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>
        ) : (
          <div className="empty-state">
            <h2>No products for this brand yet.</h2>
            <p>Check back soon, or browse all products in the shop.</p>
            <Link href="/shop" className="text-link">Browse products →</Link>
          </div>
        )}
      </section>
    </StorefrontShell>
  );
}
