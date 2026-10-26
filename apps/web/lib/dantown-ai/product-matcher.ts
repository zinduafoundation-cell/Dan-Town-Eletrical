import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@dantown/database";
import { scoreProductMatch } from "./product-search";

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

export async function matchCatalogItems(
  client: SupabaseClient<Database>,
  requests: SmartMatchRequest[],
): Promise<SmartMatchResult[]> {
  if (!requests.length) return [];
  const productPageSize = 1000;
  const productsQuery = () => client
    .from("products")
    .select("id, name, sku, slug, retail_price, short_description, brand_id, category_id, tags")
    .eq("is_active", true)
    .eq("status", "ACTIVE");
  const { data: firstPage, error: firstPageError } = await productsQuery()
    .order("id", { ascending: true })
    .range(0, productPageSize - 1);

  if (firstPageError) throw new Error("Dantown product catalogue is temporarily unavailable.");
  const rows = [...(firstPage ?? [])];
  while (rows.length > 0 && rows.length % productPageSize === 0) {
    const { data: nextPage, error } = await productsQuery()
      .gt("id", rows[rows.length - 1].id)
      .order("id", { ascending: true })
      .range(0, productPageSize - 1);
    if (error) throw new Error("Dantown product catalogue is temporarily unavailable.");
    rows.push(...(nextPage ?? []));
    if (!nextPage?.length || nextPage.length < productPageSize) break;
  }

  if (!rows.length) return requests.map(({ requestedName, requestedQuantity }) => ({
    requestedName,
    requestedQuantity,
    status: "NOT_FOUND",
    confidence: 0,
    product: null,
    alternatives: [],
  }));

  const [brandsResult, categoriesResult] = await Promise.all([
    client.from("brands").select("id, name"),
    client.from("categories").select("id, name"),
  ]);
  if (brandsResult.error || categoriesResult.error) {
    const failingQuery = brandsResult.error
      ?? categoriesResult.error;
    console.error("Smart Match catalogue query failed:", failingQuery?.message);
    throw new Error("Dantown catalogue availability is temporarily unavailable.");
  }

  const brands = new Map((brandsResult.data ?? []).map((brand) => [brand.id, brand.name]));
  const categories = new Map((categoriesResult.data ?? []).map((category) => [category.id, category.name]));

  const catalog = rows.map((row) => {
    const brandName = row.brand_id ? brands.get(row.brand_id) ?? null : null;
    const categoryName = row.category_id ? categories.get(row.category_id) ?? null : null;
    return {
      row,
      brandName,
      categoryName,
    };
  });

  const rankedRequests = requests.map(({ requestedName, requestedQuantity }) => ({
    requestedName,
    requestedQuantity,
    ranked: catalog
      .map(({ row, brandName, categoryName }) => ({
        row,
        brandName,
        categoryName,
        confidence: scoreProductMatch({ ...row, brandName, categoryName }, requestedName),
      }))
      .filter((candidate) => candidate.confidence >= 0.28)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 4),
  }));
  const candidateIds = [...new Set(rankedRequests.flatMap(({ ranked }) => ranked.map(({ row }) => row.id)))];
  if (!candidateIds.length) return rankedRequests.map(({ requestedName, requestedQuantity }) => ({
    requestedName,
    requestedQuantity,
    status: "NOT_FOUND" as const,
    confidence: 0,
    product: null,
    alternatives: [],
  }));

  const [imagesResult, inventoryFirstPage] = await Promise.all([
    client.from("product_images").select("product_id,image_url").in("product_id", candidateIds).eq("is_primary", true).order("sort_order", { ascending: true }),
    client.from("inventory").select("id,product_id,quantity,reserved_quantity").in("product_id", candidateIds).order("id", { ascending: true }).range(0, 999),
  ]);
  if (imagesResult.error || inventoryFirstPage.error) {
    const failingQuery = imagesResult.error ?? inventoryFirstPage.error;
    console.error("Smart Match availability query failed:", failingQuery.message);
    throw new Error("Dantown catalogue availability is temporarily unavailable.");
  }

  const inventoryRows = [...(inventoryFirstPage.data ?? [])];
  while (inventoryRows.length > 0 && inventoryRows.length % 1000 === 0) {
    const lastInventoryId = inventoryRows[inventoryRows.length - 1].id;
    const { data: nextPage, error } = await client.from("inventory")
      .select("id,product_id,quantity,reserved_quantity")
      .in("product_id", candidateIds)
      .gt("id", lastInventoryId)
      .order("id", { ascending: true })
      .range(0, 999);
    if (error) {
      console.error("Smart Match inventory pagination failed:", error.message);
      throw new Error("Dantown catalogue availability is temporarily unavailable.");
    }
    inventoryRows.push(...(nextPage ?? []));
    if (!nextPage?.length || nextPage.length < 1000) break;
  }

  const images = new Map<string, string>();
  for (const image of imagesResult.data ?? []) {
    if (!images.has(image.product_id)) images.set(image.product_id, image.image_url);
  }
  const stock = new Map<string, number>();
  for (const row of inventoryRows) {
    stock.set(row.product_id, (stock.get(row.product_id) ?? 0) + Math.max(0, Number(row.quantity) - Number(row.reserved_quantity)));
  }
  const matchedProducts = new Map<string, SmartMatchProduct>();
  const candidateIdSet = new Set(candidateIds);
  for (const candidate of catalog) {
    if (!candidateIdSet.has(candidate.row.id)) continue;
    matchedProducts.set(candidate.row.id, {
      id: candidate.row.id,
      name: candidate.row.name,
      sku: candidate.row.sku,
      slug: candidate.row.slug,
      retailPrice: Number(candidate.row.retail_price),
      imageUrl: images.get(candidate.row.id) ?? null,
      brandName: candidate.brandName,
      categoryName: candidate.categoryName,
      availableQuantity: stock.get(candidate.row.id) ?? 0,
    });
  }

  return rankedRequests.map(({ requestedName, requestedQuantity, ranked }) => {
    const rankedWithProducts = ranked.flatMap((candidate) => {
      const product = matchedProducts.get(candidate.row.id);
      return product ? [{ product, confidence: candidate.confidence }] : [];
    });
    const best = rankedWithProducts[0];
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
      alternatives: rankedWithProducts.slice(1, 4).map(({ product }) => product),
    };
  });
}

export async function matchCatalogProducts(client: SupabaseClient<Database>, query: string, requestedQuantity = 1) {
  return matchCatalogItems(client, [{ requestedName: query, requestedQuantity }]);
}
