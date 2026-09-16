import { NextResponse } from "next/server";
import { requireAuthorizedPermission } from "@/lib/auth/server";
import { getOrSetCache } from "@/lib/core/cache";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ProductRow = {
  id: string; name: string; sku: string; barcode: string | null; description: string | null;
  retail_price: number | null; vat_rate: number | null; category_id: string | null;
  categories: { name: string } | { name: string }[] | null;
  inventory: Array<{ quantity: number | null; reserved_quantity: number | null }> | null;
};

export async function GET(request: Request) {
  try {
    await requireAuthorizedPermission("orders.read");
    const url = new URL(request.url);
    const search = url.searchParams.get("search")?.trim() ?? "";
    const categoryId = url.searchParams.get("categoryId");
    const brandId = url.searchParams.get("brandId");
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 40)));
    const key = `pos-products:${JSON.stringify({ search: search.toLowerCase(), categoryId, brandId, page, limit })}`;
    const result = await getOrSetCache(key, async () => {
      let query = createSupabaseServiceClient()
        .from("products")
        .select("id,name,sku,barcode,description,retail_price,vat_rate,category_id,categories(name),inventory(quantity,reserved_quantity)", { count: "exact" })
        .eq("is_active", true)
        .eq("status", "ACTIVE");
      if (search) query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%,barcode.ilike.%${search}%`);
      if (categoryId) query = query.eq("category_id", categoryId);
      if (brandId) query = query.eq("brand_id", brandId);
      const { data, error, count } = await query.range((page - 1) * limit, page * limit - 1);
      if (error) throw error;
      const products = ((data ?? []) as unknown as ProductRow[]).map((product) => {
        const category = Array.isArray(product.categories) ? product.categories[0] : product.categories;
        const qty = (product.inventory ?? []).reduce((total, row) => total + Math.max(0, Number(row.quantity ?? 0) - Number(row.reserved_quantity ?? 0)), 0);
        return { id: product.id, name: product.name, sku: product.sku, barcode: product.barcode, description: product.description, price: Number(product.retail_price ?? 0), vatRate: Number(product.vat_rate ?? 0), category: category?.name ?? product.category_id ?? "Uncategorized", qty };
      });
      return { products, count, page, limit };
    }, 5_000);
    return NextResponse.json({ success: true, data: result.products, count: result.count, page: result.page, limit: result.limit });
  } catch (error) {
    console.error("POS products error", error);
    return NextResponse.json({ success: false, error: "Failed to fetch POS products." }, { status: 500 });
  }
}
