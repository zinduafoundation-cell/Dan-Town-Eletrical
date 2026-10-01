
import { NextResponse } from "next/server";
import { z } from "zod";
import type { Database } from "@dantown/database";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

type BrandInsert = Database["public"]["Tables"]["brands"]["Insert"];
type CategoryInsert = Database["public"]["Tables"]["categories"]["Insert"];
type ProductImageInsert =
  Database["public"]["Tables"]["product_images"]["Insert"];
type ProductInsert = Database["public"]["Tables"]["products"]["Insert"];

const catalogSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("category"),
    name: z.string().trim().min(1),
    slug: z.string().trim().min(1),
    description: z.string().nullable().optional(),
    parentId: z.string().uuid().nullable().optional(),
    departmentId: z.string().uuid().nullable().optional(),
    icon: z.string().trim().max(64).nullable().optional(),
    imageUrl: z.string().url().nullable().optional(),
  }),
  z.object({
    type: z.literal("brand"),
    name: z.string().trim().min(1),
    slug: z.string().trim().min(1),
    description: z.string().nullable().optional(),
    logoUrl: z.string().url().nullable().optional(),
    imageUrl: z.string().url().nullable().optional(),
    website: z.string().url().nullable().optional(),
    countryOfOrigin: z.string().trim().max(120).nullable().optional(),
    supplierRelationship: z.string().trim().max(240).nullable().optional(),
  }),
  z.object({
    type: z.literal("product"),
    name: z.string().trim().min(1),
    sku: z.string().trim().min(1),
    barcode: z.string().trim().max(64).nullable().optional(),
    slug: z.string().trim().min(1),
    retailPrice: z.number().nonnegative(),
    promotionalPrice: z.number().nonnegative().nullable().optional(),
    promotionLabel: z
      .enum(["New", "Best seller", "Discounted", "Hot", "Featured"])
      .nullable()
      .optional(),
    featured: z.boolean().optional(),
    categoryId: z.string().uuid().nullable().optional(),
    brandId: z.string().uuid().nullable().optional(),
    imageUrl: z.string().url().nullable().optional(),
  }),
]);

const productUpdateSchema = z.object({
  productId: z.string().uuid(),
  name: z.string().trim().min(1),
  sku: z.string().trim().min(1),
  barcode: z.string().trim().max(64).nullable(),
  retailPrice: z.number().nonnegative(),
  promotionalPrice: z.number().nonnegative().nullable(),
  promotionLabel: z
    .enum(["New", "Best seller", "Discounted", "Hot", "Featured"])
    .nullable(),
  featured: z.boolean(),
  categoryId: z.string().uuid().nullable(),
  brandId: z.string().uuid().nullable(),
});

