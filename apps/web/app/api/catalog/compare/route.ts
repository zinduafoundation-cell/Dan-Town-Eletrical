import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Public product facts for side-by-side comparison. Never returns cost or trade prices. */
export async function GET(request: Request) {
  const slugs = (new URL(request.url).searchParams.get("slugs") ?? "")
    .split(",").map((slug) => slug.trim()).filter((slug) => /^[a-z0-9-]{1,160}$/i.test(slug)).slice(0, 4);
  if (!slugs.length) return NextResponse.json({ products: [] });

  const db = createSupabaseServiceClient();
  const { data: rows } = await db
    .from("products")
    .select("id, sku, name, slug, short_description, description, retail_price, promotional_price, category_id, brand_id")
    .in("slug", slugs).eq("is_active", true);
  const products = rows ?? [];
  if (!products.length) return NextResponse.json({ products: [] });

  const ids = products.map((product) => product.id);
  const [{ data: specs }, { data: images }, { data: inventory }, { data: categories }, { data: brands }] = await Promise.all([
    db.from("product_specifications").select("product_id, specification_name, specification_value, sort_order").in("product_id", ids).order("sort_order"),
    db.from("product_images").select("product_id, image_url, is_primary").in("product_id", ids).order("is_primary", { ascending: false }),
    db.from("inventory").select("product_id, quantity, reserved_quantity").in("product_id", ids),
    db.from("categories").select("id, name"),
    db.from("brands").select("id, name"),
  ]);

  const categoryName = new Map((categories ?? []).map((item) => [item.id, item.name]));
  const brandName = new Map((brands ?? []).map((item) => [item.id, item.name]));

  const result = products.map((product) => {
    const available = (inventory ?? []).filter((row) => row.product_id === product.id).reduce((sum, row) => sum + Math.max(0, row.quantity - row.reserved_quantity), 0);
    const price = product.promotional_price ?? product.retail_price;
    return {
      id: product.id,
      slug: product.slug,
      sku: product.sku,
      name: product.name,
      summary: product.short_description ?? product.description ?? null,
      price: Number(price),
      previousPrice: product.promotional_price && product.promotional_price < product.retail_price ? Number(product.retail_price) : null,
      category: product.category_id ? categoryName.get(product.category_id) ?? null : null,
      brand: product.brand_id ? brandName.get(product.brand_id) ?? null : null,
      image: (images ?? []).find((image) => image.product_id === product.id)?.image_url ?? null,
      availability: available <= 0 ? "Out of stock" : available <= 5 ? "Low stock" : "In stock",
      specs: Object.fromEntries((specs ?? []).filter((spec) => spec.product_id === product.id).map((spec) => [spec.specification_name, spec.specification_value])),
    };
  });

  // keep the order the shopper chose
  result.sort((a, b) => slugs.indexOf(a.slug) - slugs.indexOf(b.slug));
  return NextResponse.json({ products: result });
}
