
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
    slug: z.string().trim().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    description: z.string().nullable().optional(),
    parentId: z.string().uuid().nullable().optional(),
    departmentId: z.string().uuid().nullable().optional(),
    icon: z.string().trim().max(64).nullable().optional(),
    imageUrl: z.string().url().nullable().optional(),
  }),
  z.object({
    type: z.literal("brand"),
    name: z.string().trim().min(1),
    slug: z.string().trim().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
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
    slug: z.string().trim().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    retailPrice: z.number().nonnegative(),
    costPrice: z.number().nonnegative().optional(),
    contractorPrice: z.number().nonnegative().nullable().optional(),
    wholesalePrice: z.number().nonnegative().nullable().optional(),
    dealerPrice: z.number().nonnegative().nullable().optional(),
    promotionalPrice: z.number().nonnegative().nullable().optional(),
    promotionLabel: z
      .enum(["New", "Best seller", "Discounted", "Hot", "Featured"])
      .nullable()
      .optional(),
    featured: z.boolean().optional(),
    isActive: z.boolean().optional(),
    status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
    categoryId: z.string().uuid().nullable().optional(),
    brandId: z.string().uuid().nullable().optional(),
    shortDescription: z.string().trim().max(500).nullable().optional(),
    description: z.string().trim().max(10000).nullable().optional(),
    productType: z.string().trim().max(80).nullable().optional(),
    internalCode: z.string().trim().max(80).nullable().optional(),
    manufacturerPartNumber: z.string().trim().max(120).nullable().optional(),
    unitOfMeasure: z.string().trim().min(1).max(40).optional(),
    vatRate: z.number().min(0).max(100).optional(),
    taxInclusive: z.boolean().optional(),
    weight: z.number().nonnegative().nullable().optional(),
    length: z.number().nonnegative().nullable().optional(),
    width: z.number().nonnegative().nullable().optional(),
    height: z.number().nonnegative().nullable().optional(),
    warrantyPeriod: z.number().int().nonnegative().nullable().optional(),
    minimumSellingPrice: z.number().nonnegative().nullable().optional(),
    maximumSuggestedPrice: z.number().nonnegative().nullable().optional(),
    tags: z.array(z.string().trim().min(1).max(40)).max(50).optional(),
    seoTitle: z.string().trim().max(180).nullable().optional(),
    seoDescription: z.string().trim().max(320).nullable().optional(),
    imageUrl: z.string().url().nullable().optional(),
  }),
]);

const productUpdateSchema = z.object({
  productId: z.string().uuid(),
  name: z.string().trim().min(1),
  sku: z.string().trim().min(1),
  barcode: z.string().trim().max(64).nullable(),
  slug: z.string().trim().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  shortDescription: z.string().trim().max(500).nullable(),
  description: z.string().trim().max(10000).nullable(),
  costPrice: z.number().nonnegative(),
  retailPrice: z.number().nonnegative(),
  contractorPrice: z.number().nonnegative().nullable(),
  wholesalePrice: z.number().nonnegative().nullable(),
  dealerPrice: z.number().nonnegative().nullable(),
  promotionalPrice: z.number().nonnegative().nullable(),
  promotionLabel: z
    .enum(["New", "Best seller", "Discounted", "Hot", "Featured"])
    .nullable(),
  featured: z.boolean(),
  isActive: z.boolean(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]),
  categoryId: z.string().uuid().nullable(),
  brandId: z.string().uuid().nullable(),
  productType: z.string().trim().max(80).nullable(),
  internalCode: z.string().trim().max(80).nullable(),
  manufacturerPartNumber: z.string().trim().max(120).nullable(),
  unitOfMeasure: z.string().trim().min(1).max(40),
  vatRate: z.number().min(0).max(100),
  taxInclusive: z.boolean(),
  weight: z.number().nonnegative().nullable(),
  length: z.number().nonnegative().nullable(),
  width: z.number().nonnegative().nullable(),
  height: z.number().nonnegative().nullable(),
  warrantyPeriod: z.number().int().nonnegative().nullable(),
  minimumSellingPrice: z.number().nonnegative().nullable(),
  maximumSuggestedPrice: z.number().nonnegative().nullable(),
  tags: z.array(z.string().trim().min(1).max(40)).max(50),
  seoTitle: z.string().trim().max(180).nullable(),
  seoDescription: z.string().trim().max(320).nullable(),
}).superRefine((product, context) => {
  if (product.promotionalPrice !== null && product.promotionalPrice >= product.retailPrice) {
    context.addIssue({
      code: "custom",
      path: ["promotionalPrice"],
      message: "Promotion price must be lower than the retail price.",
    });
  }
  if (
    product.minimumSellingPrice !== null &&
    product.maximumSuggestedPrice !== null &&
    product.minimumSellingPrice > product.maximumSuggestedPrice
  ) {
    context.addIssue({
      code: "custom",
      path: ["minimumSellingPrice"],
      message: "Minimum selling price cannot exceed the maximum suggested price.",
    });
  }
});

