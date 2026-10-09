import type { SupabaseClient } from "@supabase/supabase-js";
import type { Brand, Category, Database, Product } from "../types";

type CatalogProductRow = Pick<
  Product,
  | "id"
  | "sku"
  | "name"
  | "slug"
  | "short_description"
  | "description"
  | "retail_price"
  | "contractor_price"
  | "wholesale_price"
  | "dealer_price"
  | "promotional_price"
  | "featured"
  | "category_id"
  | "brand_id"
> & { promotion_label?: Product["promotion_label"] };

type CatalogCategoryRow = Pick<Category, "id" | "name" | "slug" | "description" | "image_url">;
type CatalogBrandRow = Pick<Brand, "id" | "name" | "slug" | "description" | "logo_url">;

function cleanProductDescription(value: string | null | undefined) {
  return value
    ?.replace(/\s*Indicative range:\s*KES\s*[\d,]+(?:\.\d+)?\s*-\s*[\d,]+(?:\.\d+)?\.?/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim() || null;
}

function toNumberOrNull(value: number | string | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  return Number(value);
}

function mapCatalogProduct(
  product: CatalogProductRow,
  categoriesMap: Map<string, CatalogCategoryRow>,
  brandsMap: Map<string, CatalogBrandRow>,
  imagesMap: Map<string, string>
): CatalogProduct {
  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    slug: product.slug,
    short_description: cleanProductDescription(product.short_description),
    description: cleanProductDescription(product.description),
    retail_price: Number(product.retail_price),
    contractor_price: toNumberOrNull(product.contractor_price),
    wholesale_price: toNumberOrNull(product.wholesale_price),
    dealer_price: toNumberOrNull(product.dealer_price),
    promotional_price: toNumberOrNull(product.promotional_price),
    promotion_label: product.promotion_label,
    featured: product.featured,
    category: product.category_id ? categoriesMap.get(product.category_id) ?? null : null,
    brand: product.brand_id ? brandsMap.get(product.brand_id) ?? null : null,
    primary_image: imagesMap.get(product.id) ?? null
  };
}

export type CatalogCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
};

export type CatalogBrand = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
};

export type CatalogProduct = {
  id: string;
  sku: string;
  name: string;
  slug: string;
  short_description: string | null;
  description: string | null;
  retail_price: number;
  contractor_price: number | null;
  wholesale_price: number | null;
  dealer_price: number | null;
  promotional_price: number | null;
  promotion_label?: string | null;
  featured: boolean;
  category: CatalogCategory | null;
  brand: CatalogBrand | null;
  primary_image: string | null;
};

