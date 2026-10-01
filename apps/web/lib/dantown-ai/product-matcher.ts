import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@dantown/database";

export type SmartMatchStatus =
  | "AVAILABLE"
  | "PARTIALLY_AVAILABLE"
  | "OUT_OF_STOCK"
  | "NOT_FOUND"
  | "ALTERNATIVE_AVAILABLE";

export type SmartMatchProduct = {
  id: string;
  name: string;
  sku: string;
  slug: string;
  retailPrice: number;
  imageUrl: string | null;
  brandName: string | null;
  categoryName: string | null;
  availableQuantity: number;
};

export type SmartMatchResult = {
  requestedName: string;
  requestedQuantity: number;
  status: SmartMatchStatus;
  confidence: number;
  product: SmartMatchProduct | null;
  alternatives: SmartMatchProduct[];
};

export type SmartMatchRequest = { requestedName: string; requestedQuantity: number };

const stopWords = new Set(["a", "an", "the", "for", "with", "and", "or", "of", "to", "product", "item"]);

function chunks<T>(items: T[], size: number) {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) batches.push(items.slice(index, index + size));
  return batches;
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function rankProduct(
  product: { name: string; sku: string; short_description: string | null; description: string | null; brandName: string | null; categoryName: string | null },
  query: string,
) {
  const queryNormalized = normalize(query);
  const nameNormalized = normalize(product.name);
  const skuNormalized = normalize(product.sku);
  if (queryNormalized && (queryNormalized === nameNormalized || queryNormalized === skuNormalized)) return 1;

  const tokens = queryNormalized.split(" ").filter((token) => token.length > 1 && !stopWords.has(token));
  if (!tokens.length) return 0;
  const name = normalize(product.name);
  const sku = normalize(product.sku);
  const brand = normalize(product.brandName ?? "");
  const category = normalize(product.categoryName ?? "");
  const description = normalize(`${product.short_description ?? ""} ${product.description ?? ""}`);
  let score = 0;
  for (const token of tokens) {
    if (sku.split(" ").includes(token)) score += 1;
    else if (name.split(" ").includes(token)) score += 0.9;
    else if (brand.split(" ").includes(token)) score += 0.75;
    else if (category.split(" ").includes(token)) score += 0.55;
    else if (description.includes(token)) score += 0.35;
  }
  return Math.min(1, score / tokens.length);
}

export async function matchCatalogItems(
  client: SupabaseClient<Database>,
  requests: SmartMatchRequest[],
): Promise<SmartMatchResult[]> {
  if (!requests.length) return [];
  const { data: rows, error: productsError } = await client
    .from("products")
    .select("id, name, sku, slug, retail_price, short_description, description, brand_id, category_id")
    .eq("is_active", true)
    .eq("status", "ACTIVE")
    .order("name", { ascending: true })
    .range(0, 999);

  if (productsError) throw new Error("Dantown product catalogue is temporarily unavailable.");
  if (!rows?.length) return requests.map(({ requestedName, requestedQuantity }) => ({
    requestedName,
    requestedQuantity,
    status: "NOT_FOUND",
    confidence: 0,
    product: null,
    alternatives: [],
  }));

  const productIds = rows.map(({ id }) => id);
  const idBatches = chunks(productIds, 80);
  const [brandsResult, categoriesResult, imageBatches, inventoryBatches] = await Promise.all([
    client.from("brands").select("id, name"),
    client.from("categories").select("id, name"),
    Promise.all(idBatches.map((ids) => client.from("product_images").select("product_id, image_url, is_primary, sort_order").in("product_id", ids).order("is_primary", { ascending: false }).order("sort_order", { ascending: true }))),
    Promise.all(idBatches.map((ids) => client.from("inventory").select("product_id, quantity, reserved_quantity").in("product_id", ids))),
  ]);
  if (brandsResult.error || categoriesResult.error || imageBatches.some((result) => result.error) || inventoryBatches.some((result) => result.error)) {
    const failingQuery = imageBatches.find((result) => result.error)?.error
      ?? inventoryBatches.find((result) => result.error)?.error
      ?? brandsResult.error
      ?? categoriesResult.error;
    console.error("Smart Match catalogue query failed:", failingQuery?.message);
    throw new Error("Dantown catalogue availability is temporarily unavailable.");
  }

  const brands = new Map((brandsResult.data ?? []).map((brand) => [brand.id, brand.name]));
  const categories = new Map((categoriesResult.data ?? []).map((category) => [category.id, category.name]));
  const images = new Map<string, string>();
  for (const image of imageBatches.flatMap((result) => result.data ?? [])) {
    if (!images.has(image.product_id)) images.set(image.product_id, image.image_url);
  }
  const stock = new Map<string, number>();
  for (const row of inventoryBatches.flatMap((result) => result.data ?? [])) {
    stock.set(row.product_id, (stock.get(row.product_id) ?? 0) + Math.max(0, Number(row.quantity) - Number(row.reserved_quantity)));
  }

  const catalog = rows.map((row) => {
    const brandName = row.brand_id ? brands.get(row.brand_id) ?? null : null;
    const categoryName = row.category_id ? categories.get(row.category_id) ?? null : null;
    return {
      row,
      brandName,
      categoryName,
      product: {
        id: row.id,
        name: row.name,
        sku: row.sku,
        slug: row.slug,
        retailPrice: Number(row.retail_price),
        imageUrl: images.get(row.id) ?? null,
        brandName,
        categoryName,
        availableQuantity: stock.get(row.id) ?? 0,
      } satisfies SmartMatchProduct,
    };
  });

  return requests.map(({ requestedName, requestedQuantity }) => {
    const ranked = catalog
      .map(({ row, brandName, categoryName, product }) => ({
        product,
        confidence: rankProduct({ ...row, brandName, categoryName }, requestedName),
      }))
      .filter((candidate) => candidate.confidence >= 0.28)
      .sort((a, b) => b.confidence - a.confidence);
    const best = ranked[0];
    if (!best) return {
      requestedName,
      requestedQuantity,
      status: "NOT_FOUND" as const,
      confidence: 0,
      product: null,
      alternatives: [],
    };

    const isCloseMatch = best.confidence < 0.82;
    const status: SmartMatchStatus = isCloseMatch
      ? "ALTERNATIVE_AVAILABLE"
      : best.product.availableQuantity === 0
        ? "OUT_OF_STOCK"
        : best.product.availableQuantity < requestedQuantity
          ? "PARTIALLY_AVAILABLE"
          : "AVAILABLE";

    return {
      requestedName,
      requestedQuantity,
      status,
      confidence: best.confidence,
      product: best.product,
      alternatives: ranked.slice(1, 4).map(({ product }) => product),
    };
  });
}

export async function matchCatalogProducts(client: SupabaseClient<Database>, query: string, requestedQuantity = 1) {
  return matchCatalogItems(client, [{ requestedName: query, requestedQuantity }]);
}
