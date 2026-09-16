import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthorizedPermission } from "../../../../../lib/auth/server";
import { createSupabaseServiceClient } from "../../../../../lib/supabase/server";
import type { Json } from "@dantown/database";

const variantSchema = z.object({
  productId: z.string().uuid(),
  name: z.string().trim().min(1),
  sku: z.string().trim().min(1),
  barcode: z.string().trim().max(64).nullable().optional(),
  attributes: z.record(z.string(), z.unknown()).default({}),
  priceAdjustment: z.number().finite().default(0),
  costPrice: z.number().nonnegative().nullable().optional(),
  retailPrice: z.number().nonnegative().nullable().optional(),
  wholesalePrice: z.number().nonnegative().nullable().optional(),
  weight: z.number().nonnegative().nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  specifications: z.record(z.string(), z.unknown()).default({}),
  isActive: z.boolean().default(true)
});

const updateSchema = variantSchema.extend({ variantId: z.string().uuid() }).omit({ productId: true });

export async function GET(request: Request) {
  try {
    await requireAuthorizedPermission("products.read");
    const productId = new URL(request.url).searchParams.get("productId");
    if (!productId || !z.string().uuid().safeParse(productId).success) {
      return NextResponse.json({ error: "A valid productId is required." }, { status: 400 });
    }
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase.from("product_variants").select("*").eq("product_id", productId).order("created_at", { ascending: true });
    if (error) throw error;
    return NextResponse.json({ data: data ?? [] });
  } catch (error) {
    console.error("CATALOG VARIANTS GET ERROR", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load variants." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAuthorizedPermission("products.update");
    const parsed = variantSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Please check the variant fields." }, { status: 400 });
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase.from("product_variants").insert({
      product_id: parsed.data.productId,
      name: parsed.data.name,
      sku: parsed.data.sku,
      barcode: parsed.data.barcode ?? null,
      attributes: parsed.data.attributes as Json,
      price_adjustment: parsed.data.priceAdjustment,
      cost_price: parsed.data.costPrice ?? null,
      retail_price: parsed.data.retailPrice ?? null,
      wholesale_price: parsed.data.wholesalePrice ?? null,
      weight: parsed.data.weight ?? null,
      image_url: parsed.data.imageUrl ?? null,
      specifications: parsed.data.specifications as Json,
      is_active: parsed.data.isActive
    }).select("*").single();
    if (error) return NextResponse.json({ error: error.code === "23505" ? "That variant SKU, barcode, or name is already in use." : error.message }, { status: error.code === "23505" ? 409 : 400 });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error("CATALOG VARIANT CREATE ERROR", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create variant." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAuthorizedPermission("products.update");
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Please check the variant fields." }, { status: 400 });
    const { variantId, ...variant } = parsed.data;
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase.from("product_variants").update({
      name: variant.name,
      sku: variant.sku,
      barcode: variant.barcode ?? null,
      attributes: variant.attributes as Json,
      price_adjustment: variant.priceAdjustment,
      cost_price: variant.costPrice ?? null,
      retail_price: variant.retailPrice ?? null,
      wholesale_price: variant.wholesalePrice ?? null,
      weight: variant.weight ?? null,
      image_url: variant.imageUrl ?? null,
      specifications: variant.specifications as Json,
      is_active: variant.isActive
    }).eq("id", variantId).select("*").single();
    if (error) return NextResponse.json({ error: error.code === "23505" ? "That variant SKU or barcode is already in use." : error.message }, { status: error.code === "23505" ? 409 : 400 });
    return NextResponse.json({ data });
  } catch (error) {
    console.error("CATALOG VARIANT UPDATE ERROR", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update variant." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAuthorizedPermission("products.update");
    const variantId = new URL(request.url).searchParams.get("variantId");
    if (!variantId || !z.string().uuid().safeParse(variantId).success) return NextResponse.json({ error: "A valid variantId is required." }, { status: 400 });
    const supabase = createSupabaseServiceClient();
    const [{ count: inventoryCount }, { count: orderCount }] = await Promise.all([
      supabase.from("inventory").select("id", { count: "exact", head: true }).eq("variant_id", variantId),
      supabase.from("order_items").select("id", { count: "exact", head: true }).eq("variant_id", variantId)
    ]);
    if ((inventoryCount ?? 0) > 0 || (orderCount ?? 0) > 0) {
      return NextResponse.json({ error: "This variant has inventory or order history. Deactivate it instead of deleting it." }, { status: 409 });
    }
    const { error } = await supabase.from("product_variants").delete().eq("id", variantId);
    if (error) throw error;
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("CATALOG VARIANT DELETE ERROR", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to delete variant." }, { status: 500 });
  }
}