// Mock data for development when database isn't available
const MOCK_PRODUCTS: CatalogProduct[] = [
  {
    id: "1",
    sku: "DEMO-CBL-15",
    name: "1.5mm² Twin Cable",
    slug: "demo-1-5mm-twin-cable",
    short_description: "Reliable conductors for residential and commercial work.",
    description: "Development sample cable for testing.",
    retail_price: 1200,
    contractor_price: 1050,
    wholesale_price: null,
    dealer_price: null,
    promotional_price: null,
    featured: false,
    category: { id: "1", name: "Cables & Wires", slug: "cables-wires", description: null, image_url: null },
    brand: null,
    primary_image: null
  },
  {
    id: "2",
    sku: "DEMO-CBL-25",
    name: "2.5mm² Twin Cable",
    slug: "demo-2-5mm-twin-cable",
    short_description: "Reliable conductors for residential and commercial work.",
    description: "Development sample cable for testing.",
    retail_price: 2100,
    contractor_price: 1850,
    wholesale_price: null,
    dealer_price: null,
    promotional_price: null,
    featured: false,
    category: { id: "1", name: "Cables & Wires", slug: "cables-wires", description: null, image_url: null },
    brand: null,
    primary_image: null
  },
  {
    id: "3",
    sku: "DEMO-LGT-9W",
    name: "9W LED Downlight",
    slug: "demo-9w-led-downlight",
    short_description: "Efficient everyday illumination.",
    description: "Development sample downlight for testing.",
    retail_price: 650,
    contractor_price: 560,
    wholesale_price: null,
    dealer_price: null,
    promotional_price: null,
    featured: true,
    category: { id: "9", name: "Downlights", slug: "downlights", description: null, image_url: null },
    brand: null,
    primary_image: null
  },
  {
    id: "4",
    sku: "DEMO-SKT-13A",
    name: "13A Switched Socket",
    slug: "demo-13a-switched-socket",
    short_description: "Safe, durable power access.",
    description: "Development sample socket for testing.",
    retail_price: 850,
    contractor_price: 760,
    wholesale_price: null,
    dealer_price: null,
    promotional_price: null,
    featured: true,
    category: { id: "3", name: "Sockets", slug: "sockets", description: null, image_url: null },
    brand: null,
    primary_image: null
  },
  {
    id: "5",
    sku: "DEMO-MCB-32A",
    name: "32A Single Pole MCB",
    slug: "demo-32a-single-pole-mcb",
    short_description: "MCBs, RCCBs and protection devices.",
    description: "Development sample protection device.",
    retail_price: 780,
    contractor_price: 690,
    wholesale_price: null,
    dealer_price: null,
    promotional_price: null,
    featured: true,
    category: { id: "5", name: "Circuit Protection", slug: "circuit-protection", description: null, image_url: null },
    brand: null,
    primary_image: null
  },
  {
    id: "6",
    sku: "DEMO-FLD-50W",
    name: "50W LED Floodlight",
    slug: "demo-50w-led-floodlight",
    short_description: "High-output outdoor lighting.",
    description: "Development sample floodlight for testing.",
    retail_price: 3850,
    contractor_price: 3400,
    wholesale_price: null,
    dealer_price: null,
    promotional_price: null,
    featured: true,
    category: { id: "10", name: "Floodlights", slug: "floodlights", description: null, image_url: null },
    brand: null,
    primary_image: null
  },
  {
    id: "7",
    sku: "DEMO-CND-20M",
    name: "20mm PVC Conduit",
    slug: "demo-20mm-pvc-conduit",
    short_description: "Protect and route electrical cable.",
    description: "Development sample conduit for testing.",
    retail_price: 150,
    contractor_price: 125,
    wholesale_price: null,
    dealer_price: null,
    promotional_price: null,
    featured: false,
    category: { id: "13", name: "Conduits", slug: "conduits", description: null, image_url: null },
    brand: null,
    primary_image: null
  }
];

function getFilteredProducts(options: {
  search?: string;
  category?: string;
  brand?: string;
  sort?: "featured" | "low" | "high";
}): CatalogProduct[] {
  let products = [...MOCK_PRODUCTS];

  // Apply search filter
  if (options.search?.trim()) {
    const term = options.search.toLowerCase();
    products = products.filter((p) =>
      p.name.toLowerCase().includes(term) ||
      p.sku.toLowerCase().includes(term) ||
      p.short_description?.toLowerCase().includes(term)
    );
  }

  // Filter by category
  if (options.category?.trim()) {
    const categorySlug = options.category.trim();
    products = products.filter((p) => p.category?.slug === categorySlug);
  }

  // Filter by brand
  if (options.brand?.trim()) {
    const brandSlug = options.brand.trim();
    products = products.filter((p) => p.brand?.slug === brandSlug);
  }

  // Apply sorting
  if (options.sort === "low") {
    products.sort((a, b) => a.retail_price - b.retail_price);
  } else if (options.sort === "high") {
    products.sort((a, b) => b.retail_price - a.retail_price);
  } else {
    // Featured sort
    products.sort((a, b) => {
      if (a.featured === b.featured) {
        return a.name.localeCompare(b.name);
      }
      return a.featured ? -1 : 1;
    });
  }

  return products;
}

