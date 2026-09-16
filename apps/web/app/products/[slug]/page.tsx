import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Tag } from "lucide-react";

import { StorefrontShell } from "@/components/storefront";
import { ProductCardActions } from "@/components/product-card-actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCatalogProductBySlug } from "@dantown/database";
import { formatCurrency } from "@/lib/store-data";

type ProductPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateMetadata({
  params
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();

  const product = await getCatalogProductBySlug(supabase, slug);

  if (!product) {
    return {
      title: "Product not found"
    };
  }

  return {
    title: product.name,
    description:
      product.short_description ??
      product.description ??
      `Buy ${product.name} from Dantown Electrical Kitale.`
  };
}

export default async function ProductPage({
  params
}: ProductPageProps) {
  const { slug } = await params;

  const supabase = await createSupabaseServerClient();
  const product = await getCatalogProductBySlug(supabase, slug);

  if (!product) {
    notFound();
  }

  const price =
    product.promotional_price ??
    product.retail_price;

  const hasPromotion =
    product.promotional_price !== null &&
    product.promotional_price < product.retail_price;

  return (
    <StorefrontShell>
      <main className="page-shell">
        <Link href="/shop" className="back-link">
          <ArrowLeft size={18} />
          Back to shop
        </Link>

        <section className="product-detail-layout">
          <div className="product-gallery">
            <div
              className="product-detail-image"
              style={
                product.primary_image
                  ? {
                      backgroundImage: `url(${product.primary_image})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center"
                    }
                  : undefined
              }
            >
              {!product.primary_image && (
                <div className="product-shape large" />
              )}

              {product.featured && (
                <span className="product-tag">
                  Featured
                </span>
              )}
            </div>
          </div>

          <div className="product-detail-info">
            <div className="product-breadcrumb">
              <span>
                {product.category?.name ?? "Electrical"}
              </span>

              {product.brand && (
                <>
                  <span>•</span>
                  <span>{product.brand.name}</span>
                </>
              )}
            </div>

            <h1>{product.name}</h1>

            {product.short_description && (
              <p className="product-lead">
                {product.short_description}
              </p>
            )}

            <div className="product-detail-price">
              <strong>
                {formatCurrency(price)}
              </strong>

              {hasPromotion && (
                <span>
                  {formatCurrency(product.retail_price)}
                </span>
              )}
            </div>

            <div className="product-sku">
              SKU: {product.sku}
            </div>

            <div className="product-divider" />

            <div className="product-description">
              <h3>Product details</h3>

              <p>
                {product.description ??
                  "Contact Dantown Electrical for more information about this product."}
              </p>
            </div>

            <div className="product-benefits">
              <div>
                <Check size={18} />
                <span>Professional electrical supply</span>
              </div>

              <div>
                <Check size={18} />
                <span>Trusted quality products</span>
              </div>

              <div>
                <Check size={18} />
                <span>Available for pickup or delivery</span>
              </div>
            </div>

            <div className="product-actions">
              <ProductCardActions
                product={{
                  id: product.id,
                  slug: product.slug,
                  name: product.name,
                  sku: product.sku,
                  retail_price: price,
                  primary_image: product.primary_image ?? null,
                  featured: Boolean(product.featured),
                }}
                stockStatus="In stock"
              />
            </div>

            <Link
              href="/request-quote"
              className="product-quote-link"
            >
              <Tag size={17} />
              Request a quotation for this product
            </Link>
          </div>
        </section>
      </main>
    </StorefrontShell>
  );
}