const catalogProductFields =
  "id,name,sku,barcode,slug,short_description,description,category_id,brand_id,cost_price,retail_price,contractor_price,wholesale_price,dealer_price,promotional_price,promotion_label,vat_rate,status,is_active,featured,weight,length,width,height,warranty_period,seo_title,seo_description,product_type,internal_code,manufacturer_part_number,tags,unit_of_measure,minimum_selling_price,maximum_suggested_price,tax_inclusive,updated_at";

export async function GET(request: Request) {
  try {
    const [{ getPermissionGuard }, { createSupabaseServiceClient }] = await Promise.all([
      import("../../../../lib/auth/server"),
      import("../../../../lib/supabase/server"),
    ]);
    const guard = await getPermissionGuard("products.update");
    if (!guard.ok) {
      return NextResponse.json({ error: guard.message }, { status: guard.status });
    }

    const params = new URL(request.url).searchParams;
    const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
    const pageSize = 30;
    const search = (params.get("q") ?? "")
      .trim()
      .replace(/[^a-z\d .-]/gi, "")
      .slice(0, 80);
    const categoryId = params.get("categoryId");
    const brandId = params.get("brandId");
    const status = params.get("status");
    if (categoryId && !z.string().uuid().safeParse(categoryId).success) {
      return NextResponse.json({ error: "Choose a valid category." }, { status: 400 });
    }
    if (brandId && !z.string().uuid().safeParse(brandId).success) {
      return NextResponse.json({ error: "Choose a valid brand." }, { status: 400 });
    }
    if (status && !["DRAFT", "ACTIVE", "ARCHIVED"].includes(status)) {
      return NextResponse.json({ error: "Choose a valid product status." }, { status: 400 });
    }

    const supabase = createSupabaseServiceClient();
    let query = supabase
      .from("products")
      .select(catalogProductFields, { count: "exact" })
      .order("updated_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);
    if (search) {
      query = query.or(
        `name.ilike.%${search}%,sku.ilike.%${search}%,barcode.ilike.%${search}%`,
      );
    }
    if (categoryId) query = query.eq("category_id", categoryId);
    if (brandId) query = query.eq("brand_id", brandId);
    if (status) query = query.eq("status", status);

    const { data, error, count } = await query;
    if (error) throw error;

    const productIds = (data ?? []).map((product) => product.id);
    const { data: images, error: imageError } = productIds.length
      ? await supabase
          .from("product_images")
          .select("product_id,image_url")
          .in("product_id", productIds)
          .eq("is_primary", true)
      : { data: [], error: null };
    if (imageError) throw imageError;

    const imageByProduct = new Map((images ?? []).map((image) => [image.product_id, image.image_url]));
    return NextResponse.json({
      data: (data ?? []).map((product) => ({
        ...product,
        image_url: imageByProduct.get(product.id) ?? null,
      })),
      pagination: { page, pageSize, total: count ?? 0 },
    });
  } catch (error) {
    console.error("CATALOG SEARCH ERROR", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to search catalog." },
      { status: 500 },
    );
  }
}

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
      category_id: parsed.data.categoryId ?? null,
      brand_id: parsed.data.brandId ?? null,
      short_description: parsed.data.shortDescription ?? null,
      description: parsed.data.description ?? null,
      cost_price: parsed.data.costPrice ?? 0,
      retail_price: parsed.data.retailPrice,
      contractor_price: parsed.data.contractorPrice ?? null,
      wholesale_price: parsed.data.wholesalePrice ?? null,
      dealer_price: parsed.data.dealerPrice ?? null,
      promotional_price: parsed.data.promotionalPrice ?? null,
      promotion_label: parsed.data.promotionLabel ?? null,
      vat_rate: parsed.data.vatRate ?? 16,
      weight: parsed.data.weight ?? null,
      length: parsed.data.length ?? null,
      width: parsed.data.width ?? null,
      height: parsed.data.height ?? null,
      warranty_period: parsed.data.warrantyPeriod ?? null,
      status: parsed.data.status ?? "DRAFT",
      featured: parsed.data.featured ?? false,
      is_active: parsed.data.isActive ?? false,
      seo_title: parsed.data.seoTitle ?? null,
      seo_description: parsed.data.seoDescription ?? null,
      created_by:
        context.userId === "dev-bypass-user" ? null : context.userId,
      updated_by: null,
      created_at: now,
      updated_at: now,
      product_type: parsed.data.productType ?? null,
      internal_code: parsed.data.internalCode ?? null,
      manufacturer_part_number: parsed.data.manufacturerPartNumber ?? null,
      tags: parsed.data.tags ?? [],
      unit_of_measure: parsed.data.unitOfMeasure ?? "each",
      minimum_selling_price: parsed.data.minimumSellingPrice ?? null,
      maximum_suggested_price: parsed.data.maximumSuggestedPrice ?? null,
      tax_inclusive: parsed.data.taxInclusive ?? false,
    };

    const { data, error } = await supabase
      .from("products")
      .insert(insert)
      .select(
        catalogProductFields
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

      const { error: imageError } = await supabase.from("product_images").insert(image);
      if (imageError) {
        console.error("CATALOG IMAGE LINK ERROR", imageError.message);
        return NextResponse.json(
          { error: "The product was created, but its image link could not be saved. Retry from Edit product." },
          { status: 500 },
        );
      }
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

    const { data, error } = await supabase
      .from("products")
      .update({
        name: parsed.data.name,
        sku: parsed.data.sku,
        barcode: parsed.data.barcode,
        slug: parsed.data.slug,
        short_description: parsed.data.shortDescription,
        description: parsed.data.description,
        cost_price: parsed.data.costPrice,
        retail_price: parsed.data.retailPrice,
        contractor_price: parsed.data.contractorPrice,
        wholesale_price: parsed.data.wholesalePrice,
        dealer_price: parsed.data.dealerPrice,
        promotional_price: parsed.data.promotionalPrice,
        promotion_label: parsed.data.promotionLabel,
        featured: parsed.data.featured,
        status: parsed.data.status,
        is_active: parsed.data.isActive && parsed.data.status === "ACTIVE",
        category_id: parsed.data.categoryId,
        brand_id: parsed.data.brandId,
        product_type: parsed.data.productType,
        internal_code: parsed.data.internalCode,
        manufacturer_part_number: parsed.data.manufacturerPartNumber,
        unit_of_measure: parsed.data.unitOfMeasure,
        vat_rate: parsed.data.vatRate,
        tax_inclusive: parsed.data.taxInclusive,
        weight: parsed.data.weight,
        length: parsed.data.length,
        width: parsed.data.width,
        height: parsed.data.height,
        warranty_period: parsed.data.warrantyPeriod,
        minimum_selling_price: parsed.data.minimumSellingPrice,
        maximum_suggested_price: parsed.data.maximumSuggestedPrice,
        tags: parsed.data.tags,
        seo_title: parsed.data.seoTitle,
        seo_description: parsed.data.seoDescription,
        updated_by:
          context.userId === "dev-bypass-user" ? null : context.userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", parsed.data.productId)
      .select(
        catalogProductFields
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