const PRODUCT_LIST_SELECT =
  "id, sku, name, slug, short_description, description, retail_price, contractor_price, wholesale_price, dealer_price, promotional_price, featured, category_id, brand_id";

export async function getCatalogProducts(
  client: SupabaseClient<Database>,
  options: {
    search?: string;
    category?: string;
    brand?: string;
    productIds?: string[];
    sort?: "featured" | "low" | "high";
    page?: number;
    pageSize?: number;
    allowFallback?: boolean;
  } = {}
) {
  try {
    let categoryId: string | null = null;
    if (options.category?.trim()) {
      const { data: category, error: categoryError } = await client
        .from("categories")
        .select("id")
        .eq("slug", options.category.trim())
        .eq("is_active", true)
        .maybeSingle();
      if (categoryError) throw categoryError;
      if (!category) return [];
      categoryId = category.id;
    }

    // Keep storefront reads authoritative: demo data must never mask a catalog outage.
    let query = client
      .from("products")
      .select(PRODUCT_LIST_SELECT)
      .eq("is_active", true);

    if (categoryId) {
      query = query.eq("category_id", categoryId);
    }

    if (options.productIds?.length) {
      query = query.in("id", options.productIds);
    }

    // Apply search filter if provided
    if (options.search?.trim()) {
      const searchTerm = options.search.trim();
      query = query
        .or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%`);
    }

    // Apply sorting
    if (options.sort === "low") {
      query = query.order("retail_price", { ascending: true });
    } else if (options.sort === "high") {
      query = query.order("retail_price", { ascending: false });
    } else {
      // Featured sort: featured products first, then by name
      query = query.order("featured", { ascending: false }).order("name", { ascending: true });
    }

    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.min(60, Math.max(12, options.pageSize ?? 48));
    const { data, error } = await query.range(
      (page - 1) * pageSize,
      page * pageSize - 1
    );

    if (error) throw error;

    if (!data || data.length === 0) return [];

    // These lookups are independent; run them together to keep navigation responsive.
    const [categoriesResult, brandsResult, imagesResult] = await Promise.all([
      client
        .from("categories")
        .select("id, name, slug, description, image_url")
        .eq("is_active", true),
      client
        .from("brands")
        .select("id, name, slug, description, logo_url")
        .eq("is_active", true),
      client
        .from("product_images")
        .select("product_id, image_url, is_primary, sort_order")
        .in("product_id", data.map((product) => product.id))
        .order("is_primary", { ascending: false })
        .order("sort_order", { ascending: true })
    ]);

    if (categoriesResult.error) throw categoriesResult.error;
    if (brandsResult.error) throw brandsResult.error;
    if (imagesResult.error) throw imagesResult.error;

    const categoriesData = categoriesResult.data;
    const brandsData = brandsResult.data;
    const imagesData = imagesResult.data;

    const categoriesMap = new Map((categoriesData ?? []).map((category) => [category.id, category]));
    const brandsMap = new Map((brandsData ?? []).map((brand) => [brand.id, brand]));
    const imagesMap = new Map<string, string>();
    for (const image of imagesData ?? []) {
      if (!imagesMap.has(image.product_id)) imagesMap.set(image.product_id, image.image_url);
    }

    // Map database results to CatalogProduct type
    let products = data.map((product) => mapCatalogProduct(product, categoriesMap, brandsMap, imagesMap));

    // Apply brand filter if provided (client-side since DB joins aren't working)
    if (options.brand?.trim()) {
      const brandSlug = options.brand.trim();
      products = products.filter(p => p.brand?.slug === brandSlug);
    }

    return products;
  } catch (err) {
      if (options.allowFallback) {
        return getFilteredProducts(options);
      }

      console.error("Exception fetching products:", err);
      return [];
  }
}

export async function getCatalogProductCount(
  client: SupabaseClient<Database>,
  options: {
    search?: string;
    category?: string;
    brand?: string;
  } = {}
): Promise<number> {
  try {
    let categoryId: string | undefined;
    let brandId: string | undefined;

    if (options.category?.trim()) {
      const { data, error } = await client
        .from("categories")
        .select("id")
        .eq("slug", options.category.trim())
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      categoryId = data?.id;
    }

    if (options.brand?.trim()) {
      const { data, error } = await client
        .from("brands")
        .select("id")
        .eq("slug", options.brand.trim())
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      brandId = data?.id;
    }

    let query = client
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true);

    if (options.search?.trim()) {
      const searchTerm = options.search.trim();
      query = query.or(
        `name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%`
      );
    }
    if (categoryId) query = query.eq("category_id", categoryId);
    if (brandId) query = query.eq("brand_id", brandId);

    const { count, error } = await query;
    if (error) throw error;
    return count ?? 0;
  } catch (err) {
    console.error("Exception counting catalog products:", err);
    return 0;
  }
}

export async function getCatalogProductBySlug(
  client: SupabaseClient<Database>,
  slug: string
): Promise<CatalogProduct | null> {
  try {
    const { data, error } = await client
      .from("products")
      .select(PRODUCT_LIST_SELECT)
      .eq("slug", slug)
      .eq("is_active", true)
      .single();

    if (error || !data) return null;

    // Fetch categories and brands for mapping
    const { data: categoriesData } = await client
      .from("categories")
      .select("id, name, slug, description, image_url")
      .eq("is_active", true);

    const { data: brandsData } = await client
      .from("brands")
      .select("id, name, slug, description, logo_url")
      .eq("is_active", true);
    const { data: imageData } = await client
      .from("product_images")
      .select("image_url")
      .eq("product_id", data.id)
      .order("is_primary", { ascending: false })
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle();

    const categoriesMap = new Map((categoriesData ?? []).map((category) => [category.id, category]));
    const brandsMap = new Map((brandsData ?? []).map((brand) => [brand.id, brand]));

    return mapCatalogProduct(data, categoriesMap, brandsMap, new Map(imageData ? [[data.id, imageData.image_url]] : []));
  } catch (err) {
    console.error("Exception fetching product by slug:", err);
    return null;
  }
}

export async function getCatalogCategories(
  client: SupabaseClient<Database>
): Promise<CatalogCategory[]> {
  try {
    const { data, error } = await client
      .from("categories")
      .select("id, name, slug, description, image_url")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error || !data) {
      console.log("Categories not found in database:", error?.message);
      return [];
    }

    return data;
  } catch (err) {
    console.error("Exception fetching categories:", err);
    return [];
  }
}

export async function getCatalogCategoryBySlug(
  client: SupabaseClient<Database>,
  slug: string
): Promise<CatalogCategory | null> {
  try {
    const { data, error } = await client
      .from("categories")
      .select("id, name, slug, description, image_url")
      .eq("slug", slug)
      .eq("is_active", true)
      .single();

    if (error || !data) {
      console.log("Category not found in database:", error?.message);
      return null;
    }

    return data;
  } catch (err) {
    console.error("Exception fetching category by slug:", err);
    return null;
  }
}

export async function getCatalogBrands(
  client: SupabaseClient<Database>
): Promise<CatalogBrand[]> {
  try {
    const { data, error } = await client
      .from("brands")
      .select("id, name, slug, description, logo_url")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error || !data) {
      console.log("Brands not found in database:", error?.message);
      return [];
    }

    return data;
  } catch (err) {
    console.error("Exception fetching brands:", err);
    return [];
  }
}

export async function getCatalogBrandBySlug(
  client: SupabaseClient<Database>,
  slug: string
): Promise<CatalogBrand | null> {
  try {
    const { data, error } = await client
      .from("brands")
      .select("id, name, slug, description, logo_url")
      .eq("slug", slug)
      .eq("is_active", true)
      .single();

    if (error || !data) {
      console.log("Brand not found in database:", error?.message);
      return null;
    }

    return data;
  } catch (err) {
    console.error("Exception fetching brand by slug:", err);
    return null;
  }
}