export async function POST(request: Request) {
  try {
    const [
      { requireAuthorizedPermission },
      { createSupabaseServiceClient },
    ] = await Promise.all([
      import("../../../../lib/auth/server"),
      import("../../../../lib/supabase/server"),
    ]);

    const context = await requireAuthorizedPermission("products.update");

    const parsed = catalogSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please check the catalog fields." },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServiceClient();

    if (parsed.data.type === "category") {
      const now = new Date().toISOString();

      const insert: CategoryInsert = {
        name: parsed.data.name,
        slug: parsed.data.slug,
        description: parsed.data.description ?? null,
        parent_id: parsed.data.parentId ?? null,
        department_id: parsed.data.departmentId ?? null,
        icon: parsed.data.icon ?? null,
        image_url: parsed.data.imageUrl ?? null,
        is_active: true,
        sort_order: 0,
        seo_title: null,
        seo_description: null,
        created_at: now,
        updated_at: now,
      };

      const { data, error } = await supabase
        .from("categories")
        .insert(insert)
        .select("id,name,slug,parent_id,department_id")
        .single();

      if (error) throw error;

      return NextResponse.json({ data });
    }

    if (parsed.data.type === "brand") {
      const now = new Date().toISOString();

      const insert: BrandInsert = {
        name: parsed.data.name,
        slug: parsed.data.slug,
        description: parsed.data.description ?? null,
        logo_url: parsed.data.logoUrl ?? null,
        image_url: parsed.data.imageUrl ?? null,
        website: parsed.data.website ?? null,
        country_of_origin: parsed.data.countryOfOrigin ?? null,
        supplier_relationship: parsed.data.supplierRelationship ?? null,
        is_active: true,
        seo_title: null,
        seo_description: null,
        created_at: now,
        updated_at: now,
      };

      const { data, error } = await supabase
        .from("brands")
        .insert(insert)
        .select("id,name,slug,logo_url")
        .single();

      if (error) throw error;

      return NextResponse.json({ data });
    }

    const now = new Date().toISOString();

    const insert: ProductInsert = {
      sku: parsed.data.sku,
      barcode: parsed.data.barcode ?? null,
      name: parsed.data.name,
      slug: parsed.data.slug,
      short_description: null,
      description: null,
      category_id: parsed.data.categoryId ?? null,
      brand_id: parsed.data.brandId ?? null,
      cost_price: 0,
      retail_price: parsed.data.retailPrice,
      contractor_price: null,
      wholesale_price: null,
      dealer_price: null,
      promotional_price: parsed.data.promotionalPrice ?? null,
      promotion_label: parsed.data.promotionLabel ?? null,
      vat_rate: 16,
      weight: null,
      length: null,
      width: null,
      height: null,
      warranty_period: null,
      status: "DRAFT",
      featured: parsed.data.featured ?? false,
      is_active: false,
      seo_title: null,
      seo_description: null,
      created_by:
        context.userId === "dev-bypass-user" ? null : context.userId,
      updated_by: null,
      created_at: now,
      updated_at: now,
    };

    const { data, error } = await supabase
      .from("products")
      .insert(insert)
      .select(
        "id,name,sku,slug,retail_price,promotional_price,promotion_label,featured,status,is_active,category_id,brand_id"
      )
      .single();

    if (error) throw error;

    if (parsed.data.imageUrl) {
      const image: ProductImageInsert = {
        product_id: data.id,
        image_url: parsed.data.imageUrl,
        alt_text: parsed.data.name,
        sort_order: 0,
        is_primary: true,
        created_at: new Date().toISOString(),
      };

      await supabase.from("product_images").insert(image);
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("CATALOG CREATE ERROR", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to save catalog item.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const [
      { requireAuthorizedPermission },
      { createSupabaseServiceClient },
    ] = await Promise.all([
      import("../../../../lib/auth/server"),
      import("../../../../lib/supabase/server"),
    ]);

    const context = await requireAuthorizedPermission("products.update");

    const parsed = productUpdateSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please check the product fields." },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServiceClient();

    const slug = parsed.data.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    const { data, error } = await supabase
      .from("products")
      .update({
        name: parsed.data.name,
        sku: parsed.data.sku,
        barcode: parsed.data.barcode,
        slug,
        retail_price: parsed.data.retailPrice,
        promotional_price: parsed.data.promotionalPrice,
        promotion_label: parsed.data.promotionLabel,
        featured: parsed.data.featured,
        category_id: parsed.data.categoryId,
        brand_id: parsed.data.brandId,
        updated_by:
          context.userId === "dev-bypass-user" ? null : context.userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", parsed.data.productId)
      .select(
        "id,name,sku,barcode,slug,retail_price,promotional_price,promotion_label,featured,status,is_active,category_id,brand_id"
      )
      .single();

    if (error) {
      return NextResponse.json(
        {
          error:
            error.code === "23505"
              ? "That SKU or product slug is already in use."
              : error.message,
        },
        { status: error.code === "23505" ? 409 : 400 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("CATALOG UPDATE ERROR", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to update product.",
      },
      { status: 500 }
    );
  }
}
