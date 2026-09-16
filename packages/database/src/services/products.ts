import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Product, ProductInsert } from "../types";

export async function getActiveProducts(client: SupabaseClient<Database>, options: { limit?: number; categoryId?: string } = {}) {
  let query = client.from("products").select("*").eq("is_active", true).order("name").limit(options.limit ?? 24);
  if (options.categoryId) query = query.eq("category_id", options.categoryId);
  return query;
}

export async function createProduct(client: SupabaseClient<Database>, product: ProductInsert) {
  return client.from("products").insert(product).select().single<Product>();
}
