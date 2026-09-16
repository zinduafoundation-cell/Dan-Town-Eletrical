import { NextResponse } from "next/server";
import { getCatalogProducts } from "@dantown/database";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const term = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (term.length < 2) return NextResponse.json({ products: [] });

  const safeTerm = term.replace(/[%,()]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  const products = await getCatalogProducts(createSupabaseServiceClient(), { search: safeTerm, sort: "featured" });

  return NextResponse.json({
    products: products.slice(0, 8).map((product) => ({
      id: product.id,
      name: product.name,
      slug: product.slug,
      sku: product.sku,
      price: product.promotional_price ?? product.retail_price,
      category: product.category?.name ?? null
    }))
  });
}